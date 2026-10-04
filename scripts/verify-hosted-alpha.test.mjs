import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyHostedAlpha } from './verify-hosted-alpha.mjs';

function transport({ failedTurn = false } = {}) {
  const paths = [];
  const fetchImpl = async (url, init) => {
    paths.push(url.pathname);
    assert.equal(init.redirect, 'error');
    assert(init.signal instanceof AbortSignal);
    if (url.pathname !== '/readyz') assert.equal(init.headers.authorization, 'Bearer private-test-token');
    let data = {};
    if (url.pathname === '/readyz') data = { status: 'ready' };
    if (url.pathname.endsWith('/directory')) data = { agents: [{ characterId: 'character-1' }] };
    if (url.pathname.endsWith('/open')) data = { characterSessionId: 'session-1' };
    if (url.pathname.endsWith('/turn') || url.pathname.endsWith('/media-turn')) {
      if (failedTurn) return new Response(JSON.stringify({ message: 'private vendor failure' }), { status: 500 });
      data = { reply: 'hello', agentRunId: 'run-1' };
    }
    return new Response(JSON.stringify(data));
  };
  return { paths, fetchImpl };
}

test('hosted smoke exercises directory, session, text, document and close', async () => {
  const fake = transport();
  const result = await verifyHostedAlpha({ baseUrl: 'https://gateway.test', token: 'private-test-token', fetchImpl: fake.fetchImpl });
  assert.equal(result.textInference, 'passed');
  assert.equal(result.documentInference, 'passed');
  assert.equal(fake.paths.length, 6);
  assert(!JSON.stringify(result).includes('private-test-token'));
});

test('failed inference closes the session and redacts private response content', async () => {
  const fake = transport({ failedTurn: true });
  await assert.rejects(verifyHostedAlpha({ baseUrl: 'https://gateway.test', token: 'private-test-token', fetchImpl: fake.fetchImpl }),
    error => error.message === 'Hosted Alpha /v1/agent/sessions/session-1/turn returned HTTP 500');
  assert.equal(fake.paths.at(-1), '/v1/agent/sessions/session-1/close');
});

test('remote HTTP is rejected before credentials are dispatched', async () => {
  let called = false;
  await assert.rejects(verifyHostedAlpha({ baseUrl: 'http://gateway.test', token: 'private-test-token', fetchImpl: async () => { called = true; } }));
  assert.equal(called, false);
});
