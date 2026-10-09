import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyRun, fetchRunEvidence, VERDICTS } from './check-run.mjs';
const run = { id: 123, status: 'completed', conclusion: 'success' };
const step = (name, conclusion = 'success') => ({ name, status: 'completed', conclusion, started_at: '2026-10-09T00:01:00Z', completed_at: '2026-10-09T00:02:00Z' });
const job = (steps, conclusion = 'success') => ({ name: 'test', conclusion, steps });
const check = (r, jobs, req = ['Run tests']) => classifyRun(r, jobs, req).verdict;
test('zero jobs is not execution proof', () => assert.equal(check(run, []), VERDICTS.NOT_EXECUTED));
test('failed zero-step job is not application failure proof', () => assert.equal(check({ ...run, conclusion: 'failure' }, [job([], 'failure')]), VERDICTS.NOT_EXECUTED));
test('green workflow with setup alone cannot pass verification', () => assert.equal(check(run, [job([step('Checkout')])]), VERDICTS.EXECUTED_UNQUALIFIED));
test('named completed validation step is green workflow evidence only', () => assert.equal(check(run, [job([step('Checkout'), step('Run tests')])]), VERDICTS.STEPS_EXECUTED_GREEN_NOT_E2E));
test('failed test step cannot pass', () => assert.equal(check({ ...run, conclusion: 'failure' }, [job([step('Run tests', 'failure')], 'failure')]), VERDICTS.EXECUTED_FAILED));
test('cancelled after real steps is executed failure, not pre-step failure', () => assert.equal(check({ ...run, conclusion: 'cancelled' }, [job([step('Run tests')], 'cancelled')]), VERDICTS.EXECUTED_FAILED));
test('uncompleted run remains indeterminate', () => assert.equal(check({ ...run, status: 'in_progress', conclusion: null }, [job([step('Run tests')])]), VERDICTS.INCOMPLETE));
test('untimed result cannot prove execution', () => assert.equal(check(run, [job([{ ...step('Run tests'), started_at: null }])]), VERDICTS.NOT_EXECUTED));
test('unknown run conclusion fails closed', () => assert.equal(check({ ...run, conclusion: null }, [job([step('Run tests')])]), VERDICTS.INCOMPLETE));
test('empty policy cannot pass', () => assert.equal(check(run, [job([step('Run tests')])], []), VERDICTS.INCOMPLETE));
test('all required exact names must match', () => assert.equal(check(run, [job([step('Run tests')])], ['Run tests', 'Flutter analyze']), VERDICTS.EXECUTED_UNQUALIFIED));
test('skipped-only jobs cannot pass', () => assert.equal(check(run, [job([], 'skipped')]), VERDICTS.NOT_EXECUTED));
test('malformed jobs fail closed', () => assert.equal(check(run, [{ name: 'broken' }]), VERDICTS.INCOMPLETE));
function transportWith(pages, givenRun = run) { return async url => ({ ok: true, json: async () => url.endsWith('/123') ? givenRun : pages[Number(new URL(url).searchParams.get('page')) - 1] }); }
test('read-only API paginates and validates job count', async () => {
  const got = await fetchRunEvidence({ owner: 'Baatiku', repo: 'masanawa', runId: '123', transport: transportWith([{ total_count: 1, jobs: [job([step('Run tests')])] }]) });
  assert.equal(got.jobs.length, 1);
});
test('pagination mismatch rejects incomplete evidence', async () => {
  await assert.rejects(fetchRunEvidence({ owner: 'Baatiku', repo: 'masanawa', runId: '123', transport: transportWith([{ total_count: 2, jobs: [job([])] }, { total_count: 3, jobs: [job([])] }]) }), /count changed/);
});
test('empty second page rejects truncated response', async () => {
  await assert.rejects(fetchRunEvidence({ owner: 'Baatiku', repo: 'masanawa', runId: '123', transport: transportWith([{ total_count: 2, jobs: [job([])] }, { total_count: 2, jobs: [] }]) }), /Incomplete/);
});
test('invalid untrusted repository or run id fails before network', async () => {
  await assert.rejects(fetchRunEvidence({ owner: '../evil', repo: 'masanawa', runId: '123', transport: () => { throw Error('should not fetch'); } }), /Invalid/);
});
test('API errors disclose only status, not response body or token', async () => {
  await assert.rejects(fetchRunEvidence({ owner: 'Baatiku', repo: 'masanawa', runId: '123', token: 'private-token', transport: async () => ({ ok: false, status: 403 }) }), e => !String(e).includes('private-token') && /403/.test(String(e)));
});
