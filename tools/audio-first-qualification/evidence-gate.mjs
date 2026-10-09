#!/usr/bin/env node
/**
 * AF13 evidence preflight. Purely structural: it never certifies real execution,
 * approves a release, runs providers, or calls production systems.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SHA = /^[0-9a-f]{40}$/i;
const SHA256 = /^[0-9a-f]{64}$/i;
const JOURNEY = /\b(?:UX|WF|CR|PF|DB)-A\d{2}\b/g;
const JOURNEY_RANGE = /\b((?:UX|WF|CR|PF|DB)-A)(\d{2})\s*[–—-]\s*\1(\d{2})\b/g;
const STATUSES = new Set(['NOT_RUN', 'FAIL', 'PASS_SIMULATED', 'PASS_REAL', 'BLOCKED']);
const SAFE_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._/-]{5,159}$/;
const MAX_INPUT_BYTES = 1024 * 1024;

export function parseJourneyIds(markdown) {
  if (typeof markdown !== 'string') throw new TypeError('acceptance document must be text');
  const ids = new Set(markdown.match(JOURNEY) ?? []);
  for (const match of markdown.matchAll(JOURNEY_RANGE)) {
    const start = Number(match[2]);
    const end = Number(match[3]);
    if (end >= start && end - start <= 50) {
      for (let n = start; n <= end; n++) ids.add(`${match[1]}${String(n).padStart(2, '0')}`);
    }
  }
  return [...ids].sort();
}

function safeReason(value) {
  return typeof value === 'string' && value.trim().length >= 6 && value.length <= 500;
}

function validUtc(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)
    && !Number.isNaN(Date.parse(value))
    && new Date(value).toISOString().slice(0, 19) === value.slice(0, 19);
}

/**
 * Output is a preflight report, not executable verification of claims.
 * Never report VERIFIED_E2E or authorize release based on a JSON assertion.
 */
