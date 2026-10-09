import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/screens/talks/talk_gift_sheet.dart';
import 'package:masanawa/src/talks/talk_gift.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';

const _heart = TalkGiftCatalogItem(
  id: 'heart',
  name: 'Heart',
  visual: 'heart',
  amountCredits: 10,
  available: true,
);
const _catalog = TalkGiftCatalog(talkId: 'talk_1', items: [_heart]);

Future<void> _showGiftSheet(
  WidgetTester tester, {
  required Future<TalkGiftCatalog> Function() loadCatalog,
  required Future<bool> Function(TalkGiftCatalogItem) onGift,
}) async {
  await tester.pumpWidget(
    MaterialApp(
      theme: buildMasanawaTheme(brightness: Brightness.light),
      home: Scaffold(
        body: Builder(
          builder: (context) => ElevatedButton(
            onPressed: () => showModalBottomSheet<bool>(
              context: context,
              isScrollControlled: true,
              builder: (_) => TalkGiftSheet(
                hostName: 'Amina',
                loadCatalog: loadCatalog,
                onGift: onGift,
              ),
            ),
            child: const Text('Open gifts'),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('Open gifts'));
  await tester.pumpAndSettle();
}

Future<void> _selectAndSend(WidgetTester tester) async {
  await tester.tap(find.byKey(const ValueKey('talk-gift-heart')));
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(const ValueKey('talk-gift-send')));
  await tester.pump();
}

void main() {
  testWidgets(
      'unknown result disables stale send and requires fresh catalog before retry',
      (tester) async {
    var loads = 0;
    var sends = 0;
    await _showGiftSheet(
      tester,
      loadCatalog: () async {
        loads++;
        return _catalog;
      },
      onGift: (option) async {
        expect(option.id, 'heart');
        sends++;
        return sends == 2; // first result could be a settled-but-lost reply
      },
    );
    expect(loads, 1);

    await _selectAndSend(tester);
    await tester.pumpAndSettle();

    expect(sends, 1);
    expect(find.byKey(const ValueKey('talk-gift-error')), findsOneWidget);
    expect(
      tester.widget<ChoiceChip>(find.byKey(const ValueKey('talk-gift-heart')))
          .onSelected,
      isNull,
    );
    expect(
      tester.widget<FilledButton>(find.byKey(const ValueKey('talk-gift-send')))
          .onPressed,
      isNull,
    );

    await tester.tap(find.byKey(const ValueKey('talk-gift-refresh-price')));
    await tester.pumpAndSettle();
    expect(loads, 2);
    expect(find.byKey(const ValueKey('talk-gift-error')), findsNothing);

    await _selectAndSend(tester);
    await tester.pumpAndSettle();
    expect(sends, 2);
    expect(find.byType(TalkGiftSheet), findsNothing);
  });

  testWidgets('while server response is pending, Send cannot issue a second call',
      (tester) async {
    final pending = Completer<bool>();
    var sends = 0;
    await _showGiftSheet(
      tester,
      loadCatalog: () async => _catalog,
      onGift: (_) {
        sends++;
        return pending.future;
      },
    );

    await _selectAndSend(tester);
    expect(sends, 1);
    expect(
      tester.widget<FilledButton>(find.byKey(const ValueKey('talk-gift-send')))
          .onPressed,
      isNull,
    );
    expect(
      tester.widget<ChoiceChip>(find.byKey(const ValueKey('talk-gift-heart')))
          .onSelected,
      isNull,
    );

    pending.complete(false);
    await tester.pumpAndSettle();
    expect(sends, 1);
    expect(find.textContaining('Check Wallet history'), findsOneWidget);
  });

  testWidgets('failed catalog read and empty refreshed catalog never call send',
      (tester) async {
    var loads = 0;
    var sends = 0;
    await _showGiftSheet(
      tester,
      loadCatalog: () async {
        loads++;
        if (loads == 1) throw StateError('temporary network outage');
        return const TalkGiftCatalog(talkId: 'talk_1', items: []);
      },
      onGift: (_) async {
        sends++;
        return true;
      },
    );

    expect(find.text('Gift options are unavailable right now.'),
        findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('talk-gift-retry-catalog')));
    await tester.pumpAndSettle();
    expect(loads, 2);
    expect(find.textContaining('No gifts are available'), findsOneWidget);
    expect(find.byKey(const ValueKey('talk-gift-send')), findsNothing);
    expect(sends, 0);
  });
}
