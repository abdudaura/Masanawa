#!/usr/bin/env node
/** Read-only archive inspection or operator-gated disposable PostgreSQL restore rehearsal.
 * This does NOT verify database/content/ledger recoverability or implement backup encryption.
 */
import { createHash } from 'node:crypto';
import { createReadStream, constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

const execFileAsync = promisify(execFile);
const MAX_LIST_BYTES = 2 * 1024 * 1024;
const DB_PATTERN = /^masanawa_restore_test_[a-z0-9_]{4,48}$/;
const RELATION_COUNT_SQL = `SELECT current_database() || '|' || (
  SELECT count(*)::text FROM pg_catalog.pg_class AS c
  JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
  WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
    AND n.nspname NOT LIKE 'pg_toast%'
    AND c.relkind IN ('r','p','v','m','f','S')
);`;

export class RestoreSafetyError extends Error {
  constructor(message) { super(message); this.name = 'RestoreSafetyError'; }
}

export async function defaultRunner(program, args) {
  return execFileAsync(program, args, { maxBuffer: MAX_LIST_BYTES, timeout: 120_000, windowsHide: true });
}

export function verifyDisposableTarget(env) {
  const db = env.PGDATABASE;
  if (typeof db !== 'string' || !DB_PATTERN.test(db)) {
    throw new RestoreSafetyError('Target PGDATABASE must have the disposable masanawa_restore_test_ prefix.');
  }
  if (env.RESTORE_DISPOSABLE_DATABASE_CONFIRM !== db) {
    throw new RestoreSafetyError('Disposable database name was not independently confirmed.');
  }
  if (env.RESTORE_EXTERNAL_EFFECTS_DISABLED !== 'I_CONFIRM_ISOLATED_NETWORK') {
    throw new RestoreSafetyError('External effects isolation has not been attested.');
  }
  if (env.RESTORE_DISPOSABLE_ONLY !== 'I_AUTHORIZE_TEST_RESTORE') {
    throw new RestoreSafetyError('Explicit disposable restore authorization is required.');
  }
  return db;
}

function parseArchiveList(raw) {
  if (typeof raw !== 'string' || Buffer.byteLength(raw) > MAX_LIST_BYTES) {
    throw new RestoreSafetyError('Archive metadata is empty, malformed or exceeds bounded output.');
  }
  const entries = raw.split(/\r?\n/).filter((line) => /^\s*\d+;\s+\d+\s+\d+\s+/.test(line));
  const tables = entries.filter((line) => /^\s*\d+;\s+\d+\s+\d+\s+TABLE\s+(?!DATA\b)/.test(line));
  if (tables.length === 0) throw new RestoreSafetyError('No restorable table definitions were found.');
  return { archiveEntries: entries.length, tableDefinitions: tables.length };
}

async function verifyCustomArchive(path) {
  const absolute = resolve(path);
  const info = await lstat(absolute);
  if (!info.isFile() || info.isSymbolicLink() || info.size <= 5) {
    throw new RestoreSafetyError('Archive must be a nonempty, regular, non-symlink file.');
  }
  const handle = await open(absolute, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const actual = await handle.stat();
    if (!actual.isFile() || actual.size !== info.size) {
      throw new RestoreSafetyError('Archive changed during inspection.');
    }
    const magic = Buffer.alloc(5);
    if ((await handle.read(magic, 0, 5, 0)).bytesRead !== 5 || magic.toString('ascii') !== 'PGDMP') {
      throw new RestoreSafetyError('Expected a PostgreSQL custom-format PGDMP archive.');
    }
  } finally { await handle.close(); }
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(absolute)) digest.update(chunk);
  return { absolute, sha256: digest.digest('hex') };
}

async function checkedRun(runner, cmd, args, reason) {
  try {
    return await runner(cmd, args);
  } catch {
    // Never echo potentially sensitive tool output, connection arguments or archive metadata.
    throw new RestoreSafetyError(reason);
  }
}

function parseRelationCount(output, expectedName) {
  const lines = String(output ?? '').trim().split(/\r?\n/);
  if (lines.length !== 1) throw new RestoreSafetyError('Ambiguous disposable database identity/count.');
  const parts = lines[0].trim().split('|');
  if (parts.length !== 2 || parts[0] !== expectedName || !/^\d+$/.test(parts[1])) {
    throw new RestoreSafetyError('Disposable database identity/count mismatch.');
  }
  const count = Number(parts[1]);
  if (!Number.isSafeInteger(count)) throw new RestoreSafetyError('Invalid disposable relation count.');
  return count;
}

export async function inspectAndRestore({ archive, restore = false, env = process.env, runner = defaultRunner }) {
  if (typeof archive !== 'string' || archive.length === 0) {
    throw new RestoreSafetyError('An archive file path is required.');
  }
  // Gate even the archive inspection when a restore is requested, before invoking any command.
  const db = restore ? verifyDisposableTarget(env) : null;
  let file;
  try { file = await verifyCustomArchive(archive); }
  catch (error) {
    if (error instanceof RestoreSafetyError) throw error;
    throw new RestoreSafetyError('Cannot safely inspect the archive file.');
  }
  const listing = await checkedRun(runner, 'pg_restore', ['--list', '--', file.absolute], 'pg_restore archive inspection failed.');
  const summary = parseArchiveList(listing.stdout);
  const result = { mode: 'inspect', archiveSha256: file.sha256, ...summary };
  if (!restore) return result;

  const psql = ['--no-psqlrc', '--set', 'ON_ERROR_STOP=1', '--tuples-only', '--no-align', '--quiet', '--command', RELATION_COUNT_SQL];
  const before = await checkedRun(runner, 'psql', psql, 'Disposable database preflight failed.');
  if (parseRelationCount(before.stdout, db) !== 0) {
    throw new RestoreSafetyError('Restore refused: target already has non-system relations.');
  }
  await checkedRun(runner, 'pg_restore', [
    '--exit-on-error', '--single-transaction', '--no-owner', '--no-acl',
    '--dbname', db, '--', file.absolute,
  ], 'Disposable database restore failed; inspect and discard the test database.');
  const after = await checkedRun(runner, 'psql', psql, 'Post-restore schema readback failed.');
  const restoredRelations = parseRelationCount(after.stdout, db);
  if (restoredRelations < summary.tableDefinitions) {
    throw new RestoreSafetyError('Restore schema readback did not contain the expected relations.');
  }
  return { ...result, mode: 'disposable-restore', restoredRelations };
}

function printHelp() {
  process.stdout.write('Usage: node tools/db-restore/inspect-and-restore.mjs <custom.pg> [--restore-disposable]\n' +
    'Default: read-only archive checksum and pg_restore --list.\n' +
    'Restore: require PGDATABASE=masanawa_restore_test_*, RESTORE_DISPOSABLE_DATABASE_CONFIRM=<same>,\n' +
    'RESTORE_EXTERNAL_EFFECTS_DISABLED=I_CONFIRM_ISOLATED_NETWORK, and\n' +
    'RESTORE_DISPOSABLE_ONLY=I_AUTHORIZE_TEST_RESTORE.\n' +
    'Inject credentials separately via PG* environment. Never use production targets.\n');
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  if (argv.length === 1 && ['--help', '-h'].includes(argv[0])) { printHelp(); return 0; }
  if (argv.length < 1 || argv.length > 2 || argv[0].startsWith('-') ||
      (argv.length === 2 && argv[1] !== '--restore-disposable')) {
    process.stderr.write('Invalid arguments; use --help.\n'); return 2;
  }
  try {
    const result = await inspectAndRestore({ archive: argv[0], restore: argv.length === 2, env });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`Restore safety check failed: ${error instanceof RestoreSafetyError ? error.message : 'unexpected error'}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await main();
}
