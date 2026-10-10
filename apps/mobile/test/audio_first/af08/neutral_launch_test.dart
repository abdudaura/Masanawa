import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:masanawa/src/localization/masanawa_localization.dart';
import 'package:masanawa/src/screens/splash/splash_screen.dart';
import 'package:masanawa/src/state/session_state.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';
import 'package:masanawa/src/ui/components/logo.dart';
import 'package:masanawa/src/ui/components/masanawa_wordmark.dart';

class _SignedOutSession extends SessionController {
  @override
  SessionState build() => const SessionSignedOut();
}

Widget _launchApp({required Brightness brightness}) {
  final router = GoRouter(
    initialLocation: '/splash',
    routes: [
      GoRoute(path: '/splash', builder: (_, _) => const SplashScreen()),
      GoRoute(
        path: '/phone-login',
        builder: (_, _) => const Scaffold(body: Text('Signed out')),
      ),
    ],
  );
  return ProviderScope(
    overrides: [sessionProvider.overrideWith(_SignedOutSession.new)],
    child: MaterialApp.router(
      theme: buildMasanawaTheme(brightness: brightness),
      supportedLocales: MasanawaLocalization.supportedLocales,
      localizationsDelegates: MasanawaLocalization.delegates,
      routerConfig: router,
    ),
  );
}

void main() {
  for (final brightness in [Brightness.light, Brightness.dark]) {
    testWidgets('AF08 neutral splash matches native launch in $brightness',
        (tester) async {
      await tester.pumpWidget(_launchApp(brightness: brightness));

      final scaffold = tester.widget<Scaffold>(
        find.descendant(
          of: find.byType(SplashScreen),
          matching: find.byType(Scaffold),
        ),
      );
      expect(scaffold.backgroundColor, MasanawaColors.light().surfaceCard);

      final splashContainer = tester.widget<Container>(
        find.descendant(
          of: find.byType(SplashScreen),
          matching: find.byType(Container),
        ).first,
      );
      expect(splashContainer.color, MasanawaColors.light().surfaceCard);
      expect(splashContainer.decoration, isNull);
      expect(tester.widget<MasanawaLogo>(find.byType(MasanawaLogo)).dark, isFalse);
      expect(
        tester.widget<MasanawaWordmark>(find.byType(MasanawaWordmark)).light,
        isFalse,
      );

      await tester.pump(const Duration(milliseconds: 1300));
      expect(find.text('Signed out'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }
}
