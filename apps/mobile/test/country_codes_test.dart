import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/phone/country_codes.dart';

void main() {
  group('detectCountry', () {
    test('empty input falls back to Nigeria', () {
      expect(detectCountry('').iso, 'NG');
    });

    test('detects Ghana from a full international number', () {
      final c = detectCountry('+233 24 123 4567');
      expect(c.iso, 'GH');
      expect(c.name, 'Ghana');
    });

    test('detects the UK from a 0044 prefix', () {
      expect(detectCountry('0044 20 7946 0000').iso, 'GB');
    });

    test('leading zero means a Nigerian national number', () {
      expect(detectCountry('08012345678').iso, 'NG');
    });

    test('local digits never switch the selected country', () {
      for (final number in ['1', '2', '27', '33', '8012345678']) {
        expect(detectCountry(number).iso, 'NG');
      }
    });

    test('unknown codes report an unknown region', () {
      expect(detectCountry('+999123456').iso, 'UN');
    });
  });

  group('normalizeE164', () {
    test('bare local digits never become a different international number', () {
      expect(normalizeE164('1234567890'), '+2341234567890');
    });
    test('keeps international format as-is', () {
      expect(normalizeE164('+233 24 123 4567'), '+233241234567');
    });

    test('converts 00 prefix to +', () {
      expect(normalizeE164('0044 20 7946 0000'), '+442079460000');
    });

    test('strips the Nigerian trunk zero', () {
      expect(normalizeE164('08012345678'), '+2348012345678');
    });
  });
}
