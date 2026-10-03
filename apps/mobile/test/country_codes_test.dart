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

    test('bare digits opening with a known code resolve to it', () {
      expect(detectCountry('2348012345678').iso, 'NG');
      expect(detectCountry('254700000000').iso, 'KE');
    });

    test('unknown codes report an unknown region', () {
      expect(detectCountry('+999123456').iso, 'UN');
    });
  });

  group('normalizeE164', () {
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
