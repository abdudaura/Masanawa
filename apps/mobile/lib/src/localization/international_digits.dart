import 'package:flutter/services.dart';

/// Converts decimal numeral characters from common Unicode scripts to the
/// ASCII digits required by OTP verification and E.164 provider contracts.
/// It does not alter text outside decimal-digit ranges.
String normalizeInternationalDigits(String input) {
  const starts = <int>[
    0x0660, // Arabic-Indic
    0x06F0, // Eastern Arabic-Indic
    0x0966, // Devanagari
    0x09E6, // Bengali
    0x0A66, // Gurmukhi
    0x0AE6, // Gujarati
    0x0B66, // Oriya
    0x0BE6, // Tamil
    0x0C66, // Telugu
    0x0CE6, // Kannada
    0x0D66, // Malayalam
    0x0E50, // Thai
    0x0ED0, // Lao
    0x0F20, // Tibetan
    0x1040, // Myanmar
    0x17E0, // Khmer
    0xFF10, // Fullwidth
  ];
  return String.fromCharCodes(input.runes.map((rune) {
    for (final start in starts) {
      if (rune >= start && rune < start + 10) {
        return 0x30 + rune - start;
      }
    }
    return rune;
  }));
}

/// Apply before [FilteringTextInputFormatter.digitsOnly] (or phone-number
/// filters), so Arabic and other supported decimal digits are not discarded.
/// All conversions are one-to-one UTF-16 code units; caret offsets are stable.
final class InternationalDigitsFormatter extends TextInputFormatter {
  const InternationalDigitsFormatter();

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) => newValue.copyWith(text: normalizeInternationalDigits(newValue.text));
}
