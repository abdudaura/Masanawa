/**
 * Read-only F01 contrast audit for current Flutter semantic feedback.
 * Supports a deliberately limited Dart expression subset; unknown values
 * fail closed rather than receiving a false WCAG pass.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

export function luminance(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error('invalid RGB color: ' + hex);
  const linear = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(n => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

export function contrast(a, b) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

export function parseTokens(source) {
  const out = {};
  for (const mode of ['light', 'dark']) {
    const match = source.match(new RegExp('static const ColorTokens ' + mode + ' = ColorTokens\\(([\\s\\S]*?)\\n  \\);'));
    if (!match) throw new Error('missing ' + mode + ' ColorTokens declaration');
    const tokens = {};
    for (const [, role, hex] of match[1].matchAll(/^\s*(\w+):\s*'(#(?:[0-9a-f]{6}))',?\s*$/gim)) tokens[role] = hex;
    for (const role of ['emergency', 'textPrimary', 'surfaceCard', 'surfaceBg']) {
      if (!tokens[role]) throw new Error('missing ' + mode + '.' + role);
    }
    out[mode] = tokens;
  }
  return out;
}

function attribute(source, name) {
  const match = source.match(new RegExp('\\b' + name + ':\\s*([^,\\n]+),'));
  if (!match) throw new Error('theme has no ' + name);
  return match[1].trim();
}

function section(source, start, end) {
  const startIndex = source.indexOf(start);
  if (startIndex < 0) throw new Error('theme has no ' + start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (endIndex < 0) throw new Error('theme has no closing ' + end);
  return source.slice(startIndex, endIndex);
}

export function resolveColor(expression, mode, tokens) {
  const ternary = expression.match(/^isDark\s*\?\s*(.*?)\s*:\s*(.*?)$/);
  if (ternary) return resolveColor(ternary[mode === 'dark' ? 1 : 2], mode, tokens);
  if (expression === 'Colors.white') return '#FFFFFF';
  if (expression === 'Colors.black') return '#000000';
  const role = expression.match(/^masanawa\.(\w+)$/)?.[1];
  if (role && tokens[mode][role]) return tokens[mode][role];
  throw new Error('cannot verify ' + mode + ' theme expression: ' + expression);
}

export function audit(tokensSource, themeSource, minimum = 4.5) {
  const tokens = parseTokens(tokensSource);
  const scheme = section(themeSource, 'final scheme = ColorScheme(', '\n  );');
  const snackbar = section(themeSource, 'snackBarTheme: SnackBarThemeData(', '\n    ),');
  const onErrorExpr = attribute(scheme, 'onError');
  const errorExpr = attribute(scheme, 'error');
  const snackBgExpr = attribute(snackbar, 'backgroundColor');
  const snackTextExpr = attribute(section(snackbar, 'contentTextStyle: TextStyle(', '\n      ),'), 'color');
  const checks = [];
  for (const mode of ['light', 'dark']) {
    for (const [name, background, foreground] of [
      ['error-label', errorExpr, onErrorExpr],
      ['snackbar-message', snackBgExpr, snackTextExpr],
    ]) {
      const bg = resolveColor(background, mode, tokens);
      const fg = resolveColor(foreground, mode, tokens);
      const ratio = contrast(bg, fg);
      checks.push({ mode, name, background: bg, foreground: fg, ratio: Math.round(ratio * 100) / 100, passed: ratio >= minimum });
    }
  }
  return { minimum, checks, passed: checks.every(c => c.passed) };
}

const currentPath = process.argv[1] && resolve(process.argv[1]);
if (currentPath === fileURLToPath(import.meta.url)) {
  try {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
    const tokens = readFileSync(resolve(root, 'apps/mobile/lib/src/tokens/masanawa_tokens.dart'), 'utf8');
    const theme = readFileSync(resolve(root, 'apps/mobile/lib/src/theme/masanawa_theme.dart'), 'utf8');
    const result = audit(tokens, theme);
    console.log(JSON.stringify(result, null, 2));
    if (!result.passed) process.exitCode = 1;
  } catch (error) {
    console.error('F01 contrast cannot be verified: ' + error.message);
    process.exitCode = 2;
  }
}
