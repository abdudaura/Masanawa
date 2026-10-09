import '../localization/international_digits.dart';

/// Display-only digit review for low literacy / mixed scripts. Never use this
/// function as payment, recipient, OTP, or phone-number validation.
abstract final class ExperienceDigitReadback {
  /// Return one clearly separated digit at a time, retaining leading zeroes.
  /// Reject letters/signs and extremely long strings rather than guessing.
  static String? separate(String raw, {int maxDigits = 32}) {
    if (maxDigits < 1 || maxDigits > 128) {
      throw RangeError.range(maxDigits, 1, 128, 'maxDigits');
    }
    final digits = normalizeInternationalDigits(raw.trim());
    if (digits.isEmpty || digits.length > maxDigits ||
        !RegExp(r'^[0-9]+$').hasMatch(digits)) {
      return null;
    }
    return digits.split('').join(' ');
  }

  /// Explicit caller-supplied label; no implicit NGN, number parsing, exchange,
  /// or currency conversion. Invalid codes are not rendered as safe receipts.
  static String? exactAmountForReview({
    required String amount,
    required String currencyCode,
  }) {
    final cleanAmount = normalizeInternationalDigits(amount.trim());
    final cleanCode = currencyCode.trim();
    if (!RegExp(r'^[0-9]{1,16}([.][0-9]{1,18})?$')
            .hasMatch(cleanAmount) ||
        !RegExp(r'^[A-Z0-9]{2,12}$').hasMatch(cleanCode)) {
      return null;
    }
    return '$cleanAmount $cleanCode';
  }
}
