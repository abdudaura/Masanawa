import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/localization/bidi_display.dart';

void main() {
  test('email and international phone identifiers stay isolated inside RTL copy', () {
    expect(
      BidiDisplay.identifier('user@example.com',
          surroundingDirection: TextDirection.rtl),
      '\u2066user@example.com\u2069',
    );
    expect(
      BidiDisplay.identifier('+2348012345678',
          surroundingDirection: TextDirection.rtl),
      '\u2066+2348012345678\u2069',
    );
  });

  test('LTR UI leaves safely displayed identifiers as ordinary text', () {
    expect(
      BidiDisplay.identifier('user@example.com',
          surroundingDirection: TextDirection.ltr),
      'user@example.com',
    );
  });

  test('embedded bidi override controls cannot manipulate displayed destination', () {
    const unsafe = 'user\u202E@example.com';
    expect(
      BidiDisplay.identifier(unsafe, surroundingDirection: TextDirection.rtl),
      '\u2066user@example.com\u2069',
    );
    // No mutation of source/authentication identifier occurs in this helper.
    expect(unsafe, contains('\u202E'));
  });

  test('all Unicode Bidi_Control marks are excluded from display, in LTR and RTL', () {
    const controls = <String>[
      '\u061C', // ALM: Arabic letter mark
      '\u200E', // LRM: left-to-right mark
      '\u200F', // RLM: right-to-left mark
      '\u202A', // LRE
      '\u202B', // RLE
      '\u202C', // PDF
      '\u202D', // LRO
      '\u202E', // RLO
      '\u2066', // LRI
      '\u2067', // RLI
      '\u2068', // FSI
      '\u2069', // PDI
    ];

    for (final control in controls) {
      final raw = 'customer' + control + '@example.com';
      expect(
        BidiDisplay.identifier(raw, surroundingDirection: TextDirection.ltr),
        'customer@example.com',
        reason: 'The raw directional mark must not survive in LTR display',
      );
      expect(
        BidiDisplay.identifier(raw, surroundingDirection: TextDirection.rtl),
        '\u2066customer@example.com\u2069',
        reason: 'Only one balanced helper-owned LRI/PDI pair is allowed',
      );
      expect(raw, contains(control),
          reason: 'Display sanitization must not mutate authoritative input');
    }
  });

  test('preserves actual Arabic/Hausa text, punctuation and exact identifiers', () {
    const value = 'مستخدم.Hausa+234@example.com';
    expect(
      BidiDisplay.identifier(value, surroundingDirection: TextDirection.ltr),
      value,
    );
    expect(
      BidiDisplay.identifier(value, surroundingDirection: TextDirection.rtl),
      '\u2066' + value + '\u2069',
    );
  });

  test('stripping only direction marks leaves an empty identifier unwrapped', () {
    expect(
      BidiDisplay.identifier('\u200F\u061C',
          surroundingDirection: TextDirection.rtl),
      isEmpty,
    );
    expect(
      BidiDisplay.identifier('', surroundingDirection: TextDirection.rtl),
      isEmpty,
    );
  });
}
