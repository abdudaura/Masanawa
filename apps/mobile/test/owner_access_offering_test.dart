import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/owner_access/owner_access.dart';

void main() {
  test('owner access offering stays simple and owner-controlled', () {
    const offering = OwnerAccessOffering(
      enabled: true,
      modalities: {
        OwnerAccessModality.text,
        OwnerAccessModality.voice,
      },
      durationOptionsMinutes: [15, 30],
      priceCreditsPerMinute: 20,
    );

    final disabled = offering.copyWith(enabled: false);

    expect(offering.modalities.length, 2);
    expect(offering.durationOptionsMinutes, [15, 30]);
    expect(offering.priceCreditsPerMinute, 20);
    expect(disabled.enabled, isFalse);
  });
}
