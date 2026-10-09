#!/usr/bin/env node
/** Read-only Actions job-step evidence classifier. This does NOT diagnose a runner outage. */
import { pathToFileURL } from 'node:url';

const IDENT = /^[A-Za-z0-9_.-]+$/;
const MAX_PAGES = 20;
export const VERDICTS = Object.freeze({
  INCOMPLETE: 'INCOMPLETE',
  NOT_EXECUTED: 'NOT_EXECUTED',
  EXECUTED_FAILED: 'EXECUTED_FAILED',
  EXECUTED_UNQUALIFIED: 'EXECUTED_UNQUALIFIED',
  STEPS_EXECUTED_GREEN_NOT_E2E: 'STEPS_EXECUTED_GREEN_NOT_E2E',
});

export function classifyRun(run, jobs, requiredSteps = []) {
  const problems = [];
  if (!run || !Array.isArray(jobs) || !Array.isArray(requiredSteps)) {
    return { verdict: VERDICTS.INCOMPLETE, problems: ['Malformed run, jobs, or step policy'] };
  }
  if (requiredSteps.length === 0 || requiredSteps.some(s => typeof s !== 'string' || !s.trim() || s.length > 120)) {
    problems.push('At least one valid explicitly named validation step is required');
  }
  const validJobs = jobs.every(j => j && typeof j === 'object' && Array.isArray(j.steps));
  if (!validJobs) problems.push('Malformed or incomplete jobs list');
  if (run.status !== 'completed') problems.push('Workflow run has not completed');
  if (!['success', 'failure', 'cancelled', 'timed_out', 'action_required', 'skipped', 'neutral'].includes(run.conclusion)) {
    problems.push('Run conclusion unavailable or unrecognized');
  }
  if (problems.length) return { verdict: VERDICTS.INCOMPLETE, problems };

  const relevant = jobs.filter(j => j.conclusion !== 'skipped');
  const steps = relevant.flatMap(j => j.steps.map(s => ({ ...s, job: j.name })));
  const started = steps.filter(s => s && s.status === 'completed' && s.started_at && s.completed_at && s.conclusion);
  const validated = requiredSteps.map(name => ({
    name,
    matched: started.filter(s => s.name === name),
  }));
  const summary = {
    jobs: jobs.length,
    nonSkippedJobs: relevant.length,
    reportedSteps: steps.length,
    completedTimedSteps: started.length,
    validationSteps: validated.map(v => ({ name: v.name, executed: v.matched.length, passed: v.matched.filter(s => s.conclusion === 'success').length })),
  };
  if (!started.length) return { verdict: VERDICTS.NOT_EXECUTED, problems: ['No completed, timed job steps reported; no application test outcome is established'], summary };
  if (run.conclusion !== 'success' || relevant.some(j => j.conclusion !== 'success') || started.some(s => s.conclusion !== 'success')) {
    return { verdict: VERDICTS.EXECUTED_FAILED, problems: ['Steps executed but the run/job/step is not wholly successful'], summary };
  }
  if (validated.some(v => v.matched.length === 0)) {
    return { verdict: VERDICTS.EXECUTED_UNQUALIFIED, problems: ['Expected validation steps absent or without completion timestamps'], summary };
  }
  return { verdict: VERDICTS.STEPS_EXECUTED_GREEN_NOT_E2E, problems: ['Only workflow-step evidence; does not prove real DB/provider/device/customer acceptance'], summary };
}

export async function fetchRunEvidence({ owner, repo, runId, token, transport = fetch }) {
  if (![owner, repo].every(v => typeof v === 'string' && IDENT.test(v)) || !/^[1-9]\d{0,17}$/.test(String(runId))) {
    throw new Error('Invalid repository or run ID');
  }
  const base = `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}`;
  async function load(url) {
    const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'masanawa-ci-evidence/1' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await transport(url, { headers, signal: AbortSignal.timeout(15000), redirect: 'error' });
    if (!res.ok) throw new Error(`GitHub API returned HTTP ${res.status}`);
    const body = await res.json();
    if (!body || typeof body !== 'object') throw new Error('Malformed GitHub response');
    return body;
  }
  const run = await load(base);
  if (String(run.id) !== String(runId)) throw new Error('Workflow run ID mismatch');
  const jobs = [];
  let reportedTotal = null;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const data = await load(`${base}/jobs?per_page=100&page=${page}`);
    if (!Number.isSafeInteger(data.total_count) || data.total_count < 0 || !Array.isArray(data.jobs) || data.jobs.length > 100) {
      throw new Error('Malformed or incomplete GitHub jobs page');
    }
    if (reportedTotal === null) reportedTotal = data.total_count;
    if (reportedTotal !== data.total_count) throw new Error('Jobs count changed during paginated inspection');
    jobs.push(...data.jobs);
    if (jobs.length === reportedTotal) return { run, jobs };
    if (jobs.length > reportedTotal || data.jobs.length === 0) throw new Error('Incomplete/inconsistent jobs pagination');
  }
  throw new Error('Jobs pagination exceeds safe inspection bound');
}

export async function main(argv = process.argv.slice(2)) {
  const options = { steps: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (['--owner', '--repo', '--run', '--require-step'].includes(arg) && i + 1 < argv.length) {
      const value = argv[++i];
      if (arg === '--require-step') options.steps.push(value);
      else options[{ '--owner': 'owner', '--repo': 'repo', '--run': 'runId' }[arg]] = value;
    } else throw new Error(`Unsupported or missing CLI option: ${arg}`);
  }
  if (!options.steps.length) throw new Error('Supply --require-step with an exact CI validation step name');
  const result = await fetchRunEvidence({ ...options, token: process.env.GITHUB_TOKEN || process.env.GH_TOKEN });
  const verdict = classifyRun(result.run, result.jobs, options.steps);
  const publicResult = { runId: String(result.run.id), verdict: verdict.verdict, problems: verdict.problems, summary: verdict.summary };
  process.stdout.write(JSON.stringify(publicResult, null, 2) + '\n');
  return verdict.verdict === VERDICTS.STEPS_EXECUTED_GREEN_NOT_E2E ? 0 : 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(code => { process.exitCode = code; }).catch(e => {
    process.stderr.write(JSON.stringify({ verdict: VERDICTS.INCOMPLETE, error: String(e.message || e) }) + '\n');
    process.exitCode = 2;
  });
}
