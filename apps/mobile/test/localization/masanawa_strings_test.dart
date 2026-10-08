import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/localization/masanawa_strings.dart';

void main() {
  test('navigation and actions are translated across launch languages', () {
    const keys = <String>[
      'home', 'agents', 'wallet', 'talk', 'explore', 'liveTalks',
      'startTalk', 'activity', 'profile', 'settings', 'retry',
      'cancel', 'confirm', 'loading',
    ];
    for (final code in ['en', 'ha', 'ar', 'fr', 'es', 'pt']) {
      for (final key in keys) {
        final translation = MasanawaStrings.get(Locale(code), key);
        expect(translation.trim(), isNotEmpty, reason: '$code/$key');
        expect(translation, isNot(key), reason: '$code/$key');
      }
    }
  });

  test('unknown locale or key falls back safely', () {
    expect(MasanawaStrings.get(const Locale('de'), 'wallet'), 'Wallet');
    expect(MasanawaStrings.get(const Locale('ar'), 'missing.key'), 'missing.key');
    expect(MasanawaStrings.get(const Locale('ha'), 'startTalk'), 'Fara hira');
  });
}
