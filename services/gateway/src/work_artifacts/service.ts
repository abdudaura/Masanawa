import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { ArtifactError, MAX_BYTES } from './model.js';
import type { Artifact, ArtifactRepository, ArtifactObjectStore, ArtifactView, Owner, Provenance } from './model.js';

const digest = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const fail = (code: string, status = 400): never => { throw new ArtifactError(code, status); };
export function textBytes(text: unknown): Buffer {
  if (typeof text !== 'string' || text.length === 0 || text.length > MAX_BYTES) return fail('invalid_text');
  // Fatal UTF-8 round trip rejects unpaired surrogate replacement. Text is never rendered as HTML.
  const bytes = Buffer.from(text, 'utf8');
  if (bytes.length > MAX_BYTES || bytes.toString('utf8') !== text ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text)) return fail('invalid_text');
  return bytes;
}
export function createArtifactService(input: {
  repository: ArtifactRepository; objects: ArtifactObjectStore; ticketSecret: Buffer;
  createId: () => string; assertId: (kind: string, value: string) => void;
  /** Canonical C01/identity policy, rechecked for each shared read. No permissive default. */
  canShare: (owner: Owner, recipientUserId: string) => Promise<boolean>;
  authorizeTask: (owner: Owner, taskId: string, operationId: string) => Promise<boolean>;
  admitCreation: (owner: Owner) => Promise<boolean>;
  now?: () => Date;
}) {
  if (!Buffer.isBuffer(input.ticketSecret) || input.ticketSecret.length < 32) throw new TypeError('Artifact signing key requires 32 bytes');
  const signingSecret = Buffer.from(input.ticketSecret);
  const now = input.now ?? (() => new Date());
  const repo = input.repository;
  function identity(owner: Owner) {
    try { input.assertId('tenant', owner.tenantId); input.assertId('user', owner.userId); }
    catch { fail('unauthorized', 401); }
  }
  function argumentId(kind: string, value: string) {
    try { input.assertId(kind, value); }
    catch { fail('invalid_reference'); }
  }
  async function owned(owner: Owner, id: string): Promise<Artifact> {
    identity(owner);
    try { input.assertId('media-artifact', id); } catch { return fail('not_found', 404); }
    const row = await repo.find(owner.tenantId, id);
    if (!row || row.userId !== owner.userId) return fail('not_found', 404);
    return row;
  }
  function view(row: Artifact, actor: Owner): ArtifactView {
    return {id:row.id,filename:row.filename,mimeType:row.mimeType,sizeBytes:row.sizeBytes,sha256:row.sha256,
      state:row.state,revision:row.revision,createdAt:row.createdAt,expiresAt:row.expiresAt,
      provenance:row.userId === actor.userId ? row.provenance : {kind:row.provenance.kind}, owned: row.userId === actor.userId,
      sharedWith: row.userId === actor.userId ? row.grants : []};
  }
  async function readable(actor: Owner, id: string): Promise<Artifact> {
    identity(actor);
    try { input.assertId('media-artifact', id); } catch { return fail('not_found', 404); }
    const row = await repo.find(actor.tenantId, id);
    if (!row) return fail('not_found', 404);
    const owner = {tenantId: row.tenantId, userId: row.userId};
    if (row.userId !== actor.userId && (!row.grants.some(g => g.userId === actor.userId && Date.parse(g.expiresAt) > now().getTime()) ||
      !await input.canShare(owner, actor.userId))) return fail('not_found', 404);
    if (row.state !== 'ready' || Date.parse(row.expiresAt) <= now().getTime()) return fail('artifact_unavailable', 410);
    return row;
  }
  async function change(row: Artifact, state = row.state, grants = row.grants): Promise<Artifact> {
    const result = await repo.change({tenantId: row.tenantId, userId: row.userId}, row.id, row.revision, {state, grants});
    return result ?? fail('revision_conflict', 409);
  }
  function verify(bytes: Buffer, row: Artifact) {
    if (bytes.length !== row.sizeBytes || digest(bytes) !== row.sha256) fail('integrity_failed', 502);
    textBytes(new TextDecoder('utf-8', {fatal: true}).decode(bytes));
  }
  async function create(owner: Owner, request: { requestId: string; filename: string; text: string; ttlSeconds: number }, provenance: Provenance) {
    identity(owner);
    argumentId('request', request.requestId);
    if (!/^[\p{L}\p{N}][\p{L}\p{N} _.-]{0,79}\.txt$/u.test(request.filename) || request.filename.includes('..')) fail('invalid_filename');
    if (!Number.isSafeInteger(request.ttlSeconds) || request.ttlSeconds < 60 || request.ttlSeconds > 30 * 86400) fail('invalid_expiry');
    const bytes = textBytes(request.text);
    if (provenance.kind === 'operator') {
      input.assertId('task', provenance.taskId!); input.assertId('operation', provenance.operationId!);
      if (!await input.authorizeTask(owner, provenance.taskId!, provenance.operationId!)) fail('not_found', 404);
    }
    if (!await input.admitCreation(owner)) fail('rate_limited', 429);
    const id = input.createId(); input.assertId('media-artifact', id);
    const at = now();
    const row = await repo.reserve({id, tenantId:owner.tenantId,userId:owner.userId, requestId: request.requestId, filename: request.filename,
      mimeType: 'text/plain; charset=utf-8', sizeBytes: bytes.length, sha256: digest(bytes), provenance,
      objectKey: `work-artifacts/${digest(owner.tenantId + '\0' + owner.userId)}/${id}.txt`,
      state: 'generating', revision: 1, createdAt: at.toISOString(),
      expiresAt: new Date(at.getTime() + request.ttlSeconds * 1000).toISOString(), grants: []});
    // A retry has precisely the same bytes, name, origin and lifetime; it can never replace a file.
    if (row.sha256 !== digest(bytes) || row.filename !== request.filename ||
        JSON.stringify(row.provenance) !== JSON.stringify(provenance) ||
        Date.parse(row.expiresAt) - Date.parse(row.createdAt) !== request.ttlSeconds * 1000) fail('idempotency_conflict', 409);
    if (Date.parse(row.expiresAt) <= now().getTime()) fail('artifact_unavailable', 410);
    if (row.id !== id) return view(row, owner); // Existing pending work is recovered explicitly, never blindly rerun.
    try {
      await input.objects.put(row.objectKey, bytes);
      verify(await input.objects.get(row.objectKey, MAX_BYTES), row);
    } catch {
      await repo.change(owner, row.id, row.revision, {state: 'failed', grants: []});
      return view((await owned(owner, row.id)), owner);
    }
    if (provenance.kind === 'operator' && !await input.authorizeTask(owner,provenance.taskId!,provenance.operationId!)) {
      await change(row,'revoked',[]); return fail('task_not_admitted',403);
    }
    return view(await change(row, 'ready'), owner);
  }
  return {
    saveText: (owner: Owner, request: Parameters<typeof create>[1]) => create(owner, request, {kind: 'user-text'}),
    /** Internal only. The HTTP surface cannot assert operator provenance. */
    generatedText: (owner: Owner, request: Parameters<typeof create>[1], taskId: string, operationId: string) =>
      create(owner, request, {kind: 'operator', taskId, operationId}),
    async list(owner: Owner, after?: string) {
      identity(owner); if (after) argumentId('media-artifact', after);
      const rows = await repo.list(owner, after, 31);
      return {items: rows.slice(0,30).map(row => view(row, owner)), next: rows.length > 30 ? rows[29]!.id : null};
    },
    async get(actor: Owner, id: string) {
      identity(actor);
      const row = await repo.find(actor.tenantId, id);
      return view(row?.userId === actor.userId ? await owned(actor,id) : await readable(actor,id), actor);
    },
    async recover(owner: Owner, id: string) {
      const row = await owned(owner,id);
      if (row.state !== 'generating' && row.state !== 'failed') return view(row,owner);
      if (Date.parse(row.expiresAt) <= now().getTime()) fail('artifact_unavailable',410);
      if (row.provenance.kind==='operator' && !await input.authorizeTask(owner,row.provenance.taskId!,row.provenance.operationId!)) fail('task_not_admitted',403);
      // Status-only recovery after a lost PUT response or process death; no second generator invocation.
      try { verify(await input.objects.get(row.objectKey, MAX_BYTES), row); }
      catch { return view(row,owner); }
      if (row.provenance.kind==='operator' && !await input.authorizeTask(owner,row.provenance.taskId!,row.provenance.operationId!)) fail('task_not_admitted',403);
      return view(await change(row,'ready'),owner);
    },
    async share(owner: Owner, id: string, revision: number, recipient: string, ttlSeconds: number) {
      argumentId('user',recipient);
      const row = await owned(owner,id);
      if (row.revision !== revision) fail('revision_conflict',409);
      if (recipient === owner.userId || !Number.isSafeInteger(ttlSeconds) || ttlSeconds < 60 || ttlSeconds > 86400) fail('invalid_share');
      await readable(owner,id);
      if (!await input.canShare(owner,recipient)) fail('recipient_unavailable',404);
      const grants = row.grants.filter(g => g.userId !== recipient && Date.parse(g.expiresAt) > now().getTime());
      if (grants.length >= 20) fail('share_limit',429);
      grants.push({userId:recipient, expiresAt:new Date(Math.min(Date.parse(row.expiresAt),now().getTime()+ttlSeconds*1000)).toISOString()});
      return view(await change(row,'ready',grants),owner);
    },
    async revoke(owner: Owner, id: string, revision: number) {
      const row = await owned(owner,id);
      if (row.revision !== revision) fail('revision_conflict',409);
      if (row.state === 'deleted' || row.state === 'deleting') fail('artifact_unavailable',410);
      return view(await change(row,'revoked',[]),owner);
    },
    async ticket(actor: Owner, id: string) {
      const row = await readable(actor,id);
      const expiresAt = Math.min(now().getTime()+60000, Date.parse(row.expiresAt));
      const payload = Buffer.from(JSON.stringify({id, tenantId:actor.tenantId, userId:actor.userId, revision:row.revision, expiresAt})).toString('base64url');
      const signature = createHmac('sha256',signingSecret).update(payload).digest('base64url');
      return {ticket:payload+'.'+signature, expiresAt:new Date(expiresAt).toISOString()};
    },
    async download(actor: Owner, id: string, ticket: string) {
      identity(actor);
      if (typeof ticket !== 'string' || ticket.length > 2048) fail('invalid_ticket',403);
      const parts = ticket.split('.'); if (parts.length !== 2) fail('invalid_ticket',403);
      const payload = parts[0]!, signature = parts[1]!;
      const expected = createHmac('sha256',signingSecret).update(payload).digest('base64url');
      if (!/^[A-Za-z0-9_-]{43}$/u.test(signature) || !timingSafeEqual(Buffer.from(signature),Buffer.from(expected))) fail('invalid_ticket',403);
      let claim; try { claim = JSON.parse(Buffer.from(payload,'base64url').toString('utf8')); } catch { return fail('invalid_ticket',403); }
      if (!claim || typeof claim !== 'object' || claim.id !== id || claim.tenantId !== actor.tenantId || claim.userId !== actor.userId || !Number.isFinite(claim.expiresAt) || claim.expiresAt <= now().getTime()) fail('invalid_ticket',403);
      const row = await readable(actor,id);
      if (claim.revision !== row.revision) fail('invalid_ticket',403);
      const bytes = await input.objects.get(row.objectKey,MAX_BYTES); verify(bytes,row);
      const latest = await readable(actor,id); // Revoke/expiry during storage read must prevent delivery.
      if (latest.revision !== row.revision || claim.expiresAt <= now().getTime()) fail('invalid_ticket',403);
      return {bytes, filename:row.filename, sha256:row.sha256, mimeType:row.mimeType};
    },
    async remove(owner: Owner, id: string) {
      let row = await owned(owner,id);
      if (row.state === 'deleted') return view(row,owner);
      if (row.state !== 'deleting') row = await change(row,'deleting',[]);
      await input.objects.delete(row.objectKey); // Failure leaves durable deleting state for retry.
      return view(await change(row,'deleted',[]),owner);
    },
  };
}
export type ArtifactService = ReturnType<typeof createArtifactService>;
