import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/chat/cafe_suggestions.dart';

void main() {
  test('Internet Cafe starts with simple reselectable service intents', () {
    expect(
      kCafeSuggestions.map((item) => item.label).toList(),
      ['Data', 'Airtime', 'Electricity', 'TV'],
    );
  });

  test('Cafe shortcuts are plain chat messages, not form configuration', () {
    final keys = <String>{};
    for (final item in kCafeSuggestions) {
      expect(item.key.trim(), isNotEmpty);
      expect(item.message.trim(), isNotEmpty);
      expect(keys.add(item.key), isTrue);
    }
  });
}
