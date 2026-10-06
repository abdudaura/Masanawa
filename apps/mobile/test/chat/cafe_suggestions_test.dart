import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/chat/cafe_suggestions.dart';

void main() {
  test('cafe offers the four buying categories in order', () {
    expect(kCafeSuggestions.map((s) => s.label).toList(), [
      'Data',
      'Airtime',
      'Electricity',
      'TV',
      'Crypto',
    ]);
  });

  test('every suggestion is plain chat text with a unique key', () {
    final keys = <String>{};
    for (final suggestion in kCafeSuggestions) {
      expect(suggestion.key.trim(), isNotEmpty);
      expect(suggestion.label.trim(), isNotEmpty);
      expect(suggestion.message.trim(), isNotEmpty);
      expect(keys.add(suggestion.key), isTrue);
    }
  });
}
