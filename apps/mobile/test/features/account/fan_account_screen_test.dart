import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/features/account/fan_account_repository.dart';
import 'package:masanawa/src/features/account/fan_account_screen.dart';

class _FakeRepo implements FanAccountRepository {
  _FakeRepo(this.accountKey, this.readResult);
  @override
  final String accountKey;
  final Future<FanAccountSummary> Function() readResult;
  bool current = true;
  @override bool get isCurrentAccount => current;
  @override Future<FanAccountSummary> read() => readResult();
}

const _account = FanAccountSummary(
  revision: 2, completed: true, displayName: 'Amina', language: 'ha');

Widget _app({required String keyName, required FanAccountRepository repo,
    VoidCallback? onWallet, VoidCallback? onSetup}) => MaterialApp(
  home: FanAccountScreen(accountKey: keyName, repository: repo,
      onWallet: onWallet, onCompleteSetup: onSetup),
);

void main() {
  test('malformed /v1/me projection fails closed', () {
    expect(() => FanAccountSummary.fromJson({'displayName':'x'}),
        throwsFormatException);
    expect(() => FanAccountSummary.fromJson({
      'revision':1,'completed':true,'displayName':42
    }), throwsFormatException);
  });

  testWidgets('C05 uses private projection and opens only connected destination',
      (tester) async {
    var wallets = 0;
    final repo = _FakeRepo('fan-a', () async => _account);
    await tester.pumpWidget(_app(keyName:'fan-a',repo:repo,
      onWallet:()=>wallets++));
    await tester.pumpAndSettle();
    expect(find.text('Amina'), findsOneWidget);
    expect(find.text('Private fan account'), findsOneWidget);
    expect(find.text('Following'), findsOneWidget);
    await tester.ensureVisible(find.byKey(const Key('account-wallet')));
    await tester.tap(find.byKey(const Key('account-wallet')));
    expect(wallets,1);
    final following = tester.widget<ListTile>(
        find.byKey(const Key('account-following')));
    expect(following.enabled, isFalse);
  });

  testWidgets('C05 clears in-flight old fan on account switch',
      (tester) async {
    final oldRequest = Completer<FanAccountSummary>();
    final a = _FakeRepo('fan-a', () => oldRequest.future);
    final b = _FakeRepo('fan-b', () async => const FanAccountSummary(
        revision:1,completed:true,displayName:'Bello'));
    await tester.pumpWidget(_app(keyName:'fan-a',repo:a));
    expect(find.byKey(const Key('account-loading')),findsOneWidget);
    a.current = false;
    await tester.pumpWidget(_app(keyName:'fan-b',repo:b));
    await tester.pumpAndSettle();
    expect(find.text('Bello'),findsOneWidget);
    oldRequest.complete(_account);
    await tester.pump();
    expect(find.text('Amina'),findsNothing);
  });

  testWidgets('C05 signed-out account never shows prior private data',
      (tester) async {
    final repo = _FakeRepo('fan-a', () async => _account);
    await tester.pumpWidget(_app(keyName:'fan-a',repo:repo));
    await tester.pumpAndSettle();
    repo.current = false;
    await tester.pumpWidget(_app(keyName:'fan-a',repo:repo));
    await tester.pumpAndSettle();
    expect(find.text('Amina'),findsNothing);
    expect(find.text('Sign in to view your private account.'), findsOneWidget);
  });

  testWidgets('C05 empty setup offers callback without publishing a fan profile',
      (tester) async {
    var setupCalls = 0;
    final repo = _FakeRepo('fan-a', () async => const FanAccountSummary(
      revision:1, completed:false, displayName:'Amina'));
    await tester.pumpWidget(_app(keyName:'fan-a',repo:repo,
      onSetup:()=>setupCalls++));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('account-complete-setup')));
    expect(setupCalls,1);
    expect(find.text('Create public profile'),findsNothing);
  });
}
