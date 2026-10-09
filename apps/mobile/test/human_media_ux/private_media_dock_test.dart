import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/human_media_ux/private_media_dock.dart';
import 'package:masanawa/src/human_media_ux/private_media_draft.dart';

class _Picker implements PrivateMediaPicker {
  _Picker(this.selected);
  final File selected;
  @override
  Future<File?> pick() async => selected;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory directory;
  late File pdf;
  late PrivateMediaReviewController controller;

  setUp(() async {
    directory = await Directory.systemTemp.createTemp('u12-widget-');
    pdf = File(directory.path + '/lesson.pdf');
    await pdf.writeAsBytes(const [37, 80, 68, 70, 45, 49, 46, 52, 10]);
    controller = PrivateMediaReviewController(
      accountId: 'A',
      conversationId: 'human-thread',
      picker: _Picker(pdf),
      isAuthorized: () async => true,
    );
  });

  tearDown(() async {
    controller.dispose();
    if (await directory.exists()) {
      await directory.delete(recursive: true);
    }
  });

  Widget app(PrivateMediaReviewController source) => MaterialApp(
    home: Scaffold(
      body: SingleChildScrollView(
        child: HumanPrivateMediaDock(
          controller: source,
          voiceNotes: const Text('Secure C04 recorder'),
          dataSaver: true,
        ),
      ),
    ),
  );

  testWidgets('voice component remains visible and unsupported media cannot send',
      (tester) async {
    await tester.pumpWidget(app(controller));
    expect(find.text('Secure C04 recorder'), findsOneWidget);
    await tester.tap(find.text('Review image or PDF'));
    await tester.pumpAndSettle();
    expect(find.text('lesson.pdf'), findsOneWidget);
    expect(find.textContaining('Preview only'), findsOneWidget);
    expect(find.text('Send private attachment'), findsNothing);
    expect(find.byIcon(Icons.picture_as_pdf_outlined), findsOneWidget);
    await tester.tap(find.byTooltip('Discard attachment'));
    await tester.pumpAndSettle();
    expect(find.text('lesson.pdf'), findsNothing);
    expect(controller.requestId, isNull);
  });

  testWidgets('swapping account controllers never retains old attachment UI',
      (tester) async {
    await controller.choose();
    await tester.pumpWidget(app(controller));
    expect(find.text('lesson.pdf'), findsOneWidget);
    final other = PrivateMediaReviewController(
      accountId: 'B',
      conversationId: 'other-human-thread',
      picker: _Picker(pdf),
      isAuthorized: () async => true,
    );
    try {
      await tester.pumpWidget(app(other));
      await tester.pumpAndSettle();
      expect(find.text('lesson.pdf'), findsNothing);
      expect(find.text('Secure C04 recorder'), findsOneWidget);
    } finally {
      other.dispose();
    }
  });

  testWidgets('invalid chosen bytes show accessible error, no send button',
      (tester) async {
    final bad = File(directory.path + '/payload.pdf');
    await bad.writeAsBytes(const [137, 80, 78, 71, 13, 10, 26, 10]);
    final invalid = PrivateMediaReviewController(
      accountId: 'A',
      conversationId: 'human-thread',
      picker: _Picker(bad),
      isAuthorized: () async => true,
    );
    try {
      await tester.pumpWidget(app(invalid));
      await tester.tap(find.text('Review image or PDF'));
      await tester.pumpAndSettle();
      expect(find.text('File format does not match its contents.'),
          findsOneWidget);
      expect(find.text('Send private attachment'), findsNothing);
      expect(invalid.draft, isNull);
    } finally {
      invalid.dispose();
    }
  });
}
