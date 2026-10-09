import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { inspectAndRestore, verifyDisposableTarget, RestoreSafetyError, main } from './inspect-and-restore.mjs';

const inventory = '; archive metadata\n12; 1259 12 TABLE public customers operator\n13; 0 12 TABLE DATA public customers operator\n14; 1259 13 TABLE public receipts operator\n';
const db = 'masanawa_restore_test_case1';
const authorized = Object.freeze({
  PGDATABASE: db,
  RESTORE_DISPOSABLE_DATABASE_CONFIRM: db,
  RESTORE_EXTERNAL_EFFECTS_DISABLED: 'I_CONFIRM_ISOLATED_NETWORK',
  RESTORE_DISPOSABLE_ONLY: 'I_AUTHORIZE_TEST_RESTORE',
});

async function fixture(t, contents = 'PGDMPexample-archive-bytes') {
  const dir = await mkdtemp(join(tmpdir(), 'masanawa-rehearsal-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const archive = join(dir, 'snapshot.custom');
  await writeFile(archive, contents);
  return archive;
}
function fake(commands, outcomes = []) {
  return async (binary, args) => {
    commands.push({ binary, args });
    if (outcomes.length) { const next = outcomes.shift(); if (next instanceof Error) throw next; return { stdout: next }; }
    return { stdout: inventory };
  };
}

test('read-only inspect hashes the file and never contacts target database', async (t) => {
  const archive = await fixture(t);
  const commands = [];
  const result = await inspectAndRestore({ archive, runner: fake(commands), env: { PGDATABASE: 'production' } });
  assert.deepEqual(result, {
    mode: 'inspect', archiveSha256: createHash('sha256').update('PGDMPexample-archive-bytes').digest('hex'),
    archiveEntries: 3, tableDefinitions: 2,
  });
  assert.deepEqual(commands.map(x => x.binary), ['pg_restore']);
  assert.deepEqual(commands[0].args.slice(0, 2), ['--list', '--']);
});

test('restore requires the exact disposable name and all independent attestations', () => {
  for (const key of Object.keys(authorized)) {
    assert.throws(() => verifyDisposableTarget({ ...authorized, [key]: '' }), RestoreSafetyError, key);
  }
  for (const name of ['postgres', 'masanawa_prod', 'masanawa_restore_test_',
    'masanawa_restore_test_DROP;TABLE', 'masanawa_restore_test_ab/xx', 'masanawa_restore_test_💥']) {
    assert.throws(() => verifyDisposableTarget({ ...authorized, PGDATABASE: name,
      RESTORE_DISPOSABLE_DATABASE_CONFIRM: name }), RestoreSafetyError, name);
  }
  assert.equal(verifyDisposableTarget(authorized), db);
});

test('unsafe restore is rejected before any pg command', async (t) => {
  const archive = await fixture(t);
  const commands = [];
  await assert.rejects(inspectAndRestore({ archive, restore: true, env: {}, runner: fake(commands) }), RestoreSafetyError);
  assert.equal(commands.length, 0);
});

test('restore preflight checks fresh database then runs single-transaction restore and post-readback', async (t) => {
  const archive = await fixture(t);
  const commands = [];
  const result = await inspectAndRestore({ archive, restore: true, env: authorized,
    runner: fake(commands, [inventory, `${db}|0\n`, '', `${db}|3\n`]) });
  assert.equal(result.mode, 'disposable-restore');
  assert.equal(result.restoredRelations, 3);
  assert.deepEqual(commands.map(x => x.binary), ['pg_restore', 'psql', 'pg_restore', 'psql']);
  assert.deepEqual(commands[2].args.slice(0, 6), ['--exit-on-error', '--single-transaction', '--no-owner', '--no-acl', '--dbname', db]);
  assert.ok(!commands[2].args.includes('--clean'));
  assert.ok(!commands[2].args.includes('--create'));
  assert.ok(commands[1].args.includes('--no-psqlrc'));
  assert.ok(commands[1].args.includes('ON_ERROR_STOP=1'));
});

test('refuses already populated target without issuing restore', async (t) => {
  const archive = await fixture(t);
  const commands = [];
  await assert.rejects(inspectAndRestore({ archive, restore: true, env: authorized,
    runner: fake(commands, [inventory, `${db}|1`]) }), /already has/);
  assert.deepEqual(commands.map(x => x.binary), ['pg_restore', 'psql']);
});

test('rejects preflight spoofing and multi-line output', async (t) => {
  const archive = await fixture(t);
  for (const output of ['prod|0', `${db}|x`, `${db}|0\n${db}|0`, `${db}|-1`, `${db}|999999999999999999999999`]) {
    const commands = [];
    await assert.rejects(inspectAndRestore({ archive, restore: true, env: authorized,
      runner: fake(commands, [inventory, output]) }), RestoreSafetyError);
    assert.equal(commands.length, 2);
  }
});

test('fails closed when pg_restore or psql execution fails; does not leak injected command error', async (t) => {
  const archive = await fixture(t);
  for (const outcomes of [[new Error('SECRET')], [inventory, new Error('SECRET')],
    [inventory, `${db}|0`, new Error('SECRET')], [inventory, `${db}|0`, '', new Error('SECRET')]]) {
    await assert.rejects(inspectAndRestore({ archive, restore: true, env: authorized, runner: fake([], outcomes) }),
      err => err instanceof RestoreSafetyError && !err.message.includes('SECRET'));
  }
});

test('rejects post-restore readback lacking relations', async (t) => {
  const archive = await fixture(t);
  await assert.rejects(inspectAndRestore({ archive, restore: true, env: authorized,
    runner: fake([], [inventory, `${db}|0`, '', `${db}|1`]) }), /readback/);
});

test('rejects symlinks instead of following potentially replaced archive', async (t) => {
  const archive = await fixture(t);
  const link = `${archive}.link`;
  await symlink(archive, link);
  await assert.rejects(inspectAndRestore({ archive: link, runner: fake([]) }), RestoreSafetyError);
});

test('rejects SQL/plain non-PGDMP or too-small file', async (t) => {
  for (const contents of ['CREATE TABLE xyz()', 'PGDMP']) {
    const archive = await fixture(t, contents);
    await assert.rejects(inspectAndRestore({ archive, runner: fake([]) }), RestoreSafetyError);
  }
});

test('rejects malformed or metadata-only custom archives', async (t) => {
  const archive = await fixture(t);
  for (const output of ['', '; metadata\n', '1; 1259 123 TABLE DATA public x bob', 'x'.repeat(2 * 1024 * 1024 + 1)]) {
    await assert.rejects(inspectAndRestore({ archive, runner: fake([], [output]) }), RestoreSafetyError);
  }
});

test('CLI unknown options exit with no tool execution', async () => {
  assert.equal(await main(['--restore-disposable']), 2);
  assert.equal(await main(['archive', '--force']), 2);
});
