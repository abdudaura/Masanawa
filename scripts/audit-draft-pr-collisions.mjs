#!/usr/bin/env node
/**
 * Read-only PR collision inventory. Reports candidate conflicts, not merge
 * eligibility. The authenticated live mode never writes to GitHub.
 *
 * node scripts/audit-draft-pr-collisions.mjs --snapshot pr-snapshot.json
 * GITHUB_TOKEN=... node scripts/audit-draft-pr-collisions.mjs --live --repo Baatiku/masanawa
 */
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const API = 'https://api.github.com';
const migration = /^(.*\/migrations)\/(\d{3,})(?:[-_][^/]*)?\.sql$/i;
const guarded = /(?:^|\/)(?:app\.ts|main\.ts|app_router\.dart|twin_home_shell\.dart|pnpm-lock\.yaml|google-services\.json|GoogleService-Info\.plist)$/;
const finance = /(?:^|\/)(?:ledger|wallet|custody|commerce|billing|crypto|payout|settlement)(?:\/|[_.-])/i;
const scope = /^(U(?:0[1-9]|[12]\d|30)|F(?:0[1-9]|1[0-8]))\b/i;
const handoff = /docs\/workstreams\/[A-Za-z0-9_.-]+\.md/;
const bad = (message) => { throw new Error('Incomplete PR audit: ' + message); };
const add = (map, key, value) => { if (!map.has(key)) map.set(key, []); map.get(key).push(value); };
const collision = (map, create) => [...map].filter(([, items]) => new Set(items.map(x => x.number)).size > 1)
  .map(([key, items]) => create(key, items.sort((a, b) => a.number - b.number)))
  .sort((a, b) => a.key.localeCompare(b.key));

