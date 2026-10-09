import { createHash, createHmac } from 'node:crypto';
import { MAX_BYTES } from './model.js';
import type { ArtifactObjectStore } from './model.js';

const hash = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
const mac = (k: Buffer | string, s: string) => createHmac('sha256',k).update(s).digest();
/** U07 content adapter to the existing private S3 deployment; follows C04 private proxy/SSE policy.
 * Does not provision buckets, publish URLs, change C04 codecs or expose storage credentials. */
export function createArtifactS3(input: {
  endpoint:string; region:string; bucket:string; accessKey:string; secretKey:string;
  fetchImpl?:typeof fetch; now?:()=>Date;
}): ArtifactObjectStore & { isAbsent(key:string):Promise<boolean> } {
  const origin = new URL(input.endpoint);
  if (origin.protocol !== 'https:' || origin.pathname !== '/' || origin.username || origin.password || origin.search || origin.hash ||
    !/^[a-z0-9][a-z0-9.-]{2,62}$/.test(input.bucket) || input.bucket.includes('..') ||
    !/^[a-z0-9-]{2,48}$/.test(input.region) || !input.accessKey.trim() || input.secretKey.length < 16) throw new TypeError('Invalid private store config');
  const fetcher = input.fetchImpl ?? fetch;
  async function request(method:'GET'|'PUT'|'DELETE'|'HEAD',key:string,body:Buffer=Buffer.alloc(0)) {
    if (!/^work-artifacts\/[a-f0-9]{64}\/media-artifact_[a-f0-9-]{36}\.txt$/.test(key)) throw new TypeError('Invalid artifact object key');
    const url = new URL(origin); url.pathname = '/'+[input.bucket,...key.split('/')].map(encodeURIComponent).join('/');
    const stamp = (input.now?.() ?? new Date()).toISOString().replace(/[:-]|\.\d{3}/g,'');
    const day=stamp.slice(0,8), scope=`${day}/${input.region}/s3/aws4_request`, payload=hash(body);
    const headers:Record<string,string> = {host:url.host,'x-amz-content-sha256':payload,'x-amz-date':stamp};
    if (method==='PUT') { headers['content-type']='text/plain; charset=utf-8'; headers['x-amz-server-side-encryption']='AES256'; headers['cache-control']='no-store'; }
    const names=Object.keys(headers).sort(), signed=names.join(';');
    const canonical=[method,url.pathname,'',names.map(k=>`${k}:${headers[k]}\n`).join(''),signed,payload].join('\n');
    const signing=mac(mac(mac(mac('AWS4'+input.secretKey,day),input.region),'s3'),'aws4_request');
    const signature=createHmac('sha256',signing).update(['AWS4-HMAC-SHA256',stamp,scope,hash(canonical)].join('\n')).digest('hex');
    headers.authorization=`AWS4-HMAC-SHA256 Credential=${input.accessKey}/${scope}, SignedHeaders=${signed}, Signature=${signature}`;
    return fetcher(url,{method,headers,...(method==='PUT'?{body:new Uint8Array(body)}:{}),redirect:'error',signal:AbortSignal.timeout(15000)});
  }
  return {
    async isAbsent(key) {
      // Current-key readability probe only. Versioned/retained objects require a separate
      // qualified erasure policy; HEAD 404 does not prove physical deletion of old versions.
      const response=await request('HEAD',key); await response.body?.cancel();
      // Access denied, server errors and timeouts never prove erasure.
      if (response.status===404) return true;
      if (response.ok) return false;
      throw new Error('artifact_erasure_unverified');
    },
    async put(key,bytes) {
      if (!Buffer.isBuffer(bytes) || bytes.length<1 || bytes.length>MAX_BYTES) throw new TypeError('Invalid artifact size');
      const response=await request('PUT',key,bytes);
      await response.body?.cancel();
      if (!response.ok) throw new Error('artifact_write_failed');
    },
    async get(key,maxBytes) {
      if (!Number.isSafeInteger(maxBytes) || maxBytes<1 || maxBytes>MAX_BYTES) throw new TypeError('Invalid read bound');
      const response=await request('GET',key);
      if (!response.ok || !response.body) { await response.body?.cancel(); throw new Error('artifact_read_failed'); }
      const reader=response.body.getReader(), chunks:Buffer[]=[]; let size=0;
      try {
        for (;;) {
          const part=await reader.read(); if (part.done) break;
          size+=part.value.length; if(size>maxBytes) {await reader.cancel(); throw new Error('artifact_too_large');}
          chunks.push(Buffer.from(part.value));
        }
      } finally {reader.releaseLock();}
      return Buffer.concat(chunks,size);
    },
    async delete(key) {
      const response=await request('DELETE',key); await response.body?.cancel();
      if (!response.ok && response.status!==404) throw new Error('artifact_delete_failed');
    },
  };
}
