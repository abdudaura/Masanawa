import {describe,it,expect} from "vitest";
import {readHistoryPageSize,readHistoryCursor,makeHistoryCursor} from "./policy.js";
describe("C18 privacy-first pagination contract",()=>{
  const id="call_0199f0d0-0000-7000-8000-000000000005";
  it("limits resource use and refuses array/coerced/unbounded limits",()=>{
    expect(readHistoryPageSize(undefined)).toBe(20);
    expect(readHistoryPageSize("30")).toBe(30);
    for(const n of ["0","31","1e3","02",["5"],null,100]){
      expect(()=>readHistoryPageSize(n)).toThrow();
    }
  });
  it("round trips stable, bounded tuple cursor and rejects forged SQL strings",()=>{
    const c=makeHistoryCursor("2026-10-11T07:00:00.000Z",id);
    expect(readHistoryCursor(c)).toEqual({createdAt:"2026-10-11T07:00:00.000Z",callId:id});
    for(const v of ["", "2026-10-11|x",c+"' OR 1=1",c.replace("000Z","999+01:00"),["x"]]){
      expect(()=>readHistoryCursor(v)).toThrow();
    }
  });
});
