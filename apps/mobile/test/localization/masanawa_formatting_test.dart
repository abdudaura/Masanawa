import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/localization/masanawa_formatting.dart';

void main() {
  test('number presentation follows locale, not account jurisdiction', () {
    expect(MasanawaFormatting.decimal(1234.5, const Locale('en'), digits: 1),
        '1,234.5');
    expect(MasanawaFormatting.decimal(1234.5, const Locale('fr'), digits: 1),
        isNot('1,234.5'));
  });

  test('native financial code remains unchanged', () {
    expect(MasanawaFormatting.nativeMoney(
      exactFormattedAmount: '1,234.50', currencyOrAssetCode: 'NGN'),
      '1,234.50 NGN');
    expect(MasanawaFormatting.nativeMoney(
      exactFormattedAmount: '10.000000', currencyOrAssetCode: 'USDT'),
      '10.000000 USDT');
  });

  test('rejects empty or ambiguous amount representation', () {
    expect(() => MasanawaFormatting.nativeMoney(
      exactFormattedAmount: '', currencyOrAssetCode: 'NGN'),
      throwsArgumentError);
  });
}
