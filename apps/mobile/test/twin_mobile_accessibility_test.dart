import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/agents/twin_directory.dart';
import 'package:masanawa/src/commerce/wallet_models.dart';
import 'package:masanawa/src/screens/explore/explore_screen.dart';
import 'package:masanawa/src/screens/wallet/wallet_screen.dart';
import 'package:masanawa/src/state/session_state.dart';
import 'package:masanawa/src/state/twin_directory_state.dart';
import 'package:masanawa/src/state/wallet_state.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';

class _WalletTransport implements WalletTransport {
  @override
  Future<WalletView> load() async => WalletView(
        spendableCredits: 123456,
        pendingEarningsCredits: 23456,
        availableEarningsCredits: 34567,
        ngnBalanceKobo: 0,
        entries: [
          WalletEntry(
            id: 'entry-1',
            kind: WalletEntryKind.commission,
            title: 'Commission from a completed purchase',
            amountCredits: 123456,
            incoming: true,
            createdAt: DateTime.utc(2026, 10, 6),
          ),
        ],
      );

  @override
  Future<CreditTransferReceipt> sendCredits({
    required String recipient,
    required int amountCredits,
  }) {
    throw UnimplementedError();
  }

  @override
  Future<GiftReceipt> sendGift({
    required String recipientCharacterId,
    required int amountCredits,
  }) {
    throw UnimplementedError();
  }
}

class _DirectoryTransport implements TwinDirectoryTransport {
  @override
  Future<TwinDirectoryPage> search({
    required String query,
    String? cursor,
    int limit = 30,
  }) async =>
      const TwinDirectoryPage(
        items: [
          TwinDirectoryEntry(
            publicId: 'amina-bello',
            characterId: 'character-amina',
            displayName: 'Amina Bello',
            bio: 'Teacher, storyteller and lifelong learner.',
            languages: ['English', 'Hausa', 'Arabic'],
            voiceEnabled: true,
            ownerAccessEnabled: true,
            publicUrl: 'https://masanawa.com/twin/amina-bello',
          ),
        ],
        nextCursor: null,
      );

  @override
  Future<TwinDirectoryEntry?> resolve({required String publicId}) async => null;
}

Future<void> _pumpNarrowLargeText(
  WidgetTester tester, {
  required Widget child,
  List<Override> overrides = const [],
}) async {
  tester.view.physicalSize = const Size(320, 640);
  tester.view.devicePixelRatio = 1;
  addTearDown(() {
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });

  await tester.pumpWidget(
    ProviderScope(
      overrides: overrides,
      child: MaterialApp(
        theme: buildMasanawaTheme(brightness: Brightness.light),
        builder: (context, appChild) => MediaQuery(
          data: MediaQuery.of(context).copyWith(
            textScaler: const TextScaler.linear(2),
          ),
          child: appChild!,
        ),
        home: child,
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Wallet avoids horizontal overflow at 320px and 200% text',
      (tester) async {
    await _pumpNarrowLargeText(
      tester,
      overrides: [
        isSignedInProvider.overrideWithValue(true),
        walletTransportProvider.overrideWithValue(_WalletTransport()),
      ],
      child: WalletScreen(
        onAddMoney: () {},
        onSend: () {},
        onWithdraw: () {},
        onBuyBills: () {},
        onOpenCrypto: () {},
      ),
    );

    expect(tester.takeException(), isNull);
    expect(find.text('Add money'), findsOneWidget);
    expect(find.text('Send'), findsOneWidget);
    expect(find.text('Withdraw'), findsOneWidget);
    expect(find.text('Bills'), findsOneWidget);
    expect(find.text('Crypto'), findsOneWidget);
    expect(find.text('+123456 Cr'), findsOneWidget);
  });

  testWidgets('Explore exposes a semantic Twin action at large text',
      (tester) async {
    final semantics = tester.ensureSemantics();
    addTearDown(semantics.dispose);

    await _pumpNarrowLargeText(
      tester,
      overrides: [
        twinDirectoryTransportProvider
            .overrideWithValue(_DirectoryTransport()),
      ],
      child: ExploreScreen(onOpenTwin: (_) {}),
    );

    expect(tester.takeException(), isNull);
    expect(find.text('Amina Bello'), findsOneWidget);
    expect(find.bySemanticsLabel('Open AI Twin Amina Bello'), findsOneWidget);
  });
}
