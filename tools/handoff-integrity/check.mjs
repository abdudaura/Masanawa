#!/usr/bin/env node
// Read-only, structural PR evidence verification. A pass NEVER qualifies an E2E release.
const SHA = /^[a-f0-9]{40}$/i;
const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const HANDOFF = /docs\/workstreams\/[A-Za-z0-9_./-]+\.md/g;

export function assessHandoff(pr, changedFiles, handoffs) {
  const errors = [];
  const warnings = [];
  if (pr.state !== 'open' || pr.draft !== true || pr.merged_at) {
    errors.push('PR is not open, unmerged, and draft');
  }
  if (pr.base?.ref !== 'main') errors.push('PR base is not main');
  if (!SHA.test(pr.head?.sha ?? '') || !SHA.test(pr.base?.sha ?? '')) {
    errors.push('Missing full base/head SHA');
  }
  const body = typeof pr.body === 'string' ? pr.body : '';
  if (SHA.test(pr.head?.sha ?? '') && !body.includes(pr.head.sha)) {
    errors.push('PR body does not identify the current head SHA');
  }
  const links = [...new Set(body.match(HANDOFF) ?? [])];
  if (links.length === 0) errors.push('PR body does not link a docs/workstreams/*.md handoff');
  const changed = new Set(changedFiles);
  const evidence = [];
  for (const path of links) {
    if (path.includes('..') || path.startsWith('/')) {
      errors.push(`Unsafe handoff path: ${path}`);
      continue;
    }
    if (!changed.has(path)) {
      errors.push(`Linked handoff is not among PR changed files: ${path}`);
      continue;
    }
    const content = handoffs[path];
    if (typeof content !== 'string' || !content.trim()) {
      errors.push(`Missing committed handoff at PR head: ${path}`);
      continue;
    }
    const hasStatus = /\b(PARTIAL_IMPLEMENTATION|IMPLEMENTED_UNVERIFIED|VERIFIED_E2E|PLANNED|NOT_RUN|BLOCKED)\b/i.test(content);
    const hasTestNotes = /\b(tests?|verification|vitest|flutter analyze|typecheck|node --test)\b/i.test(content);
    const hasDisposition = /\b(unmerged|draft|not deployed|not released|pending integration)\b/i.test(content);
    if (!hasStatus) errors.push(`No qualified implementation status in ${path}`);
    if (!hasTestNotes) errors.push(`No test/verification notes in ${path}`);
    if (!hasDisposition) errors.push(`No draft/integration disposition in ${path}`);
    evidence.push({ path, bytes: Buffer.byteLength(content), statusPresent: hasStatus, testNotesPresent: hasTestNotes });
  }
  if (evidence.some(e => e.statusPresent)) warnings.push('Handoff status and test claims are unverified assertions; run SHA-specific tests independently');
  return { verdict: errors.length ? 'STRUCTURE_FAIL' : 'STRUCTURE_PASS_NOT_E2E', pr: pr.number, headSha: pr.head?.sha, errors, warnings, evidence };
}

export async function checkGitHubHandoff({ repo, number, request }) {
  if (!REPO.test(repo) || !Number.isSafeInteger(number) || number < 1) {
    throw new Error('Expected owner/repo and positive PR number');
  }
  const root = `/repos/${repo}`;
  const pr = await request(`${root}/pulls/${number}`);
  const changed = [];
  for (let page = 1; page <= 30; page++) {
    const files = await request(`${root}/pulls/${number}/files?per_page=100&page=${page}`);
    if (!Array.isArray(files)) throw new Error('Unexpected PR files response');
    changed.push(...files.map(file => file.filename));
    if (files.length < 100) break;
    if (page === 30) throw new Error('PR file list exceeds bounded pagination; unable to verify');
  }
  const paths = [...new Set((pr.body ?? '').match(HANDOFF) ?? [])].filter(p => !p.includes('..'));
  const handoffs = Object.create(null);
  for (const path of paths) {
    if (!changed.includes(path)) continue;
    const encoded = path.split('/').map(encodeURIComponent).join('/');
    const response = await request(`${root}/contents/${encoded}?ref=${encodeURIComponent(pr.head.sha)}`);
    if (response?.encoding !== 'base64' || typeof response.content !== 'string') {
      throw new Error(`Cannot read pinned handoff: ${path}`);
    }
    // GitHub returns base64 content (line wraps allowed); decode only handoff Markdown.
    handoffs[path] = Buffer.from(response.content.replace(/\s/g, ''), 'base64').toString('utf8');
  }
  return assessHandoff(pr, changed, handoffs);
}

export function githubReadOnlyRequest(token = process.env.GITHUB_TOKEN) {
  return async (path) => {
    if (!/^\/repos\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/(pulls\/[0-9]+(\/files\?per_page=100&page=[0-9]+)?|contents\/docs\/workstreams\/[A-Za-z0-9_./%-]+\.md\?ref=[a-f0-9]{40})$/i.test(path)) {
      throw new Error('Disallowed GitHub read path');
    }
    const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (token) headers.Authorization = `Bearer ${token}`;
    let response;
    try { response = await fetch(`https://api.github.com${path}`, { headers, signal: AbortSignal.timeout(10000) }); }
    catch { throw new Error('GitHub read failed (network/timeout)'); }
    if (!response.ok) throw new Error(`GitHub read HTTP ${response.status}`);
    return response.json();
  };
}

const invoked = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (invoked) {
  const [repo, rawNumber] = process.argv.slice(2);
  checkGitHubHandoff({ repo, number: Number(rawNumber), request: githubReadOnlyRequest() })
    .then(result => { console.log(JSON.stringify(result, null, 2)); if (result.errors.length) process.exitCode = 1; })
    .catch(error => { console.error(JSON.stringify({ verdict: 'READ_BLOCKED', error: error.message })); process.exitCode = 2; });
}
