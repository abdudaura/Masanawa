import type { FastifyInstance } from 'fastify';
import type { PlatformCustomerSessionAuthorizer } from '../customer_auth.js';
import type { ArtifactService } from './service.js';
import { ArtifactError } from './model.js';

const string = {type:'string',minLength:1,maxLength:128};
const params = {type:'object',properties:{id:string},required:['id'],additionalProperties:false};
const object = (properties:Record<string,unknown>,required=Object.keys(properties)) =>
  ({type:'object',properties,required,additionalProperties:false});
/** Register only inside the authenticated Gateway composition. No model or public endpoint can assert provenance. */
export function registerArtifactRoutes(app: FastifyInstance, deps:{
  artifacts:ArtifactService; authorizer:PlatformCustomerSessionAuthorizer;
}) {
  const route = (method:'GET'|'POST'|'DELETE',url:string,schema:any,action:any) => app.route({
    method,url,bodyLimit:300*1024,schema,
    async handler(request,reply) {
      reply.header('Cache-Control','no-store, private').header('X-Content-Type-Options','nosniff');
      try {
        const actor = await deps.authorizer.authorize({authorizationHeader:request.headers.authorization});
        const result = await action(actor, request, reply);
        // Do not return bytes/metadata after a session was revoked during I/O.
        const current = await deps.authorizer.authorize({authorizationHeader:request.headers.authorization});
        if (actor.tenantId !== current.tenantId || actor.userId !== current.userId) throw new ArtifactError('unauthorized',401);
        if (url === '/work-artifacts/:id/download') {
          reply.type(result.mimeType)
            .header('Content-Disposition',`attachment; filename="artifact.txt"; filename*=UTF-8''${encodeURIComponent(result.filename)}`)
            .header('X-Artifact-SHA256',result.sha256);
          return result.bytes;
        }
        return result;
      } catch (error) {
        const status = error instanceof ArtifactError ? error.statusCode :
          error && typeof error === 'object' && 'statusCode' in error &&
          (error.statusCode === 401 || error.statusCode === 403) ? error.statusCode : 503;
        return reply.code(status).type('application/json').send({code:error instanceof ArtifactError ? error.code : status===503?'artifact_service_unavailable':'unauthorized'});
      }
    },
  });
  route('GET','/work-artifacts',{querystring:object({after:string},[])},(a:any,r:any)=>deps.artifacts.list(a,r.query.after));
  route('POST','/work-artifacts/text',{body:object({requestId:string,
    filename:{type:'string',minLength:5,maxLength:84},text:{type:'string',minLength:1,maxLength:262144},
    ttlSeconds:{type:'integer',minimum:60,maximum:2592000}})},(a:any,r:any)=>deps.artifacts.saveText(a,r.body));
  route('GET','/work-artifacts/:id',{params},(a:any,r:any)=>deps.artifacts.get(a,r.params.id));
  route('POST','/work-artifacts/:id/recover',{params,body:object({})},(a:any,r:any)=>deps.artifacts.recover(a,r.params.id));
  route('POST','/work-artifacts/:id/ticket',{params,body:object({})},(a:any,r:any)=>deps.artifacts.ticket(a,r.params.id));
  route('POST','/work-artifacts/:id/download',{params,body:object({ticket:{type:'string',minLength:1,maxLength:2048}})},
    (a:any,r:any)=>deps.artifacts.download(a,r.params.id,r.body.ticket));
  route('POST','/work-artifacts/:id/share',{params,body:object({revision:{type:'integer',minimum:1},
    recipientUserId:string,ttlSeconds:{type:'integer',minimum:60,maximum:86400}})},
    (a:any,r:any)=>deps.artifacts.share(a,r.params.id,r.body.revision,r.body.recipientUserId,r.body.ttlSeconds));
  route('POST','/work-artifacts/:id/revoke',{params,body:object({revision:{type:'integer',minimum:1}})},
    (a:any,r:any)=>deps.artifacts.revoke(a,r.params.id,r.body.revision));
  route('DELETE','/work-artifacts/:id',{params},(a:any,r:any)=>deps.artifacts.remove(a,r.params.id));
}
