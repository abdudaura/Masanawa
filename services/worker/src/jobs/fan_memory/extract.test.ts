import {describe,it,expect,vi} from "vitest";
import {allowedCandidates,runFanExtraction} from "./extract.js";
const fact={content:"I like cricket",category:"preference",messageId:"m1",
 confidence:0.9,sourceHash:"a".repeat(64)};
describe("J11 extraction gates",()=>{
 it("drops health/religion/politics/financial categories",()=>{
  expect(allowedCandidates([fact,{...fact,category:"religion"},{...fact,category:"health"}])).toHaveLength(1);
 });
 it("does not call the model if consent revoked",async()=>{
  const model=vi.fn().mockResolvedValue([fact]);
  const port={enabled:vi.fn().mockResolvedValue(false),commit:vi.fn()};
  expect(await runFanExtraction(port,{tenantId:"t",relationshipId:"r",authorizedMessageIds:["m1"]},model)).toBe(0);
  expect(model).not.toHaveBeenCalled();
 });
 it("requires final transactional commit-time consent check",async()=>{
  const port={enabled:vi.fn().mockResolvedValue(true),commit:vi.fn().mockResolvedValue(0)};
  expect(await runFanExtraction(port,{tenantId:"t",relationshipId:"r",authorizedMessageIds:["m1"]},async()=>[fact])).toBe(0);
  expect(port.commit).toHaveBeenCalledWith("t","r",[fact],180);
 });
});
