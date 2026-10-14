import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/phone/country_codes.dart';
import 'package:masanawa/src/localization/masanawa_localization.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';
import 'package:masanawa/src/ui/components/phone_field.dart';

void main() {
  testWidgets(
    'local digits keep Nigeria while explicit international input changes country',
    (tester) async {
      final controller = TextEditingController();
      addTearDown(controller.dispose);
      await tester.pumpWidget(
        MaterialApp(
          theme: buildMasanawaTheme(brightness: Brightness.light),
          supportedLocales: MasanawaLocalization.supportedLocales,
          localizationsDelegates: MasanawaLocalization.delegates,
          home: Scaffold(body: PhoneField(controller: controller)),
        ),
      );
      await tester.enterText(find.byType(TextField), '1');
      await tester.pump();
      expect(find.text('+234'), findsOneWidget);
      await tester.enterText(find.byType(TextField), '+44 20 7946 0000');
      await tester.pump();
      expect(find.text('+44'), findsOneWidget);
    },
  );

  testWidgets(
    'manual country choice survives local typing and normalizes correctly',
    (tester) async {
      final controller = TextEditingController();
      addTearDown(controller.dispose);
      PhoneCountry selected = kDefaultCountry;
      await tester.pumpWidget(
        MaterialApp(
          theme: buildMasanawaTheme(brightness: Brightness.light),
          supportedLocales: MasanawaLocalization.supportedLocales,
          localizationsDelegates: MasanawaLocalization.delegates,
          home: Scaffold(
            body: PhoneField(
              controller: controller,
              onCountryChanged: (country) => selected = country,
            ),
          ),
        ),
      );
      await tester.tap(find.byKey(const Key('phone-country-picker')));
      await tester.pumpAndSettle();
      final choice = find.byKey(const Key('phone-country-GB'));
      expect(choice, findsOneWidget);
      await tester.ensureVisible(choice);
      await tester.tap(choice);
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), '020 7946 0000');
      await tester.pump();
      expect(find.text('+44'), findsOneWidget);
      expect(selected.iso, 'GB');
      expect(
        normalizeE164(controller.text, country: selected),
        '+442079460000',
      );
    },
  );
}
