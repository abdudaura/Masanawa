import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// Structural localization release gate. Linguistic review, live UI coverage,
/// and accessibility are additional independent gates.
void main() {
  test('launch ARB catalogs have matching keys, metadata and placeholders', () {
    final root = Directory('lib/l10n');
    final sources = <String, Map<String, dynamic>>{};
    for (final lang in ['en', 'ha', 'ar', 'fr', 'es', 'pt']) {
      final source = File('${root.path}/app_$lang.arb');
      expect(source.existsSync(), isTrue, reason: source.path);
      sources[lang] = jsonDecode(source.readAsStringSync())
          as Map<String, dynamic>;
      expect(sources[lang]!['@@locale'], lang);
    }
    final template = sources['en']!;
    final keys = template.keys.where((key) =>
        !key.startsWith('@')).toSet();
    expect(keys, isNotEmpty);
    for (final entry in sources.entries) {
      final values = entry.value;
      expect(values.keys.where((key) => !key.startsWith('@')).toSet(),
          keys, reason: 'Missing/extra keys in ${entry.key}');
      for (final key in keys) {
        final value = values[key];
        expect(value, isA<String>(), reason: '${entry.key}/$key');
        expect((value as String).trim(), isNotEmpty,
            reason: '${entry.key}/$key empty');
        // Every source variable must survive translation, regardless of
        // the language's surrounding text and ICU plural grammar.
        final metadata = template['@$key'];
        expect(metadata, isA<Map<String, dynamic>>(),
            reason: 'Template needs translator context: $key');
        final placeholders = (metadata as Map<String, dynamic>)['placeholders'];
        if (placeholders is Map<String, dynamic>) {
          for (final token in placeholders.keys) {
            expect(value.contains('{$token') ||
                value.contains('{$token,'), isTrue,
                reason: '${entry.key}/$key missing $token');
          }
        }
      }
    }
  });
}
