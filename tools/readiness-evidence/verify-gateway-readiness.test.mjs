import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ReadinessEvidenceError, validateOrigin, evaluateReadiness, verifyGatewayReadiness,
} from './verify-gateway-readiness.mjs';

const good = () => ({
  service: 'gateway', status: 'ready', time: '2026-10-09T04:00:00.000Z',
  checks: [{ name: 'database-schema', ready: true }, { name: 'upstream', ready: true }],
});
const ok = (body = good(), status = 200, type = 'application/json') =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': type } });
const probe = (fetchImpl) => verifyGatewayReadiness({
  origin: 'https://gateway.example.com', expectedHost: 'gateway.example.com', fetchImpl,
});
const code = async (promise, expected) =>
  assert.rejects(promise, e => e instanceof ReadinessEvidenceError && e.code === expected);

test('accepts only the exact named public HTTPS DNS origin', () => {
  assert.equal(validateOrigin('https://Gateway.Example.COM/', 'gateway.example.com'),
    'https://gateway.example.com');
  for (const value of [
    'http://gateway.example.com', 'https://gateway.example.com:443',
    'https://user:pw@gateway.example.com', 'https://gateway.example.com/healthz',
    'https://gateway.example.com/?a=1', 'https://gateway.example.com/#hash',
    'https://localhost', 'https://127.0.0.1', 'https://10.0.0.1',
    'https://gateway.local', 'https://gateway.internal',
    'https://evil..example.com', 'https://-bad.example.com',
  ]) assert.throws(() => validateOrigin(value, 'gateway.example.com'), ReadinessEvidenceError);
  assert.throws(() => validateOrigin('https://gateway.example.com', 'other.example.com'),
    e => e.code === 'HOST_MISMATCH');
});

test('valid snapshot is evidence only, not deployment or E2E proof', () => {
  assert.deepEqual(evaluateReadiness(good(), 200), {
    classification: 'READY_SNAPSHOT_ONLY',
    database_schema_ready: true, dependency_count: 2,
  });
});

test('requires the actual database-schema check and nonempty dependencies', () => {
  for (const checks of [[], [{ name: 'upstream', ready: true }]]) {
    const bad = { ...good(), checks };
    assert.throws(() => evaluateReadiness(bad, 200), ReadinessEvidenceError);
  }
});

test('rejects duplicate checks even when both claim ready', () => {
  const bad = { ...good(), checks: [
    { name: 'database-schema', ready: true }, { name: 'database-schema', ready: true },
  ] };
  assert.throws(() => evaluateReadiness(bad, 200),
    e => e.code === 'INVALID_READINESS_RESPONSE');
});

test('rejects a false or nonboolean dependency and contradictory service status', () => {
  assert.throws(() => evaluateReadiness({
    ...good(), checks: [{ name: 'database-schema', ready: false, reason: 'secret' }],
  }, 200), e => e.code === 'DEPENDENCY_NOT_READY');
  assert.throws(() => evaluateReadiness({
    ...good(), checks: [{ name: 'database-schema', ready: 'true' }],
  }, 200), e => e.code === 'INVALID_READINESS_RESPONSE');
  assert.throws(() => evaluateReadiness({ ...good(), status: 'not-ready' }, 200),
    e => e.code === 'INVALID_READINESS_RESPONSE');
});

test('rejects untrusted response metadata', () => {
  for (const body of [null, [], { ...good(), service: 'worker' },
    { ...good(), time: 'not-a-date' }, { ...good(), checks: 'pass' }]) {
    assert.throws(() => evaluateReadiness(body, 200), ReadinessEvidenceError);
  }
  assert.throws(() => evaluateReadiness(good(), 503),
    e => e.code === 'HTTP_NOT_READY');
});

test('requests only GET /readyz without credentials, redirect or caching', async () => {
  let called = false;
  const result = await probe(async (url, options) => {
    called = true;
    assert.equal(url, 'https://gateway.example.com/readyz');
    assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'manual');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.credentials, 'omit');
    assert.deepEqual(options.headers, { accept: 'application/json' });
    return ok();
  });
  assert.ok(called);
  assert.equal(result.classification, 'READY_SNAPSHOT_ONLY');
});

test('does not contact network when origin validation fails', async () => {
  let calls = 0;
  await code(verifyGatewayReadiness({
    origin: 'https://127.0.0.1', expectedHost: '127.0.0.1',
    fetchImpl: async () => { calls++; return ok(); },
  }), 'UNSAFE_ORIGIN');
  assert.equal(calls, 0);
});

test('rejects 503, 302, unexpected media type, invalid JSON, oversized JSON', async () => {
  await code(probe(async () => ok(good(), 503)), 'HTTP_NOT_READY');
  await code(probe(async () => new Response('', { status: 302 })), 'HTTP_NOT_READY');
  await code(probe(async () => ok(good(), 200, 'text/html')), 'INVALID_CONTENT_TYPE');
  await code(probe(async () => new Response('invalid', {
    status: 200, headers: { 'content-type': 'application/json' },
  })), 'INVALID_JSON');
  await code(probe(async () => new Response('x'.repeat(17_000), {
    status: 200, headers: { 'content-type': 'application/json' },
  })), 'OVERSIZED_RESPONSE');
});

test('sanitizes provider transport errors and verifies timeout parameter limits', async () => {
  await code(probe(async () => { throw new Error('DATABASE_URL=secret'); }), 'TRANSPORT_ERROR');
  await code(verifyGatewayReadiness({
    origin: 'https://gateway.example.com', expectedHost: 'gateway.example.com',
    timeoutMs: 20000, fetchImpl: async () => ok(),
  }), 'INVALID_ARGUMENTS');
});
