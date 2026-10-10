import { describe, expect, it } from "vitest";
import { createVideoCatalog } from "./catalog.js";
import { admitVerifiedVideo } from "@masanawa/external-videos";
describe("approved only videos projection", () => {
  it("does not expose pending or unavailable videos", async () => {
    const a = admitVerifiedVideo({url:"https://youtu.be/dQw4w9WgXcQ",channelName:"Official",verifiedEmbeddable:true,regionAllowed:true});
    const catalog = createVideoCatalog({list:async()=>({items:[
      {...a,id:"pending",title:"Pending",sourceId:"s"},
      {...a,id:"approved",title:"Approved",sourceId:"s",state:"approved" as const}
    ],nextCursor:null})});
    expect((await catalog.list({tenantId:"t"})).items.map(x=>x.id)).toEqual(["approved"]);
  });
});
