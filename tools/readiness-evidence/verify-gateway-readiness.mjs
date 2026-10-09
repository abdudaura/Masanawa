#!/usr/bin/env node
/**
 * F11/DB-P03: read-only Gateway readiness evidence, not a deployment check.
 * Node >= 20. No dependencies, credentials, requests other than GET, or writes.
 */
import { pathToFileURL } from 'node:url';

export class ReadinessEvidenceError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ReadinessEvidenceError';
    this.code = code;
  }
}

const fail = (code) => { throw new ReadinessEvidenceError(code); };

export function validateOrigin(origin, expectedHost) {
  if (typeof origin !== 'string' || typeof expectedHost !== 'string') fail('INVALID_ARGUMENTS');
  // Accept only an explicit HTTPS DNS origin, without userinfo, port, path, query or fragment.
  if (!/^https:\/\/[A-Za-z0-9.-]+\/?$/.test(origin)) fail('UNSAFE_ORIGIN');
  const url = new URL(origin);
  const host = url.hostname.toLowerCase();
  const labels = host.split('.');
  if (labels.length < 2 || labels.some(
    label => !label || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
  )) fail('UNSAFE_ORIGIN');
  if (host.length > 253 || /^\d+\.\d+\.\d+\.\d+$/.test(host) ||
      host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    fail('UNSAFE_ORIGIN');
  }
  if (expectedHost !== host) fail('HOST_MISMATCH');
  return url.origin;
}

export function evaluateReadiness(snapshot, httpStatus) {
  if (httpStatus !== 200) fail('HTTP_NOT_READY');
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot) ||
      snapshot.service !== 'gateway' || snapshot.status !== 'ready' ||
      typeof snapshot.time !== 'string' ||
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/.test(snapshot.time) ||
      !Number.isFinite(Date.parse(snapshot.time)) ||
      !Array.isArray(snapshot.checks) || snapshot.checks.length === 0) {
    fail('INVALID_READINESS_RESPONSE');
  }
  const unique = new Set();
  for (const check of snapshot.checks) {
    if (!check || typeof check !== 'object' || Array.isArray(check) ||
        typeof check.name !== 'string' || !check.name || unique.has(check.name) ||
        typeof check.ready !== 'boolean') fail('INVALID_READINESS_RESPONSE');
    unique.add(check.name);
    if (!check.ready) fail('DEPENDENCY_NOT_READY');
  }
  // /readyz with zero injected checks would otherwise be a false-positive 200.
  if (!unique.has('database-schema')) fail('DATABASE_CHECK_MISSING');
  return Object.freeze({
    classification: 'READY_SNAPSHOT_ONLY',
    database_schema_ready: true,
    dependency_count: snapshot.checks.length,
    // Deliberately no raw "reason" fields (may contain internals).
  });
}

async function boundedJson(response, limit = 16_384) {
  const type = response.headers?.get?.('content-type') ?? '';
  if (!/^application\/json(?:\s*;|$)/i.test(type)) fail('INVALID_CONTENT_TYPE');
  const length = response.headers?.get?.('content-length');
  if (length != null && (!/^\d+$/.test(length) || Number(length) > limit)) fail('OVERSIZED_RESPONSE');
  if (!response.body?.getReader) fail('INVALID_READINESS_RESPONSE');
  const reader = response.body.getReader();
  const buffers = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) fail('OVERSIZED_RESPONSE');
      buffers.push(value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(
      Buffer.concat(buffers.map(b => Buffer.from(b)))
    ));
  } catch {
    fail('INVALID_JSON');
  }
}

export async function verifyGatewayReadiness({
  origin, expectedHost, fetchImpl = globalThis.fetch, timeoutMs = 5000,
} = {}) {
  const safeOrigin = validateOrigin(origin, expectedHost);
  if (typeof fetchImpl !== 'function' || !Number.isInteger(timeoutMs) ||
      timeoutMs < 100 || timeoutMs > 15_000) fail('INVALID_ARGUMENTS');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetchImpl(safeOrigin + '/readyz', Object.freeze({
      method: 'GET',
      redirect: 'manual',
      cache: 'no-store',
      credentials: 'omit',
      signal: controller.signal,
      headers: { accept: 'application/json' },
    }));
    if (response.status !== 200) fail('HTTP_NOT_READY');
    const snapshot = await boundedJson(response);
    return evaluateReadiness(snapshot, response.status);
  } catch (error) {
    if (error instanceof ReadinessEvidenceError) throw error;
    fail(controller.signal.aborted ? 'TIMEOUT' : 'TRANSPORT_ERROR');
  } finally {
    clearTimeout(timeout);
  }
}

export async function main(args = process.argv.slice(2)) {
  const allowed = new Set(['--origin', '--expect-host']);
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!allowed.has(args[i]) || !args[i + 1] || options[args[i]]) {
      process.stderr.write('readiness-evidence: INVALID_ARGUMENTS\n');
      return 2;
    }
    options[args[i]] = args[i + 1];
  }
  try {
    const result = await verifyGatewayReadiness({
      origin: options['--origin'], expectedHost: options['--expect-host'],
    });
    process.stdout.write(JSON.stringify(result) + '\n');
    return 0;
  } catch (error) {
    // Never print the URL, HTTP response body, raw dependency reason or thrown transport error.
    const code = error instanceof ReadinessEvidenceError ? error.code : 'UNKNOWN_FAILURE';
    process.stderr.write('readiness-evidence: ' + code + '\n');
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
