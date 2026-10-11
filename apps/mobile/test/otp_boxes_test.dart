import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/l10n/app_localizations.dart';
import 'package:masanawa/src/core/api/models.dart';
import 'package:masanawa/src/screens/onboarding/otp_screen.dart';
import 'package:masanawa/src/state/session_state.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';

class _FixedSession extends SessionController {
  _FixedSession(this.fixed);
  final SessionState fixed;

  @override
  SessionState build() => fixed;
}

Widget _app() => ProviderScope(
      overrides: [
        sessionProvider.overrideWith(() => _FixedSession(
              const SessionAwaitingOtp(
                OtpChannel.sms,
                '+2348012345678',
                0,
              ),
            )),
      ],
      child: MaterialApp(
        theme: buildMasanawaTheme(brightness: Brightness.light),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: const OtpScreen(),
      ),
    );

void main() {
  testWidgets('OTP screen renders six code boxes', (tester) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();
    expect(find.byType(TextField), findsNWidgets(6));
  });

  testWidgets('typing advances and paste spreads across boxes',
      (tester) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();
    final fields = find.byType(TextField);
    await tester.enterText(fields.at(0), '7');
    await tester.pump();
    expect(find.text('7'), findsOneWidget);
    // Paste two digits into the second box: they spread, no verify fires.
    await tester.enterText(fields.at(1), '42');
    await tester.pump();
    expect(find.text('4'), findsOneWidget);
    expect(find.text('2'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
