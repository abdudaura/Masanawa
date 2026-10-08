import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/localization/international_digits.dart';

void main() {
  test('converts Arabic Indic and other Unicode decimal digits precisely', () {
    expect(normalizeInternationalDigits('١٢٣٤٥٦'), '123456');
    expect(normalizeInternationalDigits('۱۲۳۴۵۶'), '123456');
    expect(normalizeInternationalDigits('०१२३४५'), '012345');
    expect(normalizeInternationalDigits('１２３４５６'), '123456');
    expect(normalizeInternationalDigits('+٢٣٤ ٨٠١ ٢٣٤ ٥٦٧٨'),
        '+234 801 234 5678');
    expect(normalizeInternationalDigits('ami123@example.com'),
        'ami123@example.com');
  });

  test('formatter preserves editing offsets and ASCII-only verification', () {
    const formatter = InternationalDigitsFormatter();
    const input = TextEditingValue(
      text: '١٢٣٤٥٦',
      selection: TextSelection.collapsed(offset: 4),
    );
    final result = formatter.formatEditUpdate(
      TextEditingValue.empty,
      input,
    );
    expect(result.text, '123456');
    expect(result.selection.baseOffset, 4);
    expect(result.composing, TextRange.empty);
  });

  test('Unicode digits cannot bypass six-digit OTP length validation', () {
    const formatter = InternationalDigitsFormatter();
    final normalized = formatter.formatEditUpdate(
      TextEditingValue.empty,
      const TextEditingValue(text: '١٢٣٤٥٦٧'),
    );
    final limited = LengthLimitingTextInputFormatter(6).formatEditUpdate(
      TextEditingValue.empty,
      normalized,
    );
    expect(limited.text, '123456');
  });
}
