import test from 'node:test';
import assert from 'node:assert/strict';
import { registerPublishedAudioFeatureRoutes } from './register_feature.js';

const actor = { tenantId:'tenant1', accountId:'alice', authorId:'alice', authorKind:'human' };
const post = { tenantId:'tenant1', postId:'post1', authorId:'alice',
  authorAccountId:'alice', authorKind:'human', assetId:'asset1',
  requestId:'request1', title:'Hello', durationMs:10000,
  revision:1, createdAt:'2026-10-10T00:00:00Z', publishedAt:'2026-10-10T00:00:00Z',
  status:'published' };

function fixture() {
  let sessions = 0;
  const routes = new Map();
  const app = Object.fromEntries(['get','post','put','delete'].map(verb =>
    [verb, (path, handler) => {
      const key = verb.toUpperCase() + ' ' + path;
      assert.equal(routes.has(key), false, 'duplicate route: ' + key);
      routes.set(key, handler);
    }]));
  const requireActor = async header => {
    assert.equal(header, 'Bearer verified');
    sessions++;
    return { ...actor };
  };
  const posts = {
    publish: async () => post, feed: async () => ({items:[post],nextCursor:null}),
    receiptByRequest: async () => post, mine: async () => [post],
    saved: async () => [post], removeOwn: async () => post,
    reaction: async () => ({enabled:true}),
    comments: async () => [], commentsPage: async () => ({items:[],nextCursor:null}),
    comment: async () => ({}), removeOwnComment: async () => ({removed:true}),
  };
  const following = {
    set: async () => ({following:true}), status: async () => ({following:false}),
    creatorFeed: async () => ({items:[post],nextCursor:null}),
    feed: async () => ({items:[post],nextCursor:null}),
  };
  const playback = {
    ticket: async () => ({url:'https://media.example/test',expiresAtMs:12345}),
    countListen: async () => ({counted:true,listenCount:1}),
  };
  const report = {
    repository:{byId:async () => post},
    visibility:{canView:async () => true},
    safety:{report:async () => ({accepted:true,reportId:'report1'})},
  };
  return {app,routes,requireActor,posts,following,playback,report,
    get sessions(){return sessions;}};
}
function reply() {
  return { status:200, headers:{}, body:null,
    header(key,val){this.headers[key]=val;return this;},
    code(value){this.status=value;return this;},
    send(value){this.body=value;return value;} };
}
test('registers all 20 canonical post/social/private playback/report routes once', () => {
  const f=fixture();
  registerPublishedAudioFeatureRoutes(f.app, f);
  assert.equal(f.routes.size, 20);
  for (const key of [
    'POST /v1/audio-posts',
    'GET /v1/audio-posts',
    'GET /v1/audio-posts/requests/:requestId',
    'GET /v1/audio-posts/mine',
    'GET /v1/audio-posts/mine/page',
    'GET /v1/audio-posts/saved',
    'GET /v1/audio-posts/saved/page',
    'GET /v1/audio-posts/:postId/comments/page',
    'DELETE /v1/audio-posts/:postId/comments/:commentId',
    'PUT /v1/audio-posts/:postId/follow',
    'GET /v1/audio-posts/creators/:authorKind/:authorId',
    'GET /v1/audio-posts/following',
    'POST /v1/audio-posts/:postId/listen',
    'GET /v1/audio-posts/:postId/playback',
    'POST /v1/audio-posts/:postId/report',
  ]) assert.ok(f.routes.has(key),key);
});
test('absent canonical auth, moderation or playback refuses partial registration', () => {
  for (const change of [
    f => { f.requireActor=undefined; },
    f => { f.report.safety=undefined; },
    f => { f.report.visibility=undefined; },
    f => { f.playback.ticket=undefined; },
    f => { f.posts.commentsPage=undefined; },
    f => { f.following.creatorFeed=undefined; },
  ]) {
    const f=fixture();change(f);
    assert.throws(() => registerPublishedAudioFeatureRoutes(f.app,f),
      /audio_posts.feature_dependencies_missing/);
    assert.equal(f.routes.size,0);
  }
});
test('published feed, following, playback and report all use the same server session resolver', async () => {
  const f=fixture();registerPublishedAudioFeatureRoutes(f.app,f);
  const auth={authorization:'Bearer verified'};
  const feed=await f.routes.get('GET /v1/audio-posts')(
    {headers:auth,query:{}},reply());
  assert.equal(feed.items[0].postId,'post1');
  const following=await f.routes.get('GET /v1/audio-posts/following')(
    {headers:auth,query:{}},reply());
  assert.equal(following.items[0].postId,'post1');
  const playbackReply=reply();
  const playback=await f.routes.get('GET /v1/audio-posts/:postId/playback')(
    {headers:auth,params:{postId:'post1'}},playbackReply);
  assert.equal(playback.url,'https://media.example/test');
  assert.equal(playbackReply.headers['Cache-Control'],'private, no-store');
  const reported=reply();
  const receipt=await f.routes.get('POST /v1/audio-posts/:postId/report')(
    {headers:auth,params:{postId:'post1'},body:{
      reason:'spam',clientRequestId:'request1',
    }},reported);
  assert.equal(receipt.reportId,'report1');
  assert.equal(reported.status,202);
  assert.equal(f.sessions,5); // report performs a second active-session check
});

test('new My Talks and Saved routes use the active server account and reject forged cursor inputs',async()=>{
 const f=fixture();
 const calls=[];
 f.posts.libraryPage=async (who,query)=>{
   calls.push({who,query});
   return {items:[],nextCursor:null};
 };
 registerPublishedAudioFeatureRoutes(f.app,f);
 const auth={authorization:'Bearer verified'};
 const mine=await f.routes.get('GET /v1/audio-posts/mine/page')(
   {headers:auth,query:{limit:'20'}},reply());
 const saved=await f.routes.get('GET /v1/audio-posts/saved/page')(
   {headers:auth,query:{}},reply());
 assert.deepEqual(mine,{items:[],nextCursor:null});
 assert.deepEqual(saved,{items:[],nextCursor:null});
 assert.deepEqual(calls.map(v=>v.query.kind),['mine','saved']);
 assert.ok(calls.every(v=>v.who.accountId==='alice' && v.who.tenantId==='tenant1'));
 assert.equal(f.sessions,2);
 const response=reply();
 await f.routes.get('GET /v1/audio-posts/saved/page')(
   {headers:auth,query:{accountId:'bob'}},response);
 assert.equal(response.status,400);
 assert.equal(response.body.code,'VALIDATION');
 assert.equal(f.sessions,2);
});
