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

  // Strip Unicode Bidi_Control characters from the *display projection* before
  // wrapping it in our own balanced LRI/PDI pair. Besides the explicit
  // overrides/isolates, the implicit marks ALM (U+061C), LRM (U+200E) and
  // RLM (U+200F) also affect ordering, including inside an outer isolate.
  // Do not modify the authoritative identifier sent to services.
  static final _embeddedControls = RegExp(
    '[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]',
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