export function auditSnapshot(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.pulls)) bad('snapshot.pulls must be an array');
  const paths = new Map(), migrations = new Map(), scopes = new Map();
  const missingHandoffPointers = [], incomplete = [], numbers = new Set();
  const pulls = [...snapshot.pulls].sort((a, b) => a.number - b.number);
  for (const pr of pulls) {
    if (!Number.isSafeInteger(pr?.number) || pr.number <= 0 || typeof pr.title !== 'string') bad('invalid PR identity');
    if (numbers.has(pr.number)) bad('duplicate PR #' + pr.number);
    numbers.add(pr.number);
    const head = pr.head?.sha ?? pr.headSha;
    if (!/^[a-f0-9]{40}$/i.test(head || '')) incomplete.push({ number: pr.number, reason: 'missing_head_sha' });
    if (pr.completeFiles !== true || !Array.isArray(pr.files)) incomplete.push({ number: pr.number, reason: 'unverified_file_list' });
    if (pr.headStable === false) incomplete.push({ number: pr.number, reason: 'head_changed_during_audit' });
    if (!handoff.test(pr.body || '')) missingHandoffPointers.push(pr.number);
    const match = pr.title.trim().match(scope);
    if (match) add(scopes, match[1].toUpperCase(), { number: pr.number, headSha: head });
    const seen = new Set();
    for (const file of pr.files || []) {
      if (typeof file?.filename !== 'string' || !file.filename || seen.has(file.filename)) bad('invalid/repeated file in PR #' + pr.number);
      seen.add(file.filename);
      const entry = { number: pr.number, headSha: head, blobSha: file.sha || null, status: file.status || 'unknown' };
      add(paths, file.filename, entry);
      const m = file.filename.match(migration);
      if (m) add(migrations, m[1] + '/' + m[2], { ...entry, filename: file.filename });
    }
  }
  const pathCollisions = collision(paths, (key, prs) => ({
    key, risk: migration.test(key) || guarded.test(key) || finance.test(key) ? 'critical' : 'review',
    identicalBlob: prs.every(p => p.blobSha && p.blobSha === prs[0].blobSha), prs,
  }));
  // A single PR can itself create two SQL migrations with the same version.
  // This must never disappear just because both filenames belong to one PR.
  const migrationCollisions = [...migrations]
    .filter(([, entries]) => new Set(entries.map(e => e.filename)).size > 1 || new Set(entries.map(e => e.number)).size > 1)
    .map(([key, entries]) => ({
      key, risk: 'critical', withinPullRequest: new Set(entries.map(e => e.number)).size === 1,
      prs: entries.sort((a, b) => a.number - b.number || a.filename.localeCompare(b.filename)),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
  const scopeCollisions = collision(scopes, (key, prs) => ({ key, prs }));
  return {
    schemaVersion: 1,
    repository: snapshot.repository || null,
    mainSha: snapshot.mainSha || null,
    summary: {
      openPullRequests: pulls.length, indexedUniqueFiles: paths.size,
      pathCollisions: pathCollisions.length,
      criticalPathCollisions: pathCollisions.filter(x => x.risk === 'critical').length,
      migrationCollisions: migrationCollisions.length, scopeCollisions: scopeCollisions.length,
      missingHandoffPointers: missingHandoffPointers.length,
      incompletePullRequests: new Set(incomplete.map(x => x.number)).size,
    },
    pathCollisions, migrationCollisions, scopeCollisions, missingHandoffPointers, incomplete,
    disclaimer: 'Candidate overlaps only; review actual diffs, ownership, SHAs and executable checks. No GitHub mutations.',
  };
}

function validRepo(repo) {
  const m = /^([A-Za-z0-9][A-Za-z0-9-]*)\/([A-Za-z0-9_.-]+)$/.exec(repo || '');
  if (!m || m[2] === '.' || m[2] === '..') bad('expected owner/repo');
  return m[1] + '/' + m[2];
}
async function get(endpoint, token, fetcher) {
  let response;
  try {
    response = await fetcher(API + endpoint, {
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'masanawa-readonly-pr-audit' },
      signal: AbortSignal.timeout(20000),
    });
  } catch { bad('GitHub read timed out or network is unavailable'); }
  if (!response.ok) bad('GitHub HTTP ' + response.status + '; no complete inventory');
  try { return await response.json(); } catch { bad('invalid GitHub JSON'); }
}
async function getPages(url, token, fetcher, cap) {
  const out = [];
  for (let page = 1; page <= Math.ceil(cap / 100); page++) {
    const batch = await get(url + (url.includes('?') ? '&' : '?') + 'per_page=100&page=' + page, token, fetcher);
    if (!Array.isArray(batch)) bad('non-array GitHub page');
    out.push(...batch);
    if (out.length > cap) bad('GitHub pagination cap exceeded');
    if (batch.length < 100) return out;
  }
  bad('pagination limit reached; possible missing pages');
}
async function mapLimited(items, callback, maximum = 3) {
  const results = new Array(items.length);
  let index = 0;
  await Promise.all(Array.from({ length: Math.min(maximum, items.length) }, async () => {
    while (index < items.length) { const i = index++; results[i] = await callback(items[i]); }
  }));
  return results;
}

/** Explicit authenticated, read-only GitHub REST access. Never guesses hidden pages. */
export async function loadGithubSnapshot({ repo, token, fetcher = fetch }) {
  const name = validRepo(repo);
  if (!token) bad('GITHUB_TOKEN or GH_TOKEN required for live audit');
  const root = '/repos/' + name;
  const [metadata, pulls] = await Promise.all([
    get(root, token, fetcher), getPages(root + '/pulls?state=open', token, fetcher, 300),
  ]);
  const branch = encodeURIComponent(metadata.default_branch || 'main');
  const ref = await get(root + '/branches/' + branch, token, fetcher);
  const expanded = await mapLimited(pulls, async (pr) => {
    const files = await getPages(root + '/pulls/' + pr.number + '/files', token, fetcher, 3000);
    // The file endpoint reflects the mutable PR head. A concurrent push can
    // otherwise misattribute a newer file list to the older listed head SHA.
    const checked = await get(root + '/pulls/' + pr.number, token, fetcher);
    const headStable = /^[a-f0-9]{40}$/i.test(pr.head?.sha || '') && checked.head?.sha === pr.head.sha;
    return {
      number: pr.number, title: pr.title, body: pr.body, draft: pr.draft,
      head: { sha: pr.head?.sha, ref: pr.head?.ref }, headStable,
      completeFiles: headStable && files.length < 3000 &&
        (!Number.isSafeInteger(checked.changed_files) || checked.changed_files === files.length),
      files: files.map(f => ({ filename: f.filename, sha: f.sha, status: f.status })),
    };
  });
  return { repository: name, mainSha: ref.commit?.sha || null, pulls: expanded };
}

export function parseArgs(args) {
  const o = { live: false, strict: false };
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === '--help' || flag === '-h') o.help = true;
    else if (flag === '--live') o.live = true;
    else if (flag === '--strict') o.strict = true;
    else if (['--repo', '--snapshot', '--output'].includes(flag)) {
      const value = args[++i];
      if (!value || value.startsWith('--')) bad('missing value for ' + flag);
      o[flag.slice(2)] = value;
    } else bad('unknown argument ' + flag);
  }
  if (!o.help && Number(o.live) + Number(Boolean(o.snapshot)) !== 1) bad('select --live or --snapshot (not both)');
  if (o.live && !o.repo) bad('--live requires --repo owner/repo');
  return o;
}
export async function main(argv, { out = process.stdout, err = process.stderr, env = process.env } = {}) {
  try {
    const o = parseArgs(argv);
    if (o.help) {
      out.write('Usage: node scripts/audit-draft-pr-collisions.mjs --snapshot FILE [--strict] [--output FILE]\n' +
        '       GITHUB_TOKEN=... node scripts/audit-draft-pr-collisions.mjs --live --repo owner/repo [--strict] [--output FILE]\n' +
        'Exit: 0 report, 2 strict collisions, 3 incomplete evidence/error.\n');
      return 0;
    }
    const snapshot = o.snapshot ? JSON.parse(await readFile(o.snapshot, 'utf8')) :
      await loadGithubSnapshot({ repo: o.repo, token: env.GITHUB_TOKEN || env.GH_TOKEN });
    const report = auditSnapshot(snapshot);
    const content = JSON.stringify(report, null, 2) + '\n';
    if (o.output) await writeFile(o.output, content, { mode: 0o600 });
    else out.write(content);
    if (!report.mainSha || report.summary.incompletePullRequests) {
      err.write('INCOMPLETE: no clean-merge conclusion is valid.\n');
      return 3;
    }
    if (o.strict && (report.summary.pathCollisions || report.summary.migrationCollisions || report.summary.scopeCollisions)) {
      err.write('REVIEW REQUIRED: PR collisions detected; no merge decision made.\n');
      return 2;
    }
    return 0;
  } catch (error) { err.write(String(error.message || error) + '\n'); return 3; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.argv.slice(2));
}
