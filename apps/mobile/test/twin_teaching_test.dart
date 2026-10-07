import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/twin/twin_teaching.dart';

void main() {
  test('interprets bounded low-risk profile teaching statements', () {
    expect(
      interpretTwinTeaching('My bio is Builder and teacher')!.patch.bio,
      'Builder and teacher',
    );
    expect(interpretTwinTeaching('I speak Hausa, English and Arabic'), isNull);
    expect(
      interpretTwinTeaching(
        "I'm interested in AI, education and football",
      )!.patch.interests,
      ['AI', 'education', 'football'],
    );
  });

  test('recognizes standing discoverability changes separately', () {
    expect(
      interpretTwinTeaching('make my twin public')!.patch.discoverable,
      isTrue,
    );
    expect(interpretTwinTeaching('hide my twin')!.patch.discoverable, isFalse);
  });

  test('does not guess at arbitrary memory statements', () {
    expect(
      interpretTwinTeaching('Remember that my first school was in Katsina'),
      isNull,
    );
  });
}
