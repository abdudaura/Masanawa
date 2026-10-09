import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/screens/settings/settings_screen.dart';

Widget _screen(Future<void> Function() onClear) => MaterialApp(
      home: Scaffold(body: ClearLocalAiChatsTile(onClear: onClear)),
    );

void main() {
  testWidgets('AF14: scope says local AI only; cancel leaves history intact',
      (tester) async {
    var calls = 0;
    await tester.pumpWidget(_screen(() async => calls++));
    expect(find.text('Clear local AI chats'), findsOneWidget);
    expect(find.text('Clear all chats'), findsNothing);
    await tester.tap(find.byKey(const Key('settings-clear-local-ai-chats')));
    await tester.pumpAndSettle();
    expect(find.textContaining('human chats, server history'), findsOneWidget);
    expect(find.textContaining('Wallet receipts'), findsOneWidget);
    expect(calls, 0);
    await tester.tap(find.byKey(const Key('settings-clear-ai-cancel')));
    await tester.pumpAndSettle();
    expect(calls, 0);
    expect(find.byType(AlertDialog), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('AF14: confirm clears exactly once; pending action cannot repeat',
      (tester) async {
    final finish = Completer<void>();
    var calls = 0;
    await tester.pumpWidget(_screen(() {
      calls++;
      return finish.future;
    }));
    await tester.tap(find.byKey(const Key('settings-clear-local-ai-chats')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('settings-clear-ai-confirm')));
    await tester.pump();
    expect(calls, 1);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    expect(tester.widget<ListTile>(
      find.byKey(const Key('settings-clear-local-ai-chats')),
    ).enabled, isFalse);

    finish.complete();
    await tester.pump();
    expect(find.text('Local AI chats cleared'), findsOneWidget);
    expect(tester.widget<ListTile>(
      find.byKey(const Key('settings-clear-local-ai-chats')),
    ).enabled, isTrue);
    expect(calls, 1);
    expect(tester.takeException(), isNull);
  });

  testWidgets('AF14: failed clear is honest and can be retried', (tester) async {
    var attempts = 0;
    await tester.pumpWidget(_screen(() async {
      attempts++;
      if (attempts == 1) throw StateError('private implementation detail');
    }));
    await tester.tap(find.byKey(const Key('settings-clear-local-ai-chats')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('settings-clear-ai-confirm')));
    await tester.pump();
    expect(attempts, 1);
    expect(find.text('Could not clear local AI chats. Please try again.'),
        findsOneWidget);
    expect(find.textContaining('private implementation detail'), findsNothing);
    await tester.tap(find.byKey(const Key('settings-clear-local-ai-chats')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('settings-clear-ai-confirm')));
    await tester.pump();
    expect(attempts, 2);
    expect(find.text('Local AI chats cleared'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
