import 'package:flutter/widgets.dart';

/// Presentation-only protection for identifiers embedded in translated prose.
///
/// An email address, account reference or E.164 telephone number is data, not
/// localizable words. LRI/PDI confines a left-to-right identifier to one run
/// inside Arabic right-to-left sentences. These controls are never added to
/// the raw input, API request or provider operation identifier.
abstract final class BidiDisplay {
  static const _ltrIsolate = '\u2066';
  static const _popDirectionIsolate = '\u2069';

  // Untrusted Unicode bidirectional controls can obscure the displayed
  // identity. Strip them from the display projection before applying an LRI.
  static final _embeddedControls = RegExp(
    '[\u202A-\u202E\u2066-\u2069]',
  );

  static String identifier(
    String raw, {
    required TextDirection surroundingDirection,
  }) {
    final displayValue = raw.replaceAll(_embeddedControls, '');
    if (surroundingDirection == TextDirection.ltr || displayValue.isEmpty) {
      return displayValue;
    }
    return '$_ltrIsolate$displayValue$_popDirectionIsolate';
  }
}
