#!/usr/bin/env node
/** AF13: Offline, read-only check of SHA-bound qualification attestations. No secrets/output logs. */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SHA40 = /^[0-9a-f]{40}$/i;
const SHA256 = /^[0-9a-f]{64}$/i;
const IDENTIFIER = /^(UX-A\d{2}|WF-A\d{2}|PF-A\d{2}|CR-A\d{2}|DB-A\d{2})$/;
const STATUSES = new Set(['PASS_REAL', 'PASS_SIMULATED', 'FAIL', 'BLOCKED', 'NOT_RUN']);
const MAX_JSON_BYTES = 512 * 1024;
const MAX_PROOF_BYTES = 50 * 1024 * 1024;

function boundedJson(file) {
  const s = statSync(file);
  if (!s.isFile() || s.size > MAX_JSON_BYTES) throw Error('Missing/oversize JSON input');
  return JSON.parse(readFileSync(file, 'utf8'));
}
function proofDigest(root, relative) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || relative.includes('\\') || relative.split('/').includes('..')) throw Error('Unsafe proof path');
  const full = path.resolve(root, relative);
  const actual = realpathSync(full);
  if (!actual.startsWith(root + path.sep) || !statSync(actual).isFile()) throw Error('Proof outside checkout');
  if (statSync(actual).size > MAX_PROOF_BYTES) throw Error('Proof too large');
  return createHash('sha256').update(readFileSync(actual)).digest('hex');
}
/** Checks attestations, not truthfulness of a purported device/provider test. */
export function verify({ root, matrix, manifest, expectedSha, mode = 'release', now = new Date() }) {
  if (!['release', 'integration'].includes(mode)) throw Error('Unknown mode');
  if (!SHA40.test(expectedSha ?? '')) throw Error('Expected immutable source SHA required');
  const rootReal = realpathSync(root);
  const gates = boundedJson(matrix);
  const record = boundedJson(manifest);
  if (gates.schemaVersion !== 1 || !Array.isArray(gates.gates) || gates.gates.length === 0 || record.schemaVersion !== 1 || !Array.isArray(record.evidence) || !SHA40.test(record.sourceSha ?? '') || record.sourceSha.toLowerCase() !== expectedSha.toLowerCase()) throw Error('Malformed matrix, wrong source SHA or evidence manifest');
  const expected = new Set();
  for (const g of gates.gates) {
    if (!g || !IDENTIFIER.test(g.id ?? '') || expected.has(g.id) || typeof g.description !== 'string' || !g.description.trim()) throw Error('Malformed or duplicate gate definition');
    expected.add(g.id);
  }
  const actual = new Map(), invalid = [];
  for (const row of record.evidence) {
    const id = row?.id;
    if (!expected.has(id) || actual.has(id) || !STATUSES.has(row?.status)) {
      invalid.push(typeof id === 'string' && IDENTIFIER.test(id) ? id : 'UNKNOWN');
      continue;
    }
    actual.set(id, row);
    if (row.status.startsWith('PASS_')) {
      try {
        if (row.sourceSha !== record.sourceSha || typeof row.command !== 'string' || !row.command.trim() || row.command.length > 1500 || typeof row.environment !== 'string' || !row.environment.trim() || row.environment.length > 500 || !SHA256.test(row.proof?.sha256 ?? '')) throw Error('Missing binding');
        const t = Date.parse(row.executedAt);
        if (typeof row.executedAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(row.executedAt) || !Number.isFinite(t) || t > now.getTime() + 5 * 60 * 1000 || t < now.getTime() - 30 * 24 * 60 * 60 * 1000) throw Error('Stale/future evidence');
        if (proofDigest(rootReal, row.proof.path) !== row.proof.sha256.toLowerCase()) throw Error('Proof hash mismatch');
      } catch { invalid.push(id); }
    }
  }
  const missing = [...expected].filter(id => !actual.has(id));
  const failed = [...actual].filter(([,r])=>r.status === 'FAIL').map(([id])=>id);
  const blocked = [...actual].filter(([,r])=>r.status === 'BLOCKED' || r.status === 'NOT_RUN').map(([id])=>id);
  const simulated = [...actual].filter(([,r])=>r.status === 'PASS_SIMULATED').map(([id])=>id);
  const real = [...actual].filter(([,r])=>r.status === 'PASS_REAL').map(([id])=>id);
  const accepted = mode === 'release' ? real.length : real.length + simulated.length;
  const ready = invalid.length === 0 && missing.length === 0 && failed.length === 0 && blocked.length === 0 && accepted === expected.size;
  return { ready, mode, sourceSha: record.sourceSha, gateCount: expected.size, passReal: real.length, passSimulated: simulated.length, invalid: [...new Set(invalid)].sort(), missing, failed, blocked, needsReal: mode === 'release' ? simulated : [] };
}

function main(argv) {
  const opts = {};
  for (let i=0; i<argv.length; i += 2) {
    if (!['--root','--manifest','--matrix','--mode','--expected-sha'].includes(argv[i]) || i+1 >= argv.length) throw Error('Usage: --root DIR --manifest FILE [--matrix FILE] [--mode release|integration]');
    opts[argv[i].slice(2)] = argv[i+1];
  }
  const here = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(opts.root ?? '.');
  const manifest = path.resolve(opts.manifest ?? '');
  if (!opts.manifest || !existsSync(manifest) || !SHA40.test(opts['expected-sha'] ?? '')) throw Error('Missing manifest or expected immutable source SHA');
  const result = verify({root, manifest, matrix: path.resolve(opts.matrix ?? path.join(here,'acceptance-matrix.json')), expectedSha: opts['expected-sha'], mode: opts.mode ?? 'release'});
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exitCode = result.ready ? 0 : 2;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); } catch { process.stderr.write('Qualification manifest invalid or inaccessible; no readiness asserted.\n'); process.exitCode = 2; }
}