export function validateManifest(manifest, acceptanceDocument, { requireAllReal = false } = {}) {
  const errors = [];
  if (!manifest || Array.isArray(manifest) || typeof manifest !== 'object') {
    return { valid: false, errors: ['Manifest must be a JSON object'], releaseAuthorized: false, verifiedE2E: false };
  }
  if (manifest.schemaVersion !== 1) errors.push('Unsupported manifest schemaVersion');
  if (!SHA.test(manifest.targetSha ?? '')) errors.push('targetSha must be a full commit SHA');
  if (!Array.isArray(manifest.observations)) errors.push('observations must be an array');
  if (manifest.targetArtifact !== undefined) {
    const a = manifest.targetArtifact;
    if (!a || !SHA256.test(a.sha256 ?? '') ||
        typeof a.packageId !== 'string' || !/^[a-z][a-z0-9_.]{2,150}$/.test(a.packageId) ||
        typeof a.version !== 'string' || !/^[A-Za-z0-9.+_-]{1,80}$/.test(a.version)) {
      errors.push('targetArtifact requires SHA-256, packageId and version');
    }
  }
  const expected = parseJourneyIds(acceptanceDocument);
  if (!expected.length) errors.push('Acceptance document contains no journey IDs');
  const known = new Set(expected);
  const seen = new Set();
  const counts = Object.fromEntries([...STATUSES].map(x => [x, 0]));
  const qualifiedReal = [];
  const observations = Array.isArray(manifest.observations) ? manifest.observations : [];
  if (observations.length > 300) errors.push('Too many observations');
  for (const [index, row] of observations.entries()) {
    const label = `Observation ${index + 1}`;
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      errors.push(`${label}: expected object`);
      continue;
    }
    const id = row.journeyId;
    if (typeof id !== 'string' || !known.has(id)) {
      errors.push(`${label}: unknown journey ID`);
      continue;
    }
    if (seen.has(id)) errors.push(`${id}: duplicate observation`);
    seen.add(id);
    if (!STATUSES.has(row.status)) {
      errors.push(`${id}: invalid status`);
      continue;
    }
    counts[row.status] += 1;
    if (row.status === 'BLOCKED' || row.status === 'FAIL') {
      if (!safeReason(row.reason)) errors.push(`${id}: failure/block requires a non-sensitive reason`);
    }
    if (row.status === 'PASS_REAL' || row.status === 'PASS_SIMULATED') {
      const e = row.execution;
      if (!SHA.test(row.sourceSha ?? '') || row.sourceSha.toLowerCase() !== String(manifest.targetSha).toLowerCase()) {
        errors.push(`${id}: sourceSha does not match targetSha`);
      }
      if (!validUtc(row.observedAt)) errors.push(`${id}: missing/invalid UTC execution time`);
      const intendedKind = row.status === 'PASS_REAL' ? 'real' : 'simulated';
      if (!e || typeof e !== 'object' || e.kind !== intendedKind || !Number.isInteger(e.steps) || e.steps < 1 || e.steps > 100000 ||
          !Array.isArray(e.assertions) || e.assertions.length < 1 || e.assertions.some(x => !SAFE_REFERENCE.test(x)) ||
          !Array.isArray(e.evidenceRefs) || e.evidenceRefs.length < 1 || e.evidenceRefs.some(x => !SAFE_REFERENCE.test(x) || x.includes('..'))) {
        errors.push(`${id}: ${row.status} needs executed steps, assertions and safe evidence references`);
      }
      if (row.status === 'PASS_REAL') {
        if (!e || !Array.isArray(e.dependencies) || !e.dependencies.length ||
            e.dependencies.some(x => !SAFE_REFERENCE.test(x)) ||
            typeof e.environment !== 'string' || !SAFE_REFERENCE.test(e.environment) ||
            typeof e.actorRoles !== 'string' || !SAFE_REFERENCE.test(e.actorRoles)) {
          errors.push(`${id}: PASS_REAL needs external dependencies, environment and actor roles`);
        }
        // This only checks claim structure. Actual receipts, devices, DB and providers
        // must be independently inspected by AF13/integrator before promotion.
        qualifiedReal.push(id);
      }
    }
  }
  const missing = expected.filter(x => !seen.has(x));
  const allRealClaimed = missing.length === 0 && expected.every(id =>
    observations.some(row => row?.journeyId === id && row.status === 'PASS_REAL'));
  const valid = errors.length === 0;
  return {
    schemaVersion: 1,
    valid,
    errors,
    targetSha: SHA.test(manifest.targetSha ?? '') ? manifest.targetSha : null,
    expectedCount: expected.length,
    observedCount: seen.size,
    counts,
    missing,
    allRealClaimed: valid && allRealClaimed,
    reviewRequired: true,
    verifiedE2E: false,
    releaseAuthorized: false,
    preflightPassed: valid && (!requireAllReal || allRealClaimed),
    warning: 'Structural checks only; claims and evidence references need independent, real-boundary readback.'
  };
}

function usage() {
  return 'Usage: node evidence-gate.mjs --manifest <json> --journeys <markdown> [--require-all-real]';
}

export function main(argv = process.argv.slice(2)) {
  let manifestPath = null;
  let journeysPath = null;
  let requireAllReal = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--manifest' && !manifestPath) manifestPath = argv[++i];
    else if (arg === '--journeys' && !journeysPath) journeysPath = argv[++i];
    else if (arg === '--require-all-real') requireAllReal = true;
    else { console.error(usage()); return 1; }
  }
  if (!manifestPath || !journeysPath) { console.error(usage()); return 1; }
  try {
    const readBounded = path => {
      const data = readFileSync(path);
      if (data.byteLength > MAX_INPUT_BYTES) throw new Error('Input exceeds 1 MiB');
      return data.toString('utf8');
    };
    const manifest = JSON.parse(readBounded(manifestPath));
    const report = validateManifest(manifest, readBounded(journeysPath), { requireAllReal });
    console.log(JSON.stringify(report, null, 2));
    return report.valid ? (report.preflightPassed ? 0 : 2) : 1;
  } catch {
    // Do not echo arbitrary file content or private local paths to public logs.
    console.error('Evidence manifest or acceptance file could not be read/parsed safely');
    return 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main();
}
