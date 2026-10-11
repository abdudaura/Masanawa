import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

// Design gate: widget code must read colors from the token/theme layer.
// Any raw `Color(0x…)` or `#RRGGBB` literal outside lib/src/tokens and
// lib/src/theme fails this test. Move the value into masanawa_tokens.dart
// (and masanawa_theme.dart when it needs a semantic role) instead.
void main() {
  test('no hardcoded colors outside tokens/theme', () {
    final lib = Directory('lib');
    expect(lib.existsSync(), isTrue, reason: 'run flutter test from apps/mobile');
    final hexExp = RegExp(r'#[0-9a-fA-F]{6}\b');
    final colorExp = RegExp(r'Color\s*\(\s*0x');
    final sep = Platform.pathSeparator;
    final offenders = <String>[];
    for (final entity in lib.listSync(recursive: true)) {
      if (entity is! File || !entity.path.endsWith('.dart')) continue;
      if (entity.path.contains('src${sep}tokens') ||
          entity.path.contains('src${sep}theme')) {
        continue;
      }
      final lines = entity.readAsLinesSync();
      for (var i = 0; i < lines.length; i++) {
        final code = lines[i].split('//').first;
        if (hexExp.hasMatch(code) || colorExp.hasMatch(code)) {
          offenders.add('${entity.path}:${i + 1}: ${code.trim()}');
        }
      }
    }
    expect(
      offenders,
      isEmpty,
      reason: 'Move these into tokens:\n${offenders.join('\n')}',
    );
  });
}
