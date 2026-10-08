import test from "node:test";
import assert from "node:assert/strict";
import {parseOperatorProposal,authorizeOperatorProposal,verifyIssuedApproval,admitTaskExecution,advanceTaskPhase,validateTaskEventPage,selectOperatorCard} from "../src/index.js";
const principal={tenantId:"tenant_1",userId:"user_1",sessionId:"character-session_1",deviceId:"device_1"};
const proposal={requestId:"request_0199abcd-1234-7123-8123-123456789abc",capabilityId:"wallet.balance.read",capabilityVersion:1,untrustedArguments:{currency:"NGN"}};
const descriptor={id:"wallet.balance.read",version:1,enabled:true,executionClass:"read",scopes:["private-assistant"],regions:["NG"],argumentKeys:["currency"]};
const admit=(more={})=>authorizeOperatorProposal({proposal:parseOperatorProposal(proposal),catalog:[descriptor],principal,scope:"private-assistant",region:"NG",authorizeCapability:()=>true,authorizeContext:()=>true,...more});
test("strict proposals reject forged model authority, unknown keys and versions",()=>{
  assert.equal(parseOperatorProposal(proposal).capabilityId,proposal.capabilityId);
  for(const bad of [{...proposal,userId:"user_2"},{...proposal,untrustedArguments:{approval:true}},{...proposal,untrustedArguments:JSON.parse('{"__proto__":"x"}')},{...proposal,capabilityVersion:0}]){
    assert.throws(()=>parseOperatorProposal(bad));
  }
});
test("capability admission is exact and server-authorized",()=>{
  assert.equal(admit().classification,"read");
  assert.throws(()=>admit({scope:"human-dm"}),{code:"not_qualified"});
  assert.throws(()=>admit({catalog:[{...descriptor,version:2}]}),{code:"not_qualified"});
  assert.throws(()=>admit({authorizeCapability:()=>false}),{code:"not_authorized"});
  assert.throws(()=>admit({authorizeCapability:null}),{code:"missing_authorizer"});
  assert.throws(()=>admit({proposal:parseOperatorProposal({...proposal,untrustedArguments:{secretItem:"x"}})}),{code:"unknown_argument"});
});
test("selected human DM refs require separate current membership consent",()=>{
  const p=parseOperatorProposal({...proposal,contextRef:{kind:"dm-selected-message",id:"message_1"}});
  assert.throws(()=>admit({proposal:p,authorizeContext:()=>false}),{code:"not_authorized"});
});
test("persisted issued approval is bound to identity, exact terms and expiration",()=>{
  const issued={state:"issued",ticketId:"opaque-approval",...principal,operationId:"operation_1",capabilityId:"billing.purchase.confirm",capabilityVersion:1,revision:"revision_1",issuedAtMs:100,expiresAtMs:200,terms:{amountMinor:"10000",currency:"NGN",to:"07010102053"}};
  const expected={operationId:issued.operationId,capabilityId:issued.capabilityId,capabilityVersion:1,revision:issued.revision,terms:{to:"07010102053",currency:"NGN",amountMinor:"10000"}};
  const data={issued,presentedTicketId:issued.ticketId,principal,expected,now:150};
  assert.equal(verifyIssuedApproval(data).operationId,"operation_1");
  assert.throws(()=>verifyIssuedApproval({...data,now:200}),{code:"approval_invalid"});
  assert.throws(()=>verifyIssuedApproval({...data,principal:{...principal,userId:"other"}}),{code:"approval_invalid"});
  assert.throws(()=>verifyIssuedApproval({...data,expected:{...expected,terms:{...expected.terms,amountMinor:"99999"}}}),{code:"approval_terms_changed"});
});
test("state machine refuses model-invented success and generic financial yes",()=>{
  assert.throws(()=>admitTaskExecution({phase:"prepared",classification:"financial",approvalVerified:false}),{code:"approval_required"});
  assert.equal(admitTaskExecution({phase:"awaiting_approval",classification:"financial",approvalVerified:true}),"running");
  assert.throws(()=>advanceTaskPhase({from:"running",to:"succeeded"}),{code:"missing_authoritative_receipt"});
  assert.equal(advanceTaskPhase({from:"reconciling",to:"succeeded",receipt:{domainReceiptId:"receipt_real",verifiedReadback:true}}),"succeeded");
  assert.throws(()=>advanceTaskPhase({from:"succeeded",to:"running"}),{code:"illegal_transition"});
});
test("event cursor and unknown client revision fail closed",()=>{
  assert.deepEqual(validateTaskEventPage({taskId:"task_1",afterRevision:0,events:[{taskId:"task_1",revision:1,phase:"proposed",at:"2026-10-09T00:00:00Z"}]}),{nextRevision:1,count:1});
  assert.throws(()=>validateTaskEventPage({taskId:"task_1",afterRevision:0,events:[{taskId:"task_1",revision:2,phase:"proposed",at:"now"}]}),{code:"invalid_event_page"});
  assert.deepEqual(selectOperatorCard({card:{version:99,kind:"approval",message:"Approve"},supportedVersions:[1]}),{version:1,kind:"unsupported",message:"This task requires a newer Masanawa app. No action has been executed here.",actionable:false});
});
