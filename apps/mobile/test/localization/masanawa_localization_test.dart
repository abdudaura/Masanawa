import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/localization/masanawa_localization.dart';

void main() {
  test('only enable UI locales supported by Flutter delegates', () {
    expect(MasanawaLocalization.supportedLocales.map((e) => e.languageCode),
        ['en', 'ha', 'ar', 'fr', 'es', 'pt']);
  });

  test('country variants resolve to a supported UI language', () {
    expect(
      MasanawaLocalization.resolve(
        const Locale('ar', 'EG'), MasanawaLocalization.supportedLocales),
      const Locale('ar'),
    );
    expect(
      MasanawaLocalization.resolve(
        const Locale('pt', 'BR'), MasanawaLocalization.supportedLocales),
      const Locale('pt'),
    );
  });

  test('uses second preferred language when primary device language is unsupported', () {
    expect(
      MasanawaLocalization.resolvePreferred(
        [const Locale('de', 'DE'), const Locale('ar', 'EG')],
        MasanawaLocalization.supportedLocales,
      ),
      const Locale('ar'),
    );
    expect(
      MasanawaLocalization.resolvePreferred(
        [const Locale('fr', 'CA'), const Locale('pt', 'BR')],
        MasanawaLocalization.supportedLocales,
      ),
      const Locale('fr'),
    );
  });

  test('unsupported languages fall back to English UI only', () {
    expect(
      MasanawaLocalization.resolve(
        const Locale('de', 'DE'), MasanawaLocalization.supportedLocales),
      const Locale('en'),
    );
    expect(
      MasanawaLocalization.resolve(null, MasanawaLocalization.supportedLocales),
      const Locale('en'),
    );
  });

  testWidgets('Arabic UI receives RTL framework directionality', (tester) async {
    await tester.pumpWidget(MaterialApp(
      locale: const Locale('ar'),
      supportedLocales: MasanawaLocalization.supportedLocales,
      localizationsDelegates: MasanawaLocalization.delegates,
      home: const Scaffold(body: Text('Masanawa')),
    ));
    expect(
      Directionality.of(tester.element(find.text('Masanawa'))),
      TextDirection.rtl,
    );
  });
}
