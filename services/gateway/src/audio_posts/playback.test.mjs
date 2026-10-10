import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudioPostPlaybackService, registerAudioPostPlaybackRoutes, TalkPlaybackError } from './playback.ts';
const t = 2_000_000_000_000;
const alice = { tenantId: 'tenant1', accountId: 'alice', authorId: 'alice', authorKind: 'human' };
const bob = { tenantId: 'tenant1', accountId: 'bob', authorId: 'bob', authorKind: 'human' };
const record = { tenantId: 'tenant1', postId: 'post1', status: 'published', authorAccountId: 'alice',
  assetId: 'asset1', revision: 2 };
function fixture(overrides = {}) {
  let post = { ...record }; let allowed = true; let principal = { ...bob };
  const calls = [];
  const deps = {
    repository: { byId: async (tenant, id) => { calls.push('read'); return tenant === post.tenantId && id === post.postId ? { ...post } : null; } },
    visibility: { canView: async () => { calls.push('visible'); return allowed; } },
    media: { issue: async ({ mediaId }) => { calls.push(['sign', mediaId]); return {
      url: 'https://storage.example.com/private/asset1?signature=x', expiresAtMs: t + 30_000,
      cacheControl: 'private, no-store',
    }; } },
    signerHost: 'storage.example.com', nowMs: () => t, ...overrides,
  };
  const service = createAudioPostPlaybackService(deps);
  return { service, deps, calls, setPost: p => { post = p; }, setAllowed: x => { allowed = x; },
    setPrincipal: x => { principal = x; }, go: (actor = bob, postId = 'post1') =>
      service.ticket({ actor, postId, currentActor: async () => principal }) };
}
async function deny(promise, code) {
  await assert.rejects(promise, e => e instanceof TalkPlaybackError && e.code === code);
}
test('published and visible post issues a short-lived ticket after two visibility/session checks', async () => {
  const f = fixture();
  assert.deepEqual(await f.go(), { url: 'https://storage.example.com/private/asset1?signature=x', expiresAtMs: t + 30_000 });
  assert.deepEqual(f.calls, ['read', 'visible', ['sign','asset1'], 'read', 'visible']);
});
test('missing, cross-tenant, unpublished and removed posts never reach signer', async () => {
  for (const edited of [{ ...record, status: 'processing' },{ ...record, status: 'removed' },{ ...record, tenantId: 'tenant2' }]) {
    const f = fixture(); f.setPost(edited); await deny(f.go(), 'NOT_FOUND');
    assert.ok(!f.calls.some(Array.isArray));
  }
  const f = fixture(); await deny(f.go(bob, 'missing'), 'NOT_FOUND');
});
test('blocked post has neutral denial and no media call', async () => {
  const f = fixture(); f.setAllowed(false); await deny(f.go(), 'NOT_FOUND');
  assert.ok(!f.calls.some(Array.isArray));
});
test('logout or switching account while signing denies URL', async () => {
  const f = fixture(); f.setPrincipal(alice); await deny(f.go(), 'AUTH_REQUIRED');
});
test('deletion or moderation race after signing is denied by post revision/status', async () => {
  for (const status of ['removed','failed','published']) {
    const f = fixture({ media: { issue: async () => { f.setPost({ ...record, status,
      revision: status === 'published' ? 3 : 2 }); return {
      url:'https://storage.example.com/asset?sig=ok', expiresAtMs:t+30_000, cacheControl:'private, no-store' }; } } });
    await deny(f.go(), 'NOT_FOUND');
  }
});
test('block applied during signer delay is denied after the second visibility check', async () => {
  const f = fixture({ media: { issue: async () => { f.setAllowed(false); return {
    url:'https://storage.example.com/asset?sig=ok', expiresAtMs:t+30_000, cacheControl:'private, no-store' }; } } });
  await deny(f.go(), 'NOT_FOUND');
});
test('invalid/foreign account inputs and unsafe identifiers fail closed', async () => {
  const f = fixture();
  await deny(f.go({ ...bob, accountId: '' }), 'AUTH_REQUIRED');
  for (const id of ['', '../secret', 'some/post', 'sp ace']) await deny(f.go(bob, id), 'VALIDATION');
  assert.ok(!f.calls.some(Array.isArray));
});
test('invalid or long-lived media tickets cannot reach clients', async () => {
  const invalid = [
    { url:'http://storage.example.com/x', expiresAtMs:t+30_000, cacheControl:'private, no-store' },
    { url:'https://other.example.com/x', expiresAtMs:t+30_000, cacheControl:'private, no-store' },
    { url:'https://u:p@storage.example.com/x', expiresAtMs:t+30_000, cacheControl:'private, no-store' },
    { url:'https://storage.example.com/x#bad', expiresAtMs:t+30_000, cacheControl:'private, no-store' },
    { url:'https://storage.example.com/x', expiresAtMs:t+61_000, cacheControl:'private, no-store' },
    { url:'https://storage.example.com/x', expiresAtMs:t-1, cacheControl:'private, no-store' },
    { url:'https://storage.example.com/x', expiresAtMs:t+30_000, cacheControl:'public' },
  ];
  for (const ticket of invalid) {
    const f = fixture({ media: { issue: async () => ticket } });
    await deny(f.go(), 'CAPABILITY_UNAVAILABLE');
  }
});
test('provider errors are redacted and typed; missing authority is fail closed', async () => {
  const f = fixture({ media: { issue: async () => { throw Error('secret storage credentials'); } } });
  await deny(f.go(), 'CAPABILITY_UNAVAILABLE');
  const no = fixture({ media: { issue: async () => { throw { code: 'not_found' }; } } });
  await deny(no.go(), 'NOT_FOUND');
});
test('HTTP route authenticates, rechecks, sets no-store and returns typed denials', async () => {
  const f = fixture(); let handler;
  const app = { get: (path, fn) => { assert.equal(path, '/audio-posts/:postId/playback'); handler = fn; } };
  registerAudioPostPlaybackRoutes(app, { service: f.service, requireActor: async () => bob });
  const result = { headers: {}, codeValue: null, body: null,
    header(k,v){this.headers[k]=v;return this;},code(v){this.codeValue=v;return this;},send(v){this.body=v;return v;} };
  const yes = await handler({ headers: { authorization: 'Bearer x' }, params: { postId:'post1' } }, result);
  assert.equal(yes.expiresAtMs, t+30_000); assert.equal(result.headers['Cache-Control'], 'private, no-store');
  const r2 = { ...result, codeValue:null, header:result.header, code:result.code, send:result.send };
  await handler({ headers: {}, params: { postId:'../other' } }, r2);
  assert.equal(r2.codeValue,400); assert.deepEqual(r2.body,{code:'VALIDATION'});
});
