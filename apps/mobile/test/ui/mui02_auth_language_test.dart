import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:masanawa/src/core/api/models.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/core/providers.dart';
import 'package:masanawa/src/localization/locale_preference.dart';
import 'package:masanawa/src/localization/locale_preference_scope.dart';
import 'package:masanawa/src/localization/masanawa_localization.dart';
import 'package:masanawa/src/screens/onboarding/name_screen.dart';
import 'package:masanawa/src/screens/onboarding/otp_screen.dart';
import 'package:masanawa/src/screens/onboarding/password_screen.dart';
import 'package:masanawa/src/screens/onboarding/phone_login_screen.dart';
import 'package:masanawa/src/state/session_state.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';

class _MemoryLocaleStore implements LocalePreferenceStore {
  _MemoryLocaleStore(this.value);
  String? value;

  @override
  Future<String?> read() async => value;

  @override
  Future<void> write(String? languageCode) async {
    value = languageCode;
  }
}

class _FixedSession extends SessionController {
  _FixedSession(this.current);
  final SessionState current;

  @override
  SessionState build() => current;
}

/// Mount the real auth widgets with deterministic capability discovery.
class _TestAuthClient extends ApiClient {
  _TestAuthClient() : super(dio: Dio());

  @override
  Future<List<OtpChannel>> authOtpChannels() async => [OtpChannel.email];
}

SessionState _sessionFor(String route) => switch (route) {
      '/password' =>
        const SessionPasswordRequired('+2348012345678', setup: false),
      '/otp' =>
        const SessionAwaitingOtp(OtpChannel.email, 'fan@example.test', 0),
      '/name' =>
        const SessionNameRequired(OtpChannel.email, 'fan@example.test', '123456'),
      _ => const SessionSignedOut(),
    };

GoRouter _router(String initialLocation) => GoRouter(
      initialLocation: initialLocation,
      routes: [
        GoRoute(
          path: '/phone-login',
          builder: (_, _) => const PhoneLoginScreen(),
        ),
        GoRoute(
          path: '/password',
          builder: (_, _) => const PasswordScreen(
            phone: '+2348012345678',
            setup: false,
          ),
        ),
        GoRoute(path: '/otp', builder: (_, _) => const OtpScreen()),
        GoRoute(path: '/name', builder: (_, _) => const NameScreen()),
      ],
    );

Widget _app(
  GoRouter router,
  LocalePreferenceController preference,
  SessionState session, {
  required double textScale,
  ApiClient? api,
}) =>
    ProviderScope(
      overrides: [
        sessionProvider.overrideWith(() => _FixedSession(session)),
        apiClientProvider.overrideWithValue(api ?? _TestAuthClient()),
      ],
      child: ListenableBuilder(
        listenable: preference,
        builder: (context, _) => LocalePreferenceScope(
          controller: preference,
          child: MaterialApp.router(
            routerConfig: router,
            theme: buildMasanawaTheme(brightness: Brightness.light),
            locale: preference.localeOverride,
            supportedLocales: MasanawaLocalization.supportedLocales,
            localizationsDelegates: MasanawaLocalization.delegates,
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(context).copyWith(
                textScaler: TextScaler.linear(textScale),
              ),
              child: child!,
            ),
          ),
        ),
      ),
    );

class _PhoneAndEmailClient extends _TestAuthClient {
  @override
  Future<List<OtpChannel>> authOtpChannels() async => [OtpChannel.email, OtpChannel.sms];
}

class _ExpiredOtpClient extends _TestAuthClient {
  @override
  Future<AuthTokens> otpVerify(String code, {String? phone, String? email, String? name}) async {
    throw const ApiException('Invalid or expired code', code: 'OTP_INVALID');
  }
}

void main() {
  const routes = ['/phone-login', '/password', '/otp', '/name'];

  for (final route in routes) {
    for (final width in [320.0, 390.0]) {
      for (final language in ['en', 'ar']) {
        for (final scale in [1.0, 2.0]) {
          testWidgets(
            '$route: picker centered, tappable at $width px, '
            '$language, text scale $scale',
            (tester) async {
              tester.view.physicalSize = Size(width, 844);
              tester.view.devicePixelRatio = 1;
              addTearDown(tester.view.resetPhysicalSize);
              addTearDown(tester.view.resetDevicePixelRatio);

              final store = _MemoryLocaleStore(language);
              final preference = LocalePreferenceController(store);
              await preference.load();
              final router = _router(route);
              addTearDown(router.dispose);
              addTearDown(preference.dispose);
              await tester.pumpWidget(
                _app(
                  router,
                  preference,
                  _sessionFor(route),
                  textScale: scale,
                ),
              );
              await tester.pumpAndSettle();

              final picker = find.byKey(const Key('language-picker'));
              expect(picker, findsOneWidget);
              expect(tester.getCenter(picker).dx, closeTo(width / 2, 1.0));
              expect(find.byIcon(Icons.language), findsOneWidget);
              expect(tester.widget<TextButton>(picker).onPressed, isNotNull);
              final semantics = tester.ensureSemantics();
              expect(
                tester.getSemantics(picker).getSemanticsData().hasAction(SemanticsAction.tap),
                isTrue,
              );
              semantics.dispose();
              expect(tester.takeException(), isNull);
              expect(store.value, language);
            },
          );
        }
      }
    }
  }

  testWidgets('phone country stays selected after switching email and phone', (tester) async {
    final preference = LocalePreferenceController(_MemoryLocaleStore('en'));
    await preference.load();
    final router = _router('/phone-login');
    addTearDown(router.dispose);
    addTearDown(preference.dispose);
    await tester.pumpWidget(_app(router, preference, const SessionSignedOut(), textScale: 1, api: _PhoneAndEmailClient()));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Phone'));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('phone-country-picker')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('phone-country-GH')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), '0241234567');
    await tester.pump();
    expect(find.text('+233'), findsOneWidget);
    await tester.tap(find.text('Email'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Phone'));
    await tester.pumpAndSettle();
    expect(find.text('+233'), findsOneWidget);
    expect(find.text('+234'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('expired code during name completion returns to OTP recovery', (tester) async {
    final preference = LocalePreferenceController(_MemoryLocaleStore('en'));
    await preference.load();
    final router = _router('/name');
    addTearDown(router.dispose);
    addTearDown(preference.dispose);
    await tester.pumpWidget(_app(router, preference, _sessionFor('/name'), textScale: 1, api: _ExpiredOtpClient()));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'Ada Obi');
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    expect(find.byType(OtpScreen), findsOneWidget);
    expect(find.byType(NameScreen), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('selected language persists across mounted auth routes',
      (tester) async {
    tester.view.physicalSize = const Size(320, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final store = _MemoryLocaleStore('en');
    final preference = LocalePreferenceController(store);
    await preference.load();
    final router = _router('/phone-login');
    addTearDown(router.dispose);
    addTearDown(preference.dispose);
    await tester.pumpWidget(
      _app(router, preference, const SessionSignedOut(), textScale: 1),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('language-picker')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('language-fr')));
    await tester.pumpAndSettle();
    expect(store.value, 'fr');
    expect(preference.localeOverride, const Locale('fr'));
    expect(find.text('Langue de l’application'), findsOneWidget);

    router.go('/password');
    await tester.pumpAndSettle();
    expect(find.byType(PasswordScreen), findsOneWidget);
    expect(find.text('Langue de l’application'), findsOneWidget);
    expect(
      tester.getCenter(find.byKey(const Key('language-picker'))).dx,
      closeTo(160, 1.0),
    );
    expect(tester.takeException(), isNull);
  });
}
