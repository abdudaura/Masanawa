import Fastify from "fastify";
import {describe,it,expect} from "vitest";
import {registerOperatorSchedulingRoutes} from "./routes.js";

function setup(){
  const app=Fastify();
  let called=0;
  registerOperatorSchedulingRoutes(app,{
    async list(header){
      if(header!=="Bearer alice") throw Object.assign(new Error("Unauthorized"),{statusCode:401});
      called++;return [];
    },
    async create(input){
      if(input.authorizationHeader!=="Bearer alice")
        throw Object.assign(new Error("Unauthorized"),{statusCode:401});
      called++;
      return {id:"id"};
    },
    async change(input){
      if(input.authorizationHeader!=="Bearer alice")
        throw Object.assign(new Error("Unauthorized"),{statusCode:401});
      called++;
      return {id:input.scheduleId};
    },
  });
  return {app,get called(){return called;}};
}
describe("U25 strict API ingress",()=>{
  it("requires bearer session on list",async()=>{
    const {app}=setup();
    const r=await app.inject({method:"GET",url:"/v1/operator/schedules"});
    expect(r.statusCode).toBe(401);
    await app.close();
  });
  it("rejects unknown and money fields before invoking domain service",async()=>{
    const fixture=setup();
    const r=await fixture.app.inject({method:"POST",url:"/v1/operator/schedules",
      headers:{authorization:"Bearer alice"},
      payload:{requestId:"12345678-1234-4123-8123-123456789abc",
        spec:{kind:"talk_reminder",referenceId:"talk_12345",frequency:"daily",
          timezone:"Africa/Lagos",localTime:"15:00",
          quietStart:"22:00",quietEnd:"07:00",optedIn:true,amount:500}}});
    expect(r.statusCode).toBe(400);
    expect(fixture.called).toBe(0);
    await fixture.app.close();
  });
  it("rejects forged owner or actor override",async()=>{
    const fixture=setup();
    const r=await fixture.app.inject({method:"POST",url:"/v1/operator/schedules",
      headers:{authorization:"Bearer alice"},
      payload:{requestId:"12345678-1234-4123-8123-123456789abc",spec:{
        kind:"talk_reminder",referenceId:"talk_12345",frequency:"daily",
        timezone:"Africa/Lagos",localTime:"15:00",
        quietStart:"22:00",quietEnd:"07:00",optedIn:true,
      },userId:"user_b"}});
    expect(r.statusCode).toBe(400);
    expect(fixture.called).toBe(0);
    await fixture.app.close();
  });
});

