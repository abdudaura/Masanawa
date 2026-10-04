import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/main.dart';
import 'package:masanawa/src/screens/onboarding/phone_login_screen.dart';

void main() {
  const storageChannel =
      MethodChannel('plugins.it_nomads.com/flutter_secure_storage');

  setUp(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(storageChannel, (_) async => null);
  });
  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(storageChannel, null);
  });

  testWidgets('fresh install shows the brand then opens phone login',
      (tester) async {
    await tester.pumpWidget(const ProviderScope(child: MasanawaApp()));
    await tester.pump();
    expect(find.text('Masanawa'), findsWidgets);
    expect(find.byType(PhoneLoginScreen), findsNothing);
    expect(tester.takeException(), isNull);

    await tester.pump(const Duration(milliseconds: 1300));
    await tester.pumpAndSettle();
    expect(find.byType(PhoneLoginScreen), findsOneWidget);
    expect(find.text('What number should we use?'), findsOneWidget);
    expect(tester.takeException(), isNull);

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
  });

  testWidgets('disposing splash before the brand delay cancels its timers',
      (tester) async {
    await tester.pumpWidget(const ProviderScope(child: MasanawaApp()));
    await tester.pump();
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(seconds: 7));
    expect(tester.takeException(), isNull);
    expect(find.byType(PhoneLoginScreen), findsNothing);
  });
}

