import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/commerce/wallet_models.dart';
import 'package:masanawa/src/core/api/models.dart';
import 'package:masanawa/src/state/session_state.dart';
import 'package:masanawa/src/state/wallet_state.dart';

SessionSignedIn _signedIn(String id) {
  final user = AuthUser(
    id: id,
    name: 'Fixture',
    locale: 'en',
    status: 'ACTIVE',
    role: 'fan',
    isNewUser: false,
    createdAt: '2026-10-12T00:00:00Z',
  );
  return SessionSignedIn(
    user,
    AuthTokens(
      accessToken: 'fixture-$id',
      refreshToken: 'fixture-$id',
      accessExpiresIn: 900,
      user: user,
    ),
  );
}

class _Session extends SessionController {
  @override
  SessionState build() => _signedIn('fan-a');
  void change(String? id) =>
      state = id == null ? const SessionSignedOut() : _signedIn(id);
}

WalletView _balance(int value) => WalletView(
  spendableCredits: value,
  pendingEarningsCredits: 0,
  availableEarningsCredits: 0,
  ngnBalanceKobo: 0,
  entries: const [],
);

class _Transport implements WalletTransport {
  final reads = <Completer<WalletView>>[];
  @override
  Future<WalletView> load() {
    final result = Completer<WalletView>();
    reads.add(result);
    return result.future;
  }

  @override
  Future<CreditTransferReceipt> sendCredits({
    required String recipient,
    required int amountCredits,
  }) => throw UnimplementedError();
  @override
  Future<GiftReceipt> sendGift({
    required String recipientCharacterId,
    required int amountCredits,
  }) => throw UnimplementedError();
}

void main() {
  late ProviderContainer container;
  late _Transport transport;
  setUp(() {
    transport = _Transport();
    container = ProviderContainer(
      overrides: [
        sessionProvider.overrideWith(_Session.new),
        walletTransportProvider.overrideWithValue(transport),
      ],
    );
    container.listen(walletProvider, (_, _) {});
  });
  tearDown(() => container.dispose());

  Future<void> flush() => Future<void>.delayed(Duration.zero);
  _Session session() => container.read(sessionProvider.notifier) as _Session;
  Future<void> initial() async {
    await flush();
    transport.reads.first.complete(_balance(11));
    await container.read(walletProvider.future);
  }

  test(
    'signed-in account replacement reloads without exposing old balance',
    () async {
      await initial();
      session().change('fan-b');
      await flush();
      expect(container.read(walletProvider).isLoading, isTrue);
      expect(transport.reads, hasLength(2));
      transport.reads[1].complete(_balance(22));
      expect(
        (await container.read(walletProvider.future))!.spendableCredits,
        22,
      );
    },
  );

  test('delayed refresh for A cannot replace B balance', () async {
    await initial();
    final old = container.read(walletProvider.notifier).refresh();
    await flush();
    session().change('fan-b');
    await flush();
    expect(transport.reads, hasLength(3));
    transport.reads[2].complete(_balance(22));
    await container.read(walletProvider.future);
    transport.reads[1].complete(_balance(99));
    await old;
    expect(container.read(walletProvider).value?.spendableCredits, 22);
  });

  test('logout fences delayed successful refresh', () async {
    await initial();
    final old = container.read(walletProvider.notifier).refresh();
    await flush();
    session().change(null);
    await flush();
    expect(await container.read(walletProvider.future), isNull);
    transport.reads[1].complete(_balance(99));
    await old;
    expect(container.read(walletProvider).value, isNull);
  });

  test('logout fences delayed failed refresh', () async {
    await initial();
    final old = container.read(walletProvider.notifier).refresh();
    await flush();
    session().change(null);
    await flush();
    await container.read(walletProvider.future);
    transport.reads[1].completeError(StateError('old account outage'));
    await old;
    expect(container.read(walletProvider).hasError, isFalse);
    expect(container.read(walletProvider).value, isNull);
  });

  test('newer refresh wins when previous request completes last', () async {
    await initial();
    final old = container.read(walletProvider.notifier).refresh();
    final next = container.read(walletProvider.notifier).refresh();
    await flush();
    transport.reads[2].complete(_balance(22));
    await next;
    transport.reads[1].complete(_balance(99));
    await old;
    expect(container.read(walletProvider).value?.spendableCredits, 22);
  });

  test('A to B to A does not revive an earlier account refresh', () async {
    await initial();
    final old = container.read(walletProvider.notifier).refresh();
    await flush();
    session().change('fan-b');
    await flush();
    session().change('fan-a');
    await flush();
    transport.reads[3].complete(_balance(33));
    await container.read(walletProvider.future);
    transport.reads[2].complete(_balance(22));
    transport.reads[1].complete(_balance(99));
    await old;
    await flush();
    expect(container.read(walletProvider).value?.spendableCredits, 33);
  });
  test(
    'initial account load completing last cannot replace a newer refresh',
    () async {
      await flush();
      final newer = container.read(walletProvider.notifier).refresh();
      await flush();
      transport.reads[1].complete(_balance(22));
      await newer;
      transport.reads[0].complete(_balance(99));
      await flush();
      expect(container.read(walletProvider).value?.spendableCredits, 22);
    },
  );

  test('account replacement fences delayed initial load', () async {
    await flush();
    session().change('fan-b');
    await flush();
    transport.reads[1].complete(_balance(22));
    await container.read(walletProvider.future);
    transport.reads[0].complete(_balance(99));
    await flush();
    expect(container.read(walletProvider).value?.spendableCredits, 22);
  });

  test('logout fences delayed initial load', () async {
    await flush();
    session().change(null);
    await flush();
    await container.read(walletProvider.future);
    transport.reads[0].complete(_balance(99));
    await flush();
    expect(container.read(walletProvider).value, isNull);
  });
}
