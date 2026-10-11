import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';
import 'package:masanawa/main.dart';
import 'package:masanawa/src/screens/onboarding/phone_login_screen.dart';
import 'package:masanawa/src/ui/components/logo.dart';
import 'package:masanawa/src/core/api/models.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/core/providers.dart';

class _AuthCapabilitiesClient extends ApiClient {
  _AuthCapabilitiesClient()
    : super(dio: Dio(BaseOptions(baseUrl: 'https://example.test')));

  @override
  Future<List<OtpChannel>> authOtpChannels() async => const [OtpChannel.sms];
}

void main() {
  const storageChannel = MethodChannel(
    'plugins.it_nomads.com/flutter_secure_storage',
  );

  setUp(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(storageChannel, (_) async => null);
  });
  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(storageChannel, null);
  });

  testWidgets('fresh install shows the brand then opens phone login', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          apiClientProvider.overrideWithValue(_AuthCapabilitiesClient()),
        ],
        child: const MasanawaApp(),
      ),
    );
    await tester.pump();
    expect(find.byType(MasanawaLogo), findsOneWidget);
    expect(find.byType(PhoneLoginScreen), findsNothing);
    expect(tester.takeException(), isNull);

    await tester.pump(const Duration(milliseconds: 1300));
    await tester.pumpAndSettle();
    expect(find.byType(PhoneLoginScreen), findsOneWidget);
    expect(find.text('Welcome to Masanawa'), findsOneWidget);
    expect(tester.takeException(), isNull);

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
  });

  testWidgets('disposing splash before the brand delay cancels its timers', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          apiClientProvider.overrideWithValue(_AuthCapabilitiesClient()),
        ],
        child: const MasanawaApp(),
      ),
    );
    await tester.pump();
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(seconds: 7));
    expect(tester.takeException(), isNull);
    expect(find.byType(PhoneLoginScreen), findsNothing);
  });
}
