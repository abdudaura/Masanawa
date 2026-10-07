import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/activity/talk_activity.dart';
import 'package:masanawa/src/screens/activity/activity_screen.dart';
import 'package:masanawa/src/state/talk_activity_state.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';

class _ActivityTransport implements TalkActivityTransport {
  final List<TalkActivityFilter> loads = [];

  @override
  Future<List<TalkActivityItem>> load({
    required TalkActivityFilter filter,
    int limit = 60,
  }) async {
    loads.add(filter);
    return switch (filter) {
      TalkActivityFilter.all => [
          TalkActivityItem(
            id: 'invite-1',
            kind: TalkActivityKind.talkInvitation,
            title: 'Amina invited you to a Talk',
            detail: 'Should AI be taught in secondary school?',
            createdAt: DateTime(2026, 10, 7, 8),
            talkId: 'talk-1',
            requiresAction: true,
            actionLabel: 'Open Talk',
            unread: true,
          ),
          TalkActivityItem(
            id: 'gift-1',
            kind: TalkActivityKind.gift,
            title: 'You received a gift',
            detail: 'From your Talk about small businesses.',
            createdAt: DateTime(2026, 10, 7, 7),
            amountLabel: '₦500',
          ),
        ],
      TalkActivityFilter.talks => [
          TalkActivityItem(
            id: 'seat-1',
            kind: TalkActivityKind.aiSeatAccepted,
            title: 'Sponsored Expert accepted',
            detail: 'The Economist joined your Talk.',
            createdAt: DateTime(2026, 10, 7, 8),
            talkId: 'talk-2',
          ),
        ],
      TalkActivityFilter.money => [
          TalkActivityItem(
            id: 'earning-1',
            kind: TalkActivityKind.earning,
            title: 'Creator earnings available',
            detail: 'AI Seat revenue is ready.',
            createdAt: DateTime(2026, 10, 7, 7),
            transactionId: 'txn-1',
            amountLabel: '₦240',
          ),
        ],
      TalkActivityFilter.social => [
          TalkActivityItem(
            id: 'follow-1',
            kind: TalkActivityKind.follow,
            title: 'Musa followed you',
            detail: 'They found you from a live Talk.',
            createdAt: DateTime(2026, 10, 7, 6),
            profilePublicId: 'musa',
          ),
        ],
    };
  }
}

class _FailingActivityTransport implements TalkActivityTransport {
  @override
  Future<List<TalkActivityItem>> load({
    required TalkActivityFilter filter,
    int limit = 60,
  }) {
    throw Exception('DioException socket transport exploded');
  }
}

Widget _app({
  required TalkActivityTransport transport,
  void Function(String)? onOpenTalk,
  void Function(String)? onOpenProfile,
  void Function(String)? onOpenTransaction,
}) {
  return ProviderScope(
    overrides: [
      talkActivityTransportProvider.overrideWithValue(transport),
    ],
    child: MaterialApp(
      theme: buildMasanawaTheme(brightness: Brightness.light),
      home: ActivityScreen(
        onOpenTalk: onOpenTalk,
        onOpenProfile: onOpenProfile,
        onOpenTransaction: onOpenTransaction,
      ),
    ),
  );
}

void main() {
  testWidgets('Activity exposes All Talks Money Social filters',
      (tester) async {
    final transport = _ActivityTransport();
    await tester.pumpWidget(_app(transport: transport));
    await tester.pumpAndSettle();

    expect(find.text('All'), findsOneWidget);
    expect(find.text('Talks'), findsOneWidget);
    expect(find.text('Money'), findsOneWidget);
    expect(find.text('Social'), findsOneWidget);
    expect(find.text('Amina invited you to a Talk'), findsOneWidget);
    expect(find.text('You received a gift'), findsOneWidget);
    expect(find.text('₦500'), findsOneWidget);
  });

  testWidgets('filters fetch only their relevant projection', (tester) async {
    final transport = _ActivityTransport();
    await tester.pumpWidget(_app(transport: transport));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Money'));
    await tester.pumpAndSettle();

    expect(find.text('Creator earnings available'), findsOneWidget);
    expect(find.text('₦240'), findsOneWidget);
    expect(find.text('Amina invited you to a Talk'), findsNothing);
    expect(transport.loads, contains(TalkActivityFilter.money));

    await tester.tap(find.text('Social'));
    await tester.pumpAndSettle();

    expect(find.text('Musa followed you'), findsOneWidget);
    expect(find.text('Creator earnings available'), findsNothing);
    expect(transport.loads, contains(TalkActivityFilter.social));
  });

  testWidgets('Talk activity opens the related Talk', (tester) async {
    final transport = _ActivityTransport();
    String? opened;

    await tester.pumpWidget(
      _app(
        transport: transport,
        onOpenTalk: (talkId) => opened = talkId,
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('activity-item-invite-1')));
    await tester.pump();

    expect(opened, 'talk-1');
  });

  testWidgets('Money and Social targets use their own callbacks',
      (tester) async {
    final transport = _ActivityTransport();
    String? transaction;
    String? profile;

    await tester.pumpWidget(
      _app(
        transport: transport,
        onOpenProfile: (id) => profile = id,
        onOpenTransaction: (id) => transaction = id,
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Money'));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('activity-item-earning-1')));
    expect(transaction, 'txn-1');

    await tester.tap(find.text('Social'));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('activity-item-follow-1')));
    expect(profile, 'musa');
  });

  testWidgets('Activity hides raw transport failures', (tester) async {
    await tester.pumpWidget(
      _app(transport: _FailingActivityTransport()),
    );
    await tester.pumpAndSettle();

    expect(find.text('Couldn’t refresh Activity.'), findsOneWidget);
    expect(find.textContaining('DioException'), findsNothing);
    expect(find.textContaining('socket'), findsNothing);
  });
}
