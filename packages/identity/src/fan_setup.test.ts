import {describe,expect,it} from "vitest";
import {FAN_DISCLOSURE_VERSION,parseFanSetupUpdate,FanSetupValidationError} from "./fan_setup.js";
const good=()=>({
  expectedRevision:1,displayName:"Amina Musa",preferredLanguage:"ha",
  interests:["learning","technology"],ageAttested18Plus:true,
  disclosureAccepted:true,disclosureVersion:FAN_DISCLOSURE_VERSION
});
describe("J01 fan setup contract",()=>{
 it("normalizes and retains only permitted fields",()=>{
  const result=parseFanSetupUpdate({...good(),displayName:"  Amina Musa  "});
  expect(result.displayName).toBe("Amina Musa");
  expect(result.ageAttested18Plus).toBe(true);
 });
 it("rejects identity/tenant or elevated role spoofing",()=>{
  for(const field of ["tenantId","userId","role","birthYearVerified","isAdmin"]){
   expect(()=>parseFanSetupUpdate({...good(),[field]:"forged"})).toThrow(FanSetupValidationError);
  }
 });
 it("requires actual age attestation and one-time disclosure",()=>{
  expect(()=>parseFanSetupUpdate({...good(),ageAttested18Plus:false})).toThrow("age_confirmation_required");
  expect(()=>parseFanSetupUpdate({...good(),disclosureAccepted:false})).toThrow("ai_disclosure_required");
  expect(()=>parseFanSetupUpdate({...good(),disclosureVersion:"old"})).toThrow("ai_disclosure_required");
 });
 it("rejects unsafe names and untrusted avatar identifiers",()=>{
  for(const name of ["a","user\u202eadmin","user\nname","x".repeat(61)]){
   expect(()=>parseFanSetupUpdate({...good(),displayName:name})).toThrow("invalid_display_name");
  }
  expect(()=>parseFanSetupUpdate({...good(),avatarMediaId:"https://host.test/avatar.png"})).toThrow("invalid_avatar");
 });
 it("blocks duplicate or forbidden interests and malformed revisions",()=>{
  expect(()=>parseFanSetupUpdate({...good(),interests:["learning","learning"]})).toThrow("invalid_interests");
  expect(()=>parseFanSetupUpdate({...good(),interests:["friends"]})).toThrow("invalid_interests");
  expect(()=>parseFanSetupUpdate({...good(),expectedRevision:-1})).toThrow("invalid_revision");
 });
});
