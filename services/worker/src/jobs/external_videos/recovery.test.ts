import {describe,expect,it,vi} from "vitest";
import {applyVerifiedVideoWithdrawal,type Withdrawal} from "./recovery.js";
const item:Withdrawal={tenantId:"tenant1",itemId:"00000000-0000-4000-a000-000000000001",provider:"youtube",providerVideoId:"abcDE12_-34"};
const official={provider:"youtube" as const,providerVideoId:item.providerVideoId,status:"officially_removed" as const,evidenceReference:"official-api-withdrawal-1234"};
describe("J15 video withdrawal safe demotion",()=>{
  it("does nothing when disabled and never probes providers",async()=>{
    const verify=vi.fn(async()=>official),review=vi.fn(async()=>({reviewState:"unavailable"}));
    expect(await applyVerifiedVideoWithdrawal(item,{enabled:false,verifyOfficialWithdrawal:verify,reviewStore:{review}})).toBe("disabled");
    expect(verify).not.toHaveBeenCalled();expect(review).not.toHaveBeenCalled();
  });
  it("rejects spoofed provider/ID and unverified ambiguous evidence",async()=>{
    const review=vi.fn(async()=>({reviewState:"unavailable"}));
    for(const value of [null,{...official,provider:"tiktok" as const},{...official,providerVideoId:"different"},{...official,evidenceReference:"bad"}]){
      expect(await applyVerifiedVideoWithdrawal(item,{enabled:true,verifyOfficialWithdrawal:async()=>value,reviewStore:{review}})).toBe("ignored");
    }
    expect(review).not.toHaveBeenCalled();
  });
  it("demotes only still-approved items, leaving staff re-review in pending",async()=>{
    const review=vi.fn().mockResolvedValueOnce({reviewState:"unavailable"}).mockResolvedValueOnce(null);
    const deps={enabled:true,verifyOfficialWithdrawal:async()=>official,reviewStore:{review}};
    expect(await applyVerifiedVideoWithdrawal(item,deps)).toBe("unavailable");
    expect(review).toHaveBeenCalledWith(expect.objectContaining({tenantId:item.tenantId,expectedState:"approved",state:"unavailable",reasonReference:official.evidenceReference}));
    expect(await applyVerifiedVideoWithdrawal(item,deps)).toBe("ignored");
  });
});
