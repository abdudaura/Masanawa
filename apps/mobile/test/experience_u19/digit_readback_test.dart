import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/experience_quality/digit_readback.dart';

void main() {
  test('Hausa/English + Arabic numerals retain leading zero in readback', () {
    expect(ExperienceDigitReadback.separate('٠٧۰١  '), isNull,
        reason: 'Whitespace inside a sensitive identifier is not silently removed');
    expect(ExperienceDigitReadback.separate('٠٧۰١'), '0 7 0 1');
    expect(ExperienceDigitReadback.separate('0701'), '0 7 0 1');
    expect(ExperienceDigitReadback.separate('０９'), '0 9');
  });

  test('unsafe phone and non-digit inputs are not guessed', () {
    expect(ExperienceDigitReadback.separate('+234801'), isNull);
    expect(ExperienceDigitReadback.separate('07O1'), isNull);
    expect(ExperienceDigitReadback.separate(''), isNull);
    expect(ExperienceDigitReadback.separate('0' * 33), isNull);
    expect(() => ExperienceDigitReadback.separate('123', maxDigits: 0),
        throwsRangeError);
  });

  test('exact amount review never assumes NGN or converts floats', () {
    expect(ExperienceDigitReadback.exactAmountForReview(
        amount: '١٢.٥٠', currencyCode: 'USDT'), '12.50 USDT');
    expect(ExperienceDigitReadback.exactAmountForReview(
        amount: '1000', currencyCode: 'NGN'), '1000 NGN');
    expect(ExperienceDigitReadback.exactAmountForReview(
        amount: '1,000', currencyCode: 'NGN'), isNull);
    expect(ExperienceDigitReadback.exactAmountForReview(
        amount: '100', currencyCode: 'usd'), isNull);
    expect(ExperienceDigitReadback.exactAmountForReview(
        amount: '-100', currencyCode: 'NGN'), isNull);
  });
}
