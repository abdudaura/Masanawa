import {describe,it,expect} from 'vitest';
import Fastify from 'fastify';
import {registerMasanaRehearsalRoutes,type MasanaRehearsalStore} from './rehearsal_routes.js';
import type {MasanaAuth} from './service.js';
describe('A04 staff-only rehearsal API',()=>{
 const calls:string[]=[];
 const store:MasanaRehearsalStore={
  async enqueue(i){calls.push(i.tenantId+':'+i.staffId+':'+i.mode);return {runId:'run_1',state:'queued',reused:false}},
  async read(i){calls.push('read:'+i.staffId);return i.staffId==='other'?null:{runId:i.runId,state:'queued'}}
 };
 const auth:MasanaAuth={
  async optional(){throw Error('unused')},async fan(){throw Error('unused')},
  async staff(h){if(h!=='Bearer editor')throw Object.assign(new Error('forbidden'),{statusCode:403});return {tenantId:'tenant_one',userId:'staff_one'}}
 };
 async function setup(enabled=true){const app=Fastify();registerMasanaRehearsalRoutes(app,{auth,store,enabled:()=>enabled});await app.ready();return app}
 const payload={revision:3,mode:'post',prompt:'Write a draft',idempotencyKey:'request_123'};
 it('denies fan, even if body spoofs staff and tenant',async()=>{
  calls.length=0;const app=await setup();
  const r=await app.inject({method:'POST',url:'/v1/admin/masana/gwani/rehearsals',headers:{authorization:'Bearer fan'},payload:{...payload,staffId:'admin',tenantId:'other'}});
  expect(r.statusCode).toBe(403);expect(calls).toEqual([]);await app.close();
 });
 it('uses only canonical auth, returns pending not a fabricated result',async()=>{
  calls.length=0;const app=await setup();
  const r=await app.inject({method:'POST',url:'/v1/admin/masana/gwani/rehearsals',headers:{authorization:'Bearer editor'},payload:{...payload,staffId:'other',tenantId:'other'}});
  expect(r.statusCode).toBe(202);expect(r.json().state).toBe('queued');expect(calls).toEqual(['tenant_one:staff_one:post']);await app.close();
 });
 it('refuses unsupported work and disabled feature before database write',async()=>{
  calls.length=0;const app=await setup();
  const r=await app.inject({method:'POST',url:'/v1/admin/masana/gwani/rehearsals',headers:{authorization:'Bearer editor'},payload:{...payload,mode:'live'}});
  expect(r.statusCode).toBe(400);expect(calls).toEqual([]);await app.close();
  const off=await setup(false);
  const s=await off.inject({method:'POST',url:'/v1/admin/masana/gwani/rehearsals',headers:{authorization:'Bearer editor'},payload});
  expect(s.statusCode).toBe(503);expect(calls).toEqual([]);await off.close();
 });
});