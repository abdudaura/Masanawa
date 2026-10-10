#!/usr/bin/env node
/**
 * F11: read-only, dependency-free guard for high-confidence exposed source secrets.
 * Does not print credential content, read symlink targets, or contact any provider.
 * This is a source guard, not a complete historical git/compiled artifact audit.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_ENTRIES = 50_000;
const EXCLUDED_DIRS = new Set([
  '.git', 'node_modules', '.dart_tool', '.gradle', '.next', '.turbo',
  '.venv', 'coverage', 'build', 'dist', 'Pods', '.idea', '.pytest_cache',
]);
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svgz', '.pdf',
  '.zip', '.gz', '.tar', '.woff', '.woff2', '.ttf', '.otf', '.mp3',
  '.mp4', '.mov', '.ogg', '.wav', '.apk', '.aab', '.jar', '.so', '.db',
  '.sqlite', '.lockb', '.wasm', '.class', '.keystore', '.jks',
]);

function isSensitiveEnv(name) {
  if (!/^\.env(?:\..+)?$/.test(name)) return false;
  return !/^\.env\.(?:example|sample|template|dist)(?:\..*)?$/.test(name);
}

function detectText(content, relativePath) {
  const results = [];
  const lines = content.split(/\r?\n/);
  const rules = [
    ['PRIVATE_KEY', /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/],
    ['GITHUB_TOKEN', /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{20,}\b/],
    ['LIVE_PAYMENT_SECRET', /\bsk_live_[A-Za-z0-9]{12,}\b/],
  ];
  for (let i = 0; i < lines.length; i++) {
    for (const [rule, pattern] of rules) {
      if (pattern.test(lines[i])) results.push({ path: relativePath, line: i + 1, rule });
    }
  }
  if (path.extname(relativePath).toLowerCase() === '.json') {
    try {
      const payload = JSON.parse(content);
      if (payload && !Array.isArray(payload) && payload.type === 'service_account' &&
          (typeof payload.private_key === 'string' || typeof payload.private_key_id === 'string')) {
        results.push({ path: relativePath, line: null, rule: 'SERVICE_ACCOUNT_CREDENTIAL' });
      }
    } catch {
      // Invalid JSON may still contain textual secrets; the source parser owns JSON validity.
    }
  }
  return results;
}

export function scanRepository(root, options = {}) {
  const absoluteRoot = path.resolve(root);
  const findings = [];
  const errors = [];
  const stats = { scannedFiles: 0, skippedBinary: 0, skippedSymlinks: 0 };
  let entries = 0;
  const maxBytes = options.maxBytes ?? MAX_FILE_BYTES;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new TypeError('Invalid maxBytes');
  try {
    if (!fs.statSync(absoluteRoot).isDirectory()) throw new Error('Root is not a directory');
  } catch {
    return { root: absoluteRoot, findings, errors: ['ROOT_UNREADABLE'], stats };
  }

  function walk(directory) {
    let children;
    try {
      children = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      errors.push('DIRECTORY_UNREADABLE');
      return;
    }
    children.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of children) {
      entries++;
      if (entries > MAX_ENTRIES) {
        errors.push('ENTRY_LIMIT_EXCEEDED');
        return;
      }
      const target = path.join(directory, entry.name);
      const relative = path.relative(absoluteRoot, target).split(path.sep).join('/');
      // Do not follow symlinks: a checkout might reference private paths outside the repo.
      if (entry.isSymbolicLink()) { stats.skippedSymlinks++; continue; }
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.has(entry.name)) walk(target);
        continue;
      }
      if (!entry.isFile()) continue;
      if (isSensitiveEnv(entry.name)) {
        findings.push({ path: relative, line: null, rule: 'SENSITIVE_ENV_FILE' });
      }
      if (BINARY_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        stats.skippedBinary++;
        continue;
      }
      let content;
      try {
        if (fs.statSync(target).size > maxBytes) {
          errors.push('OVERSIZED_TEXT_FILE:' + relative);
          continue;
        }
        const bytes = fs.readFileSync(target);
        if (bytes.includes(0)) { stats.skippedBinary++; continue; }
        content = bytes.toString('utf8');
      } catch {
        errors.push('FILE_UNREADABLE:' + relative);
        continue;
      }
      stats.scannedFiles++;
      findings.push(...detectText(content, relative));
    }
  }
  walk(absoluteRoot);
  findings.sort((a, b) => a.path.localeCompare(b.path) || (a.line ?? 0) - (b.line ?? 0) || a.rule.localeCompare(b.rule));
  errors.sort();
  return { root: absoluteRoot, findings, errors, stats };
}

function usage() {
  return 'Usage: node tools/secret-exposure-gate/scan.mjs [--root DIRECTORY] [--json]\nExit 0 clean, 1 findings, 2 scan error or invalid arguments. Never prints secret contents.';
}

export function runCli(argv, io = console) {
  let root = process.cwd();
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--help') { io.log(usage()); return 0; }
    if (argv[i] === '--json') { json = true; continue; }
    if (argv[i] === '--root' && i + 1 < argv.length) { root = argv[++i]; continue; }
    io.error('Invalid arguments. ' + usage());
    return 2;
  }
  const result = scanRepository(root);
  const exit = result.errors.length ? 2 : result.findings.length ? 1 : 0;
  if (json) {
    // The absolute root is intentionally excluded from machine output.
    io.log(JSON.stringify({ status: exit === 0 ? 'CLEAN' : exit === 1 ? 'FINDINGS' : 'INCOMPLETE',
      findings: result.findings, errors: result.errors, stats: result.stats }));
  } else {
    io.log(`Source secret gate: ${exit === 0 ? 'CLEAN' : exit === 1 ? 'FINDINGS' : 'INCOMPLETE'}; ${result.stats.scannedFiles} files scanned; ${result.findings.length} findings; ${result.errors.length} scan errors.`);
    for (const finding of result.findings) io.log(`${finding.rule}: ${finding.path}${finding.line ? ':' + finding.line : ''}`);
    for (const error of result.errors) io.error(`Scan error: ${error}`);
  }
  return exit;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = runCli(process.argv.slice(2));
}
