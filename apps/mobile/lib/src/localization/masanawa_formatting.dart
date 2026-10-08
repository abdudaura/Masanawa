import 'package:flutter/widgets.dart';
import 'package:intl/intl.dart';

/// Presentation only: localization must never change exact money units,
/// custody/network IDs, provider amounts or the user's financial jurisdiction.
abstract final class MasanawaFormatting {
  static String decimal(num value, Locale locale, {int digits = 0}) {
    if (digits < 0 || digits > 18) {
      throw RangeError.range(digits, 0, 18, 'digits');
    }
    final format = NumberFormat.decimalPatternDigits(
      locale: Intl.canonicalizedLocale(locale.toLanguageTag()),
      decimalDigits: digits,
    );
    return format.format(value);
  }

  static String dateTime(DateTime value, Locale locale) {
    final local = value.toLocal();
    return DateFormat.yMMMd(Intl.canonicalizedLocale(locale.toLanguageTag()))
        .add_jm()
        .format(local);
  }

  /// Present an already-authoritative display string without currency
  /// conversion or floating-point arithmetic. Financial arithmetic stays
  /// exclusively on the canonical integer/decimal server contract.
  static String nativeMoney({
    required String exactFormattedAmount,
    required String currencyOrAssetCode,
  }) {
    if (exactFormattedAmount.trim().isEmpty ||
        currencyOrAssetCode.trim().isEmpty) {
      throw ArgumentError('Money display requires amount and native code');
    }
    return '${exactFormattedAmount.trim()} ${currencyOrAssetCode.trim()}';
  }
}
