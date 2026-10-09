import test from "node:test";
import assert from "node:assert/strict";
import {parseOperatorProposal,authorizeOperatorProposal,verifyIssuedApproval,admitTaskExecution,advanceTaskPhase,validateTaskEventPage,selectOperatorCard} from "../src/index.js";
const principal={tenantId:"tenant_1",userId:"user_1",accountId:"account_1",sessionId:"character-session_1",deviceId:"device_1"};
const proposal={requestId:"request_0199abcd-1234-7123-8123-123456789abc",capabilityId:"wallet.balance.read",capabilityVersion:1,untrustedArguments:{currency:"NGN"}};
const descriptor={id:"wallet.balance.read",version:1,enabled:true,executionClass:"read",scopes:["private-assistant"],regions:["NG"],argumentKeys:["currency"]};
const admit=(more={})=>authorizeOperatorProposal({proposal:parseOperatorProposal(proposal),catalog:[descriptor],principal,scope:"private-assistant",region:"NG",authorizeCapability:()=>true,authorizeContext:()=>true,...more});
test("strict proposals reject forged model authority, unknown keys and versions",()=>{
  assert.equal(parseOperatorProposal(proposal).capabilityId,proposal.capabilityId);
  for(const bad of [{...proposal,userId:"user_2"},{...proposal,untrustedArguments:{approval:true}},{...proposal,untrustedArguments:JSON.parse('{"__proto__":"x"}')},{...proposal,untrustedArguments:{account_id:"another"}},{...proposal,capabilityVersion:0}]){
    assert.throws(()=>parseOperatorProposal(bad));
  }
});
test("capability admission is exact and server-authorized",()=>{
  assert.equal(admit().classification,"read");
  assert.throws(()=>admit({scope:"human-dm"}),{code:"not_qualified"});
  assert.throws(()=>admit({catalog:[{...descriptor,version:2}]}),{code:"not_qualified"});
  assert.throws(()=>admit({authorizeCapability:()=>false}),{code:"not_authorized"});
  assert.throws(()=>admit({authorizeCapability:null}),{code:"missing_authorizer"});
  assert.throws(()=>admit({proposal:{...proposal,untrustedArguments:{approved:true}}}),{code:"privileged_argument"});
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
  assert.throws(()=>verifyIssuedApproval({...data,principal:{...principal,accountId:"account_2"}}),{code:"approval_invalid"});
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

test("asynchronous, truthy and throwing permission callbacks cannot grant access",()=>{
  assert.throws(()=>admit({authorizeCapability:()=>Promise.resolve(true)}),{code:"not_authorized"});
  assert.throws(()=>admit({authorizeCapability:()=>Promise.resolve(false)}),{code:"not_authorized"});
  assert.throws(()=>admit({authorizeCapability:()=>1}),{code:"not_authorized"});
  assert.throws(()=>admit({authorizeCapability:()=>{throw new Error("sensitive backend detail")}}),{code:"not_authorized"});
  const selected=parseOperatorProposal({...proposal,contextRef:{kind:"dm-selected-message",id:"message_1"}});
  assert.throws(()=>admit({proposal:selected,authorizeContext:()=>Promise.resolve(false)}),{code:"not_authorized"});
  assert.throws(()=>admit({proposal:selected,authorizeContext:()=>{throw new Error("private contact state")}}),{code:"not_authorized"});
  assert.equal(admit({proposal:selected,authorizeContext:()=>true}).classification,"read");
});

test("duplicate capability versions and blank identities are fail closed",()=>{
  assert.throws(()=>admit({catalog:[descriptor,{...descriptor,enabled:false}]}),{code:"invalid_catalog"});
  assert.throws(()=>admit({principal:{...principal,tenantId:"  "}}),{code:"invalid_string"});
});

test("persisted approval must bind real, present identity and exact nonempty transaction refs",()=>{
  const issued={state:"issued",ticketId:"opaque-approval",...principal,operationId:"operation_1",capabilityId:"billing.purchase.confirm",capabilityVersion:1,revision:"revision_1",issuedAtMs:100,expiresAtMs:200,terms:{amountMinor:"10000",currency:"NGN"}};
  const expected={operationId:issued.operationId,capabilityId:issued.capabilityId,capabilityVersion:1,revision:issued.revision,terms:{currency:"NGN",amountMinor:"10000"}};
  const valid={issued,presentedTicketId:issued.ticketId,principal,expected,now:150};
  assert.equal(verifyIssuedApproval(valid).ticketId,"opaque-approval");
  for(const bad of [
    {...valid,issued:{...issued,tenantId:undefined},principal:{...principal,tenantId:undefined}},
    {...valid,issued:{...issued,deviceId:undefined},principal:{...principal,deviceId:undefined}},
    {...valid,issued:{...issued,accountId:""},principal:{...principal,accountId:""}},
    {...valid,issued:{...issued,operationId:undefined},expected:{...expected,operationId:undefined}},
    {...valid,issued:{...issued,revision:""},expected:{...expected,revision:""}},
    {...valid,issued:{...issued,issuedAtMs:-1}},
    {...valid,issued:{...issued,expiresAtMs:100}},
    {...valid,issued:{...issued,expiresAtMs:900200}},
    {...valid,issued:{...issued,capabilityVersion:0},expected:{...expected,capabilityVersion:0}},
    {...valid,issued:{...issued,state:"used"}},
    {...valid,presentedTicketId:""}
  ]) assert.throws(()=>verifyIssuedApproval(bad),{code:"approval_invalid"});
});


test("authorization callbacks cannot rewrite admitted identity or capability classification",()=>{
  const candidate={...descriptor,scopes:[...descriptor.scopes],regions:[...descriptor.regions],argumentKeys:[...descriptor.argumentKeys]};
  const caller={...principal};
  let capabilityView, principalView;
  const admitted=admit({catalog:[candidate],principal:caller,authorizeCapability:({capability,principal:authenticated})=>{
    capabilityView=capability;
    principalView=authenticated;
    // A policy callback may reference and mutate its original inputs, but the
    // authorization decision must keep the exact server-checked snapshot.
    candidate.id="crypto.transfer.confirm";
    candidate.executionClass="financial";
    candidate.enabled=false;
    candidate.scopes.push("human-dm");
    candidate.regions.push("XX");
    candidate.argumentKeys.push("recipient");
    caller.tenantId="attacker_tenant";
    return true;
  }});
  assert.equal(admitted.classification,"read");
  assert.equal(admitted.capability.id,"wallet.balance.read");
  assert.equal(admitted.capability.enabled,true);
  assert.deepEqual(admitted.capability.scopes,["private-assistant"]);
  assert.deepEqual(admitted.capability.regions,["NG"]);
  assert.deepEqual(admitted.capability.argumentKeys,["currency"]);
  assert.equal(principalView.tenantId,"tenant_1");
  assert.equal(capabilityView,admitted.capability);
  assert.notEqual(admitted.capability,candidate);
  assert.notEqual(principalView,caller);
  assert.equal(Object.isFrozen(admitted.capability),true);
  assert.equal(Object.isFrozen(admitted.capability.scopes),true);
  assert.equal(Object.isFrozen(admitted.capability.regions),true);
  assert.equal(Object.isFrozen(admitted.capability.argumentKeys),true);
  assert.equal(Object.isFrozen(principalView),true);
});

test("context authorization sees the same checked principal snapshot",()=>{
  const caller={...principal};
  const selected=parseOperatorProposal({...proposal,contextRef:{kind:"dm-selected-message",id:"message_1"}});
  let seenUser;
  assert.equal(admit({proposal:selected,principal:caller,authorizeCapability:()=>{
    caller.userId="different_user";
    return true;
  },authorizeContext:({principal:authenticated})=>{
    seenUser=authenticated.userId;
    return authenticated.userId==="user_1";
  }}).classification,"read");
  assert.equal(seenUser,"user_1");
});

test("catalog accessors cannot relabel a read as a financial capability",()=>{
  const changing={...descriptor,executionClass:"financial"};
  let reads=0;
  Object.defineProperty(changing,"id",{enumerable:true,get:()=>++reads===1?"wallet.balance.read":"billing.purchase.confirm"});
  let policyCalls=0;
  assert.throws(()=>admit({catalog:[changing],authorizeCapability:()=>{policyCalls++;return true}}),{code:"invalid_catalog"});
  assert.equal(policyCalls,0);
  const changingVersion={...descriptor};
  Object.defineProperty(changingVersion,"version",{enumerable:true,get:()=>1});
  assert.throws(()=>admit({catalog:[changingVersion]}),{code:"invalid_catalog"});
  assert.equal(admit().capability.id,"wallet.balance.read");
});

test("policy principal and catalog must contain data, not computed identity fields",()=>{
  const changingIdentity={...principal};
  Object.defineProperty(changingIdentity,"userId",{enumerable:true,get:()=>"user_1"});
  let calls=0;
  assert.throws(()=>admit({principal:changingIdentity,authorizeCapability:()=>{calls++;return true}}),{code:"invalid_shape"});
  assert.equal(calls,0);
  const catalog=[descriptor,{...descriptor,id:"agents.directory.read",enabled:false}];
  assert.equal(admit({catalog}).classification,"read");
});

test("task success rejects blank, whitespace-padded or control-character receipts",()=>{
  for(const domainReceiptId of ["      "," receipt_real","receipt_real ","receipt_\u0000real", "x".repeat(257)]){
    assert.throws(()=>advanceTaskPhase({from:"running",to:"succeeded",receipt:{domainReceiptId,verifiedReadback:true}}),{code:"missing_authoritative_receipt"});
  }
  assert.equal(advanceTaskPhase({from:"running",to:"succeeded",receipt:{domainReceiptId:"receipt_real",verifiedReadback:true}}),"succeeded");
});
