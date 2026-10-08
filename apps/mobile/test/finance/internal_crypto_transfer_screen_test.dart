import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/finance/internal_crypto_transfer_screen.dart';
import 'package:masanawa/src/state/session_state.dart';

class SignedOutSessionController extends SessionController {
  @override
  SessionState build() => const SessionSignedOut();
}

void main() {
  testWidgets('financial transfer screen never exposes private transfer composer while signed out',
    (tester) async {
    await tester.pumpWidget(ProviderScope(
      overrides: [
        sessionProvider.overrideWith(SignedOutSessionController.new),
      ],
      child: const MaterialApp(home: InternalCryptoTransferScreen()),
    ));
    expect(find.text('Sign in to view private transfers.'), findsOneWidget);
    expect(find.text('Review transfer quote'), findsNothing);
    expect(find.text('Internal crypto transfer'), findsOneWidget);
  });
}
