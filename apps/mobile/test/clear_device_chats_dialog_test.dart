import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/screens/settings/clear_device_chats_dialog.dart';

Future<void> openDialog(
  WidgetTester tester, {
  required Future<void> Function() onConfirm,
  required void Function(bool?) onResult,
}) async {
  await tester.pumpWidget(MaterialApp(
    home: Scaffold(
      body: Builder(
        builder: (context) => TextButton(
          onPressed: () => showDialog<bool>(
            context: context,
            builder: (_) => ClearDeviceChatsDialog(onConfirm: onConfirm),
          ).then(onResult),
          child: const Text('Open settings dialog'),
        ),
      ),
    ),
  ));
  await tester.tap(find.text('Open settings dialog'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('cancel leaves all device chats alone', (tester) async {
    var writes = 0;
    bool? result;
    await openDialog(
      tester,
      onConfirm: () async { writes++; },
      onResult: (value) => result = value,
    );
    expect(find.text('server-held history', findRichText: true), findsNothing);
    expect(find.textContaining('financial receipts'), findsOneWidget);
    await tester.tap(find.text('Keep chats'));
    await tester.pumpAndSettle();
    expect(writes, 0);
    expect(result, isFalse);
  });

  testWidgets('confirmed cleanup is single-flight and waits for completion',
      (tester) async {
    final pending = Completer<void>();
    var writes = 0;
    bool? result;
    await openDialog(
      tester,
      onConfirm: () { writes++; return pending.future; },
      onResult: (value) => result = value,
    );
    await tester.tap(find.byKey(const Key('confirm-clear-device-chats')));
    await tester.pump();
    expect(writes, 1);
    expect(find.byType(LinearProgressIndicator), findsOneWidget);
    expect(
      tester.widget<FilledButton>(
        find.byKey(const Key('confirm-clear-device-chats')),
      ).onPressed,
      isNull,
    );
    expect(find.text('Clear chats on this device?'), findsOneWidget);
    pending.complete();
    await tester.pumpAndSettle();
    expect(result, isTrue);
    expect(writes, 1);
    expect(find.text('Clear chats on this device?'), findsNothing);
  });

  testWidgets('failed cleanup stays open for explicit retry', (tester) async {
    var attempts = 0;
    bool? result;
    await openDialog(
      tester,
      onConfirm: () async {
        attempts++;
        if (attempts == 1) throw StateError('private storage details');
      },
      onResult: (value) => result = value,
    );
    await tester.tap(find.text('Clear local chats'));
    await tester.pumpAndSettle();
    expect(attempts, 1);
    expect(result, isNull);
    expect(find.byKey(const Key('clear-device-chats-error')), findsOneWidget);
    expect(find.textContaining('private storage details'), findsNothing);
    await tester.tap(find.text('Clear local chats'));
    await tester.pumpAndSettle();
    expect(attempts, 2);
    expect(result, isTrue);
  });

  testWidgets('small screen keeps actions reachable', (tester) async {
    tester.view.physicalSize = const Size(640, 1280);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await openDialog(
      tester,
      onConfirm: () async {},
      onResult: (_) {},
    );
    expect(find.text('Keep chats'), findsOneWidget);
    expect(find.byKey(const Key('confirm-clear-device-chats')),
        findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
