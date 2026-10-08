import { describe,expect,it,vi } from "vitest";
import { createHash } from "node:crypto";
import { createPrivateVoiceNoteService,VoiceNoteError } from "./service.js";
import type { VoiceNoteRepository, PrivateVoiceObjectStore, VoiceStaged } from "./model.js";
import { validOpus } from "./ogg_opus_test_fixture.js";

const tenantId="tenant_test",userId="user_alice";
const conversationId="00000000-0000-4000-8000-000000000001";
const messageId="00000000-0000-4000-8000-000000000002";
const bytes=validOpus();
function fixture(){
 let grant=true,record:VoiceStaged|undefined;
 const note={messageId,conversationId,clientRequestId:"requestABC1234",
  senderUserId:userId,sequence:"12",createdAt:new Date().toISOString(),
  deletedAt:null,durationMs:1000,sizeBytes:bytes.length,mimeType:"audio/ogg" as const};
 const repository={
  stage:vi.fn(async(value:VoiceStaged)=>grant?(record??=value):"forbidden" as const),
  attach:vi.fn(async()=>grant?note:"forbidden" as const),
  find:vi.fn(async()=>grant&&record?{...note,objectKey:record.objectKey,
   sha256:record.sha256}:null),
  list:vi.fn(async()=>grant?[note]:null),
  remove:vi.fn(async()=>grant),
  stale:vi.fn<VoiceNoteRepository["stale"]>(async()=>[]),
  deleted:vi.fn(async()=>{}),
 } satisfies VoiceNoteRepository;
 const objects={
  put:vi.fn(async()=>{}),get:vi.fn(async()=>bytes),
  delete:vi.fn(async()=>{}),
 } satisfies PrivateVoiceObjectStore;
 const service=createPrivateVoiceNoteService({
  authorizer:{authorize:async()=>({tenantId,userId}) as never},
  repository,objects,
 });
 return {service,repository,objects,note,deny(){grant=false},get record(){return record}};
}
describe("C04 private human voice-note mutation and access contracts",()=>{
 it("sends with authoritative identity and same request key after uncertainty",async()=>{
  const v=fixture();
  const request={authorizationHeader:"Bearer valid",conversationId,
    clientRequestId:"requestABC1234",ogg:bytes};
  expect(await v.service.send(request)).toMatchObject({messageId,senderUserId:userId});
  expect(await v.service.send(request)).toMatchObject({messageId});
  expect(v.repository.stage).toHaveBeenCalledTimes(2);
  expect(v.repository.attach).toHaveBeenCalledTimes(2);
  expect(v.objects.put).toHaveBeenCalledWith(v.record?.objectKey,bytes);
  expect(v.record?.sha256).toBe(createHash("sha256").update(bytes).digest("hex"));
 });
 it("rejects invalid bytes without staging or uploading",async()=>{
  const v=fixture();
  await expect(v.service.send({authorizationHeader:undefined,conversationId,
    clientRequestId:"requestABC1234",ogg:Buffer.from("bad")})).rejects.toBeInstanceOf(VoiceNoteError);
  expect(v.objects.put).not.toHaveBeenCalled();
  expect(v.repository.stage).not.toHaveBeenCalled();
 });
 it("rechecks both sender permission and reader permission after revocation",async()=>{
  const v=fixture();
  await v.service.send({authorizationHeader:"x",conversationId,
    clientRequestId:"requestABC1234",ogg:bytes});
  v.deny();
  await expect(v.service.read({authorizationHeader:"x",messageId}))
    .rejects.toMatchObject({statusCode:404});
  await expect(v.service.send({authorizationHeader:"x",conversationId,
    clientRequestId:"requestABC1234",ogg:bytes})).rejects.toMatchObject({statusCode:404});
  expect(v.objects.get).not.toHaveBeenCalled();
 });
 it("never returns corrupt stored bytes",async()=>{
  const v=fixture();
  await v.service.send({authorizationHeader:"x",conversationId,
    clientRequestId:"requestABC1234",ogg:bytes});
  v.objects.get.mockResolvedValueOnce(Buffer.alloc(bytes.length));
  await expect(v.service.read({authorizationHeader:"x",messageId}))
    .rejects.toMatchObject({statusCode:503});
 });
 it("does not mark private media erased when S3 deletion is uncertain",async()=>{
  const v=fixture();
  v.repository.stale.mockResolvedValueOnce([{objectKey:"dm-voice/test-object"}]);
  v.objects.delete.mockRejectedValueOnce(new Error("provider timeout"));
  expect(await v.service.collectGarbage(1)).toEqual({deleted:0,failed:1});
  expect(v.repository.deleted).toHaveBeenCalledWith("dm-voice/test-object",false);
  v.repository.stale.mockResolvedValueOnce([{objectKey:"dm-voice/test-object"}]);
  expect(await v.service.collectGarbage(1)).toEqual({deleted:1,failed:0});
  expect(v.repository.deleted).toHaveBeenCalledWith("dm-voice/test-object",true);
 });
 it("rejects malformed cursor and bounds without touching repository",async()=>{
  const v=fixture();
  await expect(v.service.list({authorizationHeader:"x",conversationId,before:"9223372036854775808"}))
    .rejects.toMatchObject({statusCode:400});
  expect(v.repository.list).not.toHaveBeenCalled();
 });
});
