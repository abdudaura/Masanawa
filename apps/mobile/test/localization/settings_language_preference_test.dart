import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/api/models.dart';
import 'package:masanawa/src/localization/locale_preference.dart';
import 'package:masanawa/src/localization/locale_preference_scope.dart';
import 'package:masanawa/src/localization/masanawa_localization.dart';
import 'package:masanawa/src/screens/settings/settings_screen.dart';
import 'package:masanawa/src/state/agent_directory_state.dart';
import 'package:masanawa/src/state/session_state.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';

const _user = AuthUser(
  id: 'settings_user',
  name: 'Amina',
  email: 'amina@example.test',
  locale: 'en',
  status: 'ACTIVE',
  role: 'USER',
  isNewUser: false,
  createdAt: '2026-10-08T00:00:00Z',
);
const _tokens = AuthTokens(
  accessToken: 'test',
  refreshToken: 'refresh',
  accessExpiresIn: 900,
  user: _user,
);

class _SignedIn extends SessionController {
  @override
  SessionState build() => const SessionSignedIn(_user, _tokens);
}

// Settings must not issue network directory requests to change UI language.
class _QuietDirectory extends AgentDirectoryController {
  @override
  AgentDirectoryState build() => const AgentDirectoryState(loading: false);
}

class _MemoryPreference implements LocalePreferenceStore {
  _MemoryPreference([this.saved]);
  String? saved;
  bool denyWrite = false;
  int writes = 0;

  @override
  Future<String?> read() async => saved;

  @override
  Future<void> write(String? languageCode) async {
    if (denyWrite) throw StateError('encrypted storage unavailable');
    saved = languageCode;
    writes++;
  }
}

Widget _app(LocalePreferenceController controller) => ProviderScope(
      overrides: [
        sessionProvider.overrideWith(_SignedIn.new),
        agentDirectoryProvider.overrideWith(_QuietDirectory.new),
      ],
      child: ListenableBuilder(
        listenable: controller,
        builder: (context, _) => LocalePreferenceScope(
          controller: controller,
          child: MaterialApp(
            locale: controller.override,
            supportedLocales: MasanawaLocalization.supportedLocales,
            localizationsDelegates: MasanawaLocalization.delegates,
            theme: buildMasanawaTheme(brightness: Brightness.light),
            home: const SettingsScreen(),
          ),
        ),
      ),
    );

Future<void> _openPicker(WidgetTester tester) async {
  final control = find.byKey(const Key('language-picker'));
  await tester.ensureVisible(control);
  await tester.pumpAndSettle();
  await tester.tap(control);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('authenticated Settings exposes the real persisted locale picker',
      (tester) async {
    final store = _MemoryPreference();
    final controller = LocalePreferenceController(store);
    await controller.load();
    await tester.pumpWidget(_app(controller));
    await tester.pumpAndSettle();

    await _openPicker(tester);
    expect(find.byKey(const Key('language-device')), findsOneWidget);
    expect(find.byKey(const Key('language-ha-unavailable')), findsOneWidget);
    await tester.ensureVisible(find.byKey(const Key('language-fr')));
    await tester.tap(find.byKey(const Key('language-fr')));
    await tester.pumpAndSettle();

    expect(store.saved, 'fr');
    expect(store.writes, 1);
    expect(controller.override, const Locale('fr'));
    expect(find.text('Langue de l’application'), findsOneWidget);

    await _openPicker(tester);
    await tester.tap(find.byKey(const Key('language-device')));
    await tester.pumpAndSettle();

    expect(store.saved, isNull);
    expect(controller.override, isNull);
    expect(store.writes, 2);

    await tester.pumpWidget(const SizedBox.shrink());
    controller.dispose();
  });

  testWidgets('Settings preference is recovered after app restart',
      (tester) async {
    final store = _MemoryPreference('ar');
    final first = LocalePreferenceController(store);
    await first.load();
    await tester.pumpWidget(_app(first));
    await tester.pumpAndSettle();

    expect(find.text('لغة التطبيق'), findsOneWidget);
    expect(
      Directionality.of(tester.element(find.text('لغة التطبيق'))),
      TextDirection.rtl,
    );

    await tester.pumpWidget(const SizedBox.shrink());
    first.dispose();

    final restarted = LocalePreferenceController(store);
    await restarted.load();
    await tester.pumpWidget(_app(restarted));
    await tester.pumpAndSettle();
    expect(restarted.override, const Locale('ar'));
    expect(find.text('لغة التطبيق'), findsOneWidget);
    expect(store.writes, 0);

    await tester.pumpWidget(const SizedBox.shrink());
    restarted.dispose();
  });

  testWidgets('failed secure-storage write does not claim language changed',
      (tester) async {
    final store = _MemoryPreference('en')..denyWrite = true;
    final controller = LocalePreferenceController(store);
    await controller.load();
    await tester.pumpWidget(_app(controller));
    await tester.pumpAndSettle();

    await _openPicker(tester);
    await tester.ensureVisible(find.byKey(const Key('language-es')));
    await tester.tap(find.byKey(const Key('language-es')));
    await tester.pumpAndSettle();

    expect(store.saved, 'en');
    expect(controller.override, const Locale('en'));
    expect(
      find.text('Could not save language preference. Try again.'),
      findsOneWidget,
    );

    await tester.pumpWidget(const SizedBox.shrink());
    controller.dispose();
  });
}
