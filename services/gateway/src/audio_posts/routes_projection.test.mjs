import test from "node:test";
import assert from "node:assert/strict";
import { registerAudioPostRoutes } from "./routes.js";
import { AudioPostError } from "./service.js";

const session = Object.freeze({
  tenantId: "private-tenant", accountId: "internal-account",
  authorId: "creator-public-id", authorKind: "human",
});
const privateRecord = Object.freeze({
  tenantId: session.tenantId, postId: "post-1", authorId: session.authorId,
  authorAccountId: session.accountId, authorKind: session.authorKind,
  assetId: "private-media-object", requestId: "replay-secret-key",
  title: "A published audio Talk", durationMs: 45000,
  status: "processing", revision: 0,
  createdAt: "2026-10-10T01:00:00.000Z", publishedAt: null,
  likeCount: 2, commentCount: 3, listenCount: 4,
});

function fixture(overrides = {}) {
  const handlers = new Map();
  const bind = (method) => (path, handler) => handlers.set(method + " " + path, handler);
  const app = {
    get: bind("GET"), post: bind("POST"),
    delete: bind("DELETE"), put: bind("PUT"),
  };
  const calls = [];
  const service = {
    async publish(actor, body) {
      calls.push({kind:"publish",actor,body});
      return privateRecord;
    },
    async removeOwn(actor, postId) {
      calls.push({kind:"remove",actor,postId});
      return {...privateRecord, status:"removed", revision:1};
    },
    ...overrides,
  };
  registerAudioPostRoutes(app, {
    service,
    requireActor: async (authorization) => {
      assert.equal(authorization, "Bearer session-token");
      return session;
    },
  });
  async function request(method, path, params = {}, body = {}) {
    const handler = handlers.get(method + " " + path);
    assert.equal(typeof handler, "function", "route should be registered");
    const reply = {statusCode:200,code(value){this.statusCode=value;return this},send(value){return value}};
    const response = await handler({
      headers:{authorization:"Bearer session-token"},params,body,
    },reply);
    return {response,status:reply.statusCode};
  }
  return {calls,request};
}

function assertPublicReceipt(value) {
  assert.deepEqual(Object.keys(value).sort(), [
    "authorId","authorKind","commentCount","createdAt","durationMs",
    "likeCount","listenCount","postId","publishedAt","revision","status","title",
  ].sort());
  assert.equal(value.authorId, session.authorId);
  assert.equal(value.postId, privateRecord.postId);
  assert.equal(value.likeCount, 2);
  assert.equal(value.commentCount, 3);
  assert.equal(value.listenCount, 4);
  for (const secret of ["tenantId","authorAccountId","assetId","requestId"]) {
    assert.equal(Object.hasOwn(value,secret),false,secret+" must not cross HTTP");
  }
}

test("POST returns the canonical public receipt, never the private source record",async()=>{
  const f=fixture();
  const body={assetId:privateRecord.assetId,requestId:privateRecord.requestId,title:privateRecord.title};
  const {status,response}=await f.request("POST","/audio-posts",{},body);
  assert.equal(status,202);
  assertPublicReceipt(response);
  assert.equal(response.status,"processing");
  assert.deepEqual(f.calls[0],{kind:"publish",actor:session,body});
});

test("DELETE returns a redacted removed receipt and passes through only authenticated actor",async()=>{
  const f=fixture();
  const {status,response}=await f.request("DELETE","/audio-posts/:postId",{postId:"post-1"});
  assert.equal(status,200);
  assertPublicReceipt(response);
  assert.equal(response.status,"removed");
  assert.equal(response.revision,1);
  assert.equal(f.calls[0].actor,session);
  assert.equal(f.calls[0].postId,"post-1");
});

test("failed owner delete is a typed 404 without leaking a hidden post",async()=>{
  const f=fixture({async removeOwn(){throw new AudioPostError("NOT_FOUND","Audio post not found")}});
  const {status,response}=await f.request("DELETE","/audio-posts/:postId",{postId:"post-2"});
  assert.equal(status,404);
  assert.deepEqual(response,{code:"NOT_FOUND",message:"Audio post not found"});
  assert.equal(JSON.stringify(response).includes("private-tenant"),false);
});

test("conflicting publish is a typed 409 and does not leak a record",async()=>{
  const f=fixture({async publish(){throw new AudioPostError("CONFLICT","Publish key was used with different content")}});
  const {status,response}=await f.request("POST","/audio-posts",{},{});
  assert.equal(status,409);
  assert.deepEqual(response,{code:"CONFLICT",message:"Publish key was used with different content"});
});
