import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/api/models.dart';
import 'package:masanawa/src/finance/crypto_models.dart';
import 'package:masanawa/src/finance/crypto_state.dart';
import 'package:masanawa/src/finance/crypto_transport.dart';
import 'package:masanawa/src/finance/crypto_wallet_screen.dart';
import 'package:masanawa/src/state/session_state.dart';

class _Session extends SessionController {
  _Session(this.initial);
  final SessionState initial;
  @override
  SessionState build() => initial;
  void change(SessionState next) => state = next;
}

SessionSignedIn _signedIn(String userId) {
  final user = AuthUser(
    id: userId,
    name: userId,
    locale: 'en',
    status: 'ACTIVE',
    role: 'USER',
    isNewUser: false,
    createdAt: '2026-10-08T05:00:00Z',
  );
  return SessionSignedIn(user, AuthTokens(
    accessToken: 'token-$userId',
    refreshToken: 'refresh-$userId',
    accessExpiresIn: 900,
    user: user,
  ));
}

CryptoIntent _intent(String id) => CryptoIntent.fromJson({
      'requestId': id,
      'operation': 'deposit',
      'asset': 'btc',
      'amount': '0.01',
      'status': 'succeeded',
      'createdAt': '2026-10-08T05:00:00Z',
    });

class _Transport implements CryptoWalletTransport {
  int capabilityReads = 0;
  List<CryptoIntent> intents = [_intent('a-only')];
  Completer<CryptoBalance>? pendingBalance;
  Completer<CryptoIntent>? pendingDeposit;

  @override
  Future<CryptoCapabilities> capabilities() async {
    capabilityReads++;
    return const CryptoCapabilities(
      deposits: true,
      withdrawals: false,
      conversions: false,
      fiatOnRamp: false,
      fiatCurrencies: [],
      fiatSettlementProviderCode: null,
    );
  }

  @override
  Future<List<CryptoRoute>> depositRoutes() async =>
      [const CryptoRoute(providerCode: 'btc', asset: 'BTC', network: 'BTC')];

  @override
  Future<List<CryptoIntent>> history({int limit = 50}) async =>
      List.unmodifiable(intents);

  @override
  Future<CryptoBalance> balance(String providerCode) async {
    final gate = pendingBalance;
    return gate == null
        ? const CryptoBalance(providerCode: 'btc', amount: '0.1')
        : gate.future;
  }

  @override
  Future<CryptoIntent> createDeposit({
    required String requestId,
    required String providerCode,
    required String amount,
  }) => pendingDeposit?.future ?? Future.value(_intent(requestId));

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _Adapter implements HttpClientAdapter {
  _Adapter(this.handle);
  final Future<ResponseBody> Function(RequestOptions) handle;
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<List<int>>? requestStream,
    Future<void>? cancelFuture,
  ) => handle(options);
  @override
  void close({bool force = false}) {}
}

