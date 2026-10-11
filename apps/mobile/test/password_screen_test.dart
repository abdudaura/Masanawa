import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/l10n/app_localizations.dart';
import 'package:masanawa/src/screens/onboarding/password_screen.dart';
import 'package:masanawa/src/state/session_state.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';

class _FixedSession extends SessionController {
  _FixedSession(this.fixed);
  final SessionState fixed;

  @override
  SessionState build() => fixed;
}

Widget _app({required bool setup}) => ProviderScope(
      overrides: [
        sessionProvider.overrideWith(() => _FixedSession(
              SessionPasswordRequired('+2348012345678', setup: setup),
            )),
      ],
      child: MaterialApp(
        theme: buildMasanawaTheme(brightness: Brightness.light),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: PasswordScreen(phone: '+2348012345678', setup: setup),
      ),
    );

void main() {
  testWidgets('password setup renders six boxes and asks to repeat',
      (tester) async {
    await tester.pumpWidget(_app(setup: true));
    await tester.pumpAndSettle();
    // Six entry boxes plus the language button label is not a field.
    expect(find.byType(TextField), findsNWidgets(6));
    final fields = find.byType(TextField);
    for (var i = 0; i < 6; i++) {
      await tester.enterText(fields.at(i), '${(i + 1) % 10}');
      await tester.pump();
    }
    await tester.pumpAndSettle();
    // First entry complete: the screen moved to the confirm step locally,
    // with no network involved.
    expect(find.text('Repeat your password'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('password entry renders six boxes', (tester) async {
    await tester.pumpWidget(_app(setup: false));
    await tester.pumpAndSettle();
    expect(find.byType(TextField), findsNWidgets(6));
    expect(find.text('Enter your password'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
