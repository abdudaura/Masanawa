import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/localization/language_picker_button.dart';
import 'package:masanawa/src/localization/locale_preference.dart';
import 'package:masanawa/src/localization/locale_preference_scope.dart';
import 'package:masanawa/src/localization/masanawa_localization.dart';

final class _TestStore implements LocalePreferenceStore {
  _TestStore([this.value]);
  String? value;
  bool rejectWrites = false;

  @override
  Future<String?> read() async => value;

  @override
  Future<void> write(String? languageCode) async {
    if (rejectWrites) throw StateError('storage unavailable');
    value = languageCode;
  }
}

Future<void> _mountPicker(
  WidgetTester tester,
  LocalePreferenceController controller, {
  Locale language = const Locale('en'),
}) async {
  await tester.pumpWidget(
    LocalePreferenceScope(
      controller: controller,
      child: MaterialApp(
        locale: language,
        supportedLocales: MasanawaLocalization.supportedLocales,
        localizationsDelegates: MasanawaLocalization.delegates,
        home: const Scaffold(body: LanguagePickerButton()),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('changing a saved UI language rebuilds translated labels live',
      (tester) async {
    final store = _TestStore();
    final controller = LocalePreferenceController(store);
    await controller.load();
    await tester.pumpWidget(
      ListenableBuilder(
        listenable: controller,
        builder: (context, _) => LocalePreferenceScope(
          controller: controller,
          child: MaterialApp(
            locale: controller.localeOverride,
            supportedLocales: MasanawaLocalization.supportedLocales,
            localizationsDelegates: MasanawaLocalization.delegates,
            home: const Scaffold(body: LanguagePickerButton()),
          ),
        ),
      ),
    );
    expect(find.text('App language'), findsOneWidget);
    await tester.tap(find.byKey(const Key('language-picker')));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.byKey(const Key('language-fr')));
    await tester.tap(find.byKey(const Key('language-fr')));
    await tester.pumpAndSettle();

    expect(store.value, 'fr');
    expect(find.text('Langue de l’application'), findsOneWidget);
    expect(find.text('App language'), findsNothing);

    await tester.pumpWidget(const SizedBox.shrink());
    controller.dispose();
  });

  testWidgets('language picker stores an explicit UI language choice',
      (tester) async {
    final store = _TestStore();
    final controller = LocalePreferenceController(store);
    await controller.load();
    await _mountPicker(tester, controller);

    await tester.tap(find.byKey(const Key('language-picker')));
    await tester.pumpAndSettle();
    expect(find.text('Choose app language'), findsOneWidget);
    expect(find.byKey(const Key('language-ha-unavailable')), findsOneWidget);

    await tester.tap(find.byKey(const Key('language-fr')));
    await tester.pumpAndSettle();
    expect(store.value, 'fr');
    expect(controller.localeOverride, const Locale('fr'));

    await tester.pumpWidget(const SizedBox.shrink());
    controller.dispose();
  });

  testWidgets('device option clears a saved override', (tester) async {
    final store = _TestStore('es');
    final controller = LocalePreferenceController(store);
    await controller.load();
    await _mountPicker(tester, controller);

    await tester.tap(find.byKey(const Key('language-picker')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('language-device')));
    await tester.pumpAndSettle();
    expect(controller.localeOverride, isNull);
    expect(store.value, isNull);

    await tester.pumpWidget(const SizedBox.shrink());
    controller.dispose();
  });

  testWidgets('storage failure reports error and leaves selected language',
      (tester) async {
    final store = _TestStore('en')..rejectWrites = true;
    final controller = LocalePreferenceController(store);
    await controller.load();
    await _mountPicker(tester, controller);

    await tester.tap(find.byKey(const Key('language-picker')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('language-ar')));
    await tester.pumpAndSettle();

    expect(find.text('Could not save language preference. Try again.'),
        findsOneWidget);
    expect(controller.localeOverride, const Locale('en'));
    expect(store.value, 'en');

    await tester.pumpWidget(const SizedBox.shrink());
    controller.dispose();
  });

  testWidgets('Arabic picker labels and directionality are localized',
      (tester) async {
    final store = _TestStore();
    final controller = LocalePreferenceController(store);
    await controller.load();
    await _mountPicker(tester, controller, language: const Locale('ar'));

    expect(find.text('لغة التطبيق'), findsOneWidget);
    await tester.tap(find.byKey(const Key('language-picker')));
    await tester.pumpAndSettle();
    expect(find.text('اختر لغة التطبيق'), findsOneWidget);
    expect(
      Directionality.of(tester.element(find.text('اختر لغة التطبيق'))),
      TextDirection.rtl,
    );

    await tester.pumpWidget(const SizedBox.shrink());
    controller.dispose();
  });
}
