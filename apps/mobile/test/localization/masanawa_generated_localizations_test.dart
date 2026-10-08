import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/l10n/app_localizations.dart';
import 'package:masanawa/src/localization/masanawa_localization.dart';

void main() {
  test('generated translations preserve branded and distinct intents', () async {
    final en = await AppLocalizations.delegate.load(const Locale('en'));
    final ha = await AppLocalizations.delegate.load(const Locale('ha'));
    final ar = await AppLocalizations.delegate.load(const Locale('ar'));
    expect(en.appTitle, 'Masanawa');
    expect(en.splashTagline, 'Live conversations with people and AI');
    expect(ha.splashTagline, contains('mutane'));
    expect(ar.splashTagline, contains('محادثات'));
    expect(ha.startTalk, 'Fara hira');
    expect(ar.wallet, 'المحفظة');
    expect(en.talk, 'Talk');
    expect(en.startTalk, 'Start Talk');
  });

  test('ICU pluralization distinguishes empty and multiple Seats', () async {
    final en = await AppLocalizations.delegate.load(const Locale('en'));
    expect(en.speakerSeats(0), 'No speaker seats');
    expect(en.speakerSeats(1), '1 speaker seat');
    expect(en.speakerSeats(3), '3 speaker seats');
    final ar = await AppLocalizations.delegate.load(const Locale('ar'));
    expect(ar.speakerSeats(0), contains('لا توجد'));
    expect(ar.speakerSeats(2), contains('مقعدان'));
  });

  testWidgets('RTL works with localized application text', (tester) async {
    await tester.pumpWidget(MaterialApp(
      locale: const Locale('ar'),
      supportedLocales: MasanawaLocalization.supportedLocales,
      localizationsDelegates: MasanawaLocalization.delegates,
      home: Builder(builder: (context) => Scaffold(
        body: Text(AppLocalizations.of(context).wallet),
      )),
    ));
    expect(find.text('المحفظة'), findsOneWidget);
    expect(Directionality.of(tester.element(find.text('المحفظة'))),
      TextDirection.rtl);
  });
}
