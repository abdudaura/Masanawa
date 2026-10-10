import { createHash } from 'node:crypto';
import { lstat, open, realpath } from 'node:fs/promises';
import path from 'node:path';

export class EvidencePathError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'EvidencePathError';
    this.code = code;
  }
}

/**
 * Read a bounded immutable evidence artifact without following symlinks.
 * Only relative slash-delimited paths below a trusted evidence root are accepted.
 * This checks file identity before and after reading and never declares a
 * provider/device check successful: it only verifies artifact integrity.
 */
export async function verifyEvidenceFile(root, relativePath, expectedSha256, maxBytes = 8 * 1024 * 1024) {
  if (typeof relativePath !== 'string' || !relativePath ||
      relativePath.includes('\\') || relativePath.includes('\0') ||
      path.posix.isAbsolute(relativePath) ||
      relativePath.split('/').some((part) => part === '..' || part === '.' || part === '')) {
    throw new EvidencePathError('UNSAFE_PATH', 'Evidence path must be a normalized relative path');
  }
  if (typeof expectedSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(expectedSha256)) {
    throw new EvidencePathError('INVALID_DIGEST', 'Expected SHA-256 must be lowercase hex');
  }
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new EvidencePathError('INVALID_LIMIT', 'Invalid evidence byte limit');
  }
  const rootReal = await realpath(root);
  const rootInfo = await lstat(rootReal);
  if (!rootInfo.isDirectory()) throw new EvidencePathError('INVALID_ROOT', 'Evidence root is not a directory');

  // Reject symlinks at each child component, not just at the leaf.
  let cursor = rootReal;
  for (const segment of relativePath.split('/')) {
    cursor = path.join(cursor, segment);
    const stat = await lstat(cursor);
    if (stat.isSymbolicLink()) throw new EvidencePathError('SYMLINK', 'Evidence symlinks are prohibited');
  }
  const file = await open(cursor, 'r');
  try {
    const before = await file.stat();
    if (!before.isFile()) throw new EvidencePathError('NOT_FILE', 'Evidence must be a regular file');
    if (before.size > maxBytes) throw new EvidencePathError('OVERSIZE', 'Evidence exceeds byte limit');
    const hash = createHash('sha256');
    let count = 0;
    const buffer = Buffer.allocUnsafe(Math.min(65536, maxBytes + 1));
    while (true) {
      const { bytesRead } = await file.read(buffer, 0, buffer.length, null);
      if (!bytesRead) break;
      count += bytesRead;
      if (count > maxBytes) throw new EvidencePathError('OVERSIZE', 'Evidence exceeds byte limit');
      hash.update(buffer.subarray(0, bytesRead));
    }
    const after = await file.stat();
    if (before.dev !== after.dev || before.ino !== after.ino ||
        before.size !== after.size || before.mtimeMs !== after.mtimeMs ||
        count !== after.size) {
      throw new EvidencePathError('CHANGED', 'Evidence changed during verification');
    }
    const actualSha256 = hash.digest('hex');
    if (actualSha256 !== expectedSha256) {
      throw new EvidencePathError('DIGEST_MISMATCH', 'Evidence digest does not match');
    }
    return { path: relativePath, sha256: actualSha256, bytes: count };
  } finally {
    await file.close();
  }
}
