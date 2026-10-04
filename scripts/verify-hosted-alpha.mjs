import { pathToFileURL } from 'node:url';

/** Bounded operator smoke check. Tokens, model replies and vendor errors stay private. */
export async function verifyHostedAlpha({ baseUrl, token, fetchImpl = fetch }) {
  if (!token || !baseUrl) throw new Error('Hosted Alpha verification inputs are required');
  const url = new URL(baseUrl);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) {
    throw new Error('Hosted Alpha verification needs HTTPS or loopback');
  }
  async function request(path, body, authenticated = true) {
    let response;
    try {
      response = await fetchImpl(new URL(path, url), {
        method: body === undefined ? 'GET' : 'POST', redirect: 'error',
        headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          ...(authenticated ? { authorization: `Bearer ${token}` } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(body === undefined ? 15_000 : 75_000),
      });
    } catch { throw new Error(`Hosted Alpha ${path} could not complete`); }
    if (!response.ok) throw new Error(`Hosted Alpha ${path} returned HTTP ${response.status}`);
    try { return await response.json(); } catch { throw new Error(`Hosted Alpha ${path} returned an invalid response`); }
  }
  const ready = await request('/readyz', undefined, false);
  if (ready.status !== 'ready') throw new Error('Hosted Alpha is not ready');
  const directory = await request('/v1/agent/directory');
  const characterId = directory.agents?.[0]?.characterId;
  if (typeof characterId !== 'string' || !characterId) throw new Error('Hosted Alpha has no visible agent');
  const session = await request('/v1/agent/sessions/open', { characterId });
  if (typeof session.characterSessionId !== 'string' || !session.characterSessionId) {
    throw new Error('Hosted Alpha did not admit a session');
  }
  const prefix = `/v1/agent/sessions/${encodeURIComponent(session.characterSessionId)}`;
  let closed = false;
  try {
    const text = await request(`${prefix}/turn`, { characterId,
      text: 'This is an operator connection test. Reply with a short greeting.' });
    if (typeof text.reply !== 'string' || !text.reply.trim() || typeof text.agentRunId !== 'string') {
      throw new Error('Hosted Alpha text turn did not return a durable result');
    }
    const media = await request(`${prefix}/media-turn`, { characterId,
      caption: 'Summarize this test document in one sentence.', mimeType: 'text/plain',
      dataBase64: Buffer.from('Masanawa test document: the meeting is at 10 AM on Monday.').toString('base64') });
    if (typeof media.reply !== 'string' || !media.reply.trim() || typeof media.agentRunId !== 'string') {
      throw new Error('Hosted Alpha document turn did not return a durable result');
    }
    await request(`${prefix}/close`, { characterId });
    closed = true;
    return Object.freeze({ readiness: 'passed', directory: 'passed', agentCount: directory.agents.length,
      session: 'passed', textInference: 'passed', documentInference: 'passed', close: 'passed' });
  } finally {
    if (!closed) await request(`${prefix}/close`, { characterId }).catch(() => undefined);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await verifyHostedAlpha({ baseUrl: process.argv[2], token: process.env.MASANAWA_ALPHA_DEV_TOKEN });
    process.stdout.write(`Hosted Alpha verification: ${JSON.stringify(result)}\n`);
  } catch (error) {
    // Only errors constructed above reach logs, with no private response body.
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
