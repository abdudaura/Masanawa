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
}
