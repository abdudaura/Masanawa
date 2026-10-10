import test from 'node:test';
import assert from 'node:assert/strict';
import { audit, contrast, luminance, parseTokens, resolveColor } from './contrast.mjs';

const TOKENS = [
  'static const ColorTokens light = ColorTokens(',
  "    emergency: '#D32F2F',",
  "    textPrimary: '#111B21',",
  "    surfaceBg: '#F0F2F5',",
  "    surfaceCard: '#FFFFFF',",
  '  );',
  '  static const ColorTokens dark = ColorTokens(',
  "    emergency: '#F15C6D',",
  "    textPrimary: '#E9EDEF',",
  "    surfaceBg: '#111B21',",
  "    surfaceCard: '#202C33',",
  '  );',
].join('\n');

const THEME = [
  'final scheme = ColorScheme(',
  '    error: masanawa.emergency,',
  '    onError: isDark ? masanawa.surfaceBg : Colors.white,',
  '  );',
  '  snackBarTheme: SnackBarThemeData(',
  '      backgroundColor: masanawa.textPrimary,',
  '      contentTextStyle: TextStyle(',
  '        color: isDark ? masanawa.surfaceCard : Colors.white,',
  '      ),',
  '    ),',
].join('\n');

test('WCAG luminance edge cases: black, white, symmetry and identical', () => {
  assert.equal(luminance('#000000'), 0);
  assert.equal(luminance('#ffffff'), 1);
  assert.equal(contrast('#FFFFFF', '#000000'), 21);
  assert.equal(contrast('#ababab', '#ababab'), 1);
  assert.equal(contrast('#111B21', '#FFFFFF'), contrast('#FFFFFF', '#111B21'));
  assert.throws(() => luminance('#zzz'), /invalid RGB/);
});

test('both feedback surfaces satisfy 4.5:1 for light and dark', () => {
  const report = audit(TOKENS, THEME);
  assert.equal(report.passed, true);
  assert.equal(report.checks.length, 4);
  assert.ok(report.checks.every(row => row.ratio >= 4.5));
});

test('detects original dark Snackbar white text regression', () => {
  const report = audit(TOKENS, THEME.replace('isDark ? masanawa.surfaceCard : Colors.white', 'Colors.white'));
  assert.equal(report.passed, false);
  assert.deepEqual(report.checks.filter(c => !c.passed).map(c => c.mode + '/' + c.name), ['dark/snackbar-message']);
});

test('detects original dark error white label regression', () => {
  const report = audit(TOKENS, THEME.replace('isDark ? masanawa.surfaceBg : Colors.white', 'Colors.white'));
  assert.equal(report.passed, false);
  assert.deepEqual(report.checks.filter(c => !c.passed).map(c => c.mode + '/' + c.name), ['dark/error-label']);
});

test('rejects unknown dynamic expression rather than assuming accessible', () => {
  assert.throws(() => audit(TOKENS, THEME.replace('masanawa.surfaceCard : Colors.white', 'myUnsafeColor : Colors.white')), /cannot verify/);
});

test('rejects missing role, unsupported color and broken theme structure', () => {
  assert.throws(() => parseTokens(TOKENS.replace("    emergency: '#D32F2F',\n", '')), /missing light.emergency/);
  assert.throws(() => resolveColor('Colors.transparent', 'dark', parseTokens(TOKENS)), /cannot verify/);
  assert.throws(() => audit(TOKENS, THEME.replace('snackBarTheme:', 'otherTheme:')), /no snackBarTheme/);
});

test('token mutations that make normal text unreadable are detected', () => {
  const tokens = TOKENS.replace("textPrimary: '#E9EDEF'", "textPrimary: '#FFFFFF'")
    .replace("surfaceCard: '#202C33'", "surfaceCard: '#FFFFFF'");
  assert.equal(audit(tokens, THEME).passed, false);
});