void main() {
  test('crypto bearer credentials are read live, including token rotation', () async {
    String? token = 'first-access';
    final headers = <String?>[];
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((options) async {
      headers.add(options.headers['Authorization'] as String?);
      return ResponseBody.fromString(jsonEncode({
        'deposits': false, 'withdrawals': false,
        'conversions': false, 'fiatOnRamp': false,
        'fiatCurrencies': [],
      }), 200, headers: {
        Headers.contentTypeHeader: ['application/json'],
      });
    });
    final transport = MasanawaCryptoWalletTransport(
      dio: dio,
      baseUrl: 'https://example.test',
      readAccessToken: () => token,
    );
    await transport.capabilities();
    token = 'rotated-access';
    await transport.capabilities();
    token = null;
    await transport.capabilities();
    expect(headers, ['Bearer first-access', 'Bearer rotated-access', null]);
  });

  test('signed-out crypto controller fails closed without network access', () async {
    final transport = _Transport();
    final session = _Session(const SessionSignedOut());
    final container = ProviderContainer(overrides: [
      sessionProvider.overrideWith(() => session),
      cryptoWalletTransportProvider.overrideWithValue(transport),
    ]);
    addTearDown(container.dispose);
    await expectLater(
      container.read(cryptoWalletProvider.future),
      throwsA(isA<StateError>()),
    );
    expect(transport.capabilityReads, 0);
  });

  test('switching user invalidates old balance and history, loads new owner', () async {
    final transport = _Transport();
    final session = _Session(_signedIn('owner-a'));
    final container = ProviderContainer(overrides: [
      sessionProvider.overrideWith(() => session),
      cryptoWalletTransportProvider.overrideWithValue(transport),
    ]);
    addTearDown(container.dispose);
    final a = await container.read(cryptoWalletProvider.future);
    expect(a.history.single.requestId, 'a-only');

    transport.intents = [_intent('b-only')];
    session.change(_signedIn('owner-b'));
    final b = await container.read(cryptoWalletProvider.future);
    expect(b.history.single.requestId, 'b-only');
    expect(b.history.any((row) => row.requestId == 'a-only'), isFalse);
    expect(transport.capabilityReads, 2);
  });

  test('late balance request cannot repopulate wallet after sign-out', () async {
    final transport = _Transport();
    final session = _Session(_signedIn('owner-a'));
    final container = ProviderContainer(overrides: [
      sessionProvider.overrideWith(() => session),
      cryptoWalletTransportProvider.overrideWithValue(transport),
    ]);
    addTearDown(container.dispose);
    await container.read(cryptoWalletProvider.future);
    final gate = Completer<CryptoBalance>();
    transport.pendingBalance = gate;
    final pending = container.read(cryptoWalletProvider.notifier).refreshBalance();
    session.change(const SessionSignedOut());
    gate.complete(const CryptoBalance(providerCode: 'btc', amount: '999'));
    await expectLater(pending, throwsA(isA<StateError>()));
    await expectLater(
      container.read(cryptoWalletProvider.future),
      throwsA(isA<StateError>()),
    );
  });

  test('late deposit response never enters the replacement user activity', () async {
    final transport = _Transport();
    final session = _Session(_signedIn('owner-a'));
    final container = ProviderContainer(overrides: [
      sessionProvider.overrideWith(() => session),
      cryptoWalletTransportProvider.overrideWithValue(transport),
    ]);
    addTearDown(container.dispose);
    await container.read(cryptoWalletProvider.future);
    final gate = Completer<CryptoIntent>();
    transport.pendingDeposit = gate;
    final oldRequest = container.read(cryptoWalletProvider.notifier).createDeposit(
      requestId: 'a-late',
      providerCode: 'btc',
      amount: '0.01',
    );

    transport.intents = [_intent('b-only')];
    session.change(_signedIn('owner-b'));
    gate.complete(_intent('a-late'));
    await expectLater(oldRequest, throwsA(isA<StateError>()));
    final replacement = await container.read(cryptoWalletProvider.future);
    expect(replacement.history.map((row) => row.requestId), ['b-only']);
    expect(replacement.history.any((row) => row.requestId == 'a-late'), isFalse);
  });

  testWidgets('signed-out and restoring app do not expose crypto amounts or actions',
      (tester) async {
    final transport = _Transport();
    final session = _Session(const SessionSignedOut());
    await tester.pumpWidget(ProviderScope(
      overrides: [
        sessionProvider.overrideWith(() => session),
        cryptoWalletTransportProvider.overrideWithValue(transport),
      ],
      child: const MaterialApp(home: CryptoWalletScreen()),
    ));
    await tester.pumpAndSettle();
    expect(find.textContaining('Sign in to view your crypto balance'), findsOneWidget);
    expect(find.text('Withdraw'), findsNothing);
    expect(transport.capabilityReads, 0);

    session.change(const SessionRestoring());
    await tester.pump();
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    expect(find.text('Withdraw'), findsNothing);
    expect(transport.capabilityReads, 0);
  });
}
