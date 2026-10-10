import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/audio_posts/audio_post_capture_sheet.dart';
import 'package:masanawa/src/audio_posts/audio_post_composer_screen.dart';

class _Recorder implements TalkCaptureRecorder {
  _Recorder({this.permission = true});
  bool permission;
  String? path;
  int starts = 0, stops = 0;
  bool closed = false;
  @override
  Future<bool> hasPermission() async => permission;
  @override
  Future<void> start(String filename) async {
    path = filename; starts++;
    await File(filename).writeAsBytes([1, 2, 3, 4]);
  }
  @override
  Future<void> pause() async {}
  @override
  Future<void> resume() async {}
  @override
  Future<String?> stop() async { stops++; return path; }
  @override
  Future<void> close() async { closed = true; }
}

class _Player implements TalkCapturePlayer {
  int previews = 0, stops = 0;
  bool closed = false;
  @override
  Future<void> preview(String path, int startMs, int endMs) async {
    previews++;
    expect(await File(path).exists(), true);
    expect(endMs - startMs, greaterThanOrEqualTo(1000));
  }
  @override
  Future<void> stop() async { stops++; }
  @override
  Future<void> close() async { closed = true; }
}

void main() {
  late Directory directory;
  setUp(() async {
    directory = await Directory.systemTemp.createTemp('af09-capture-');
  });
  tearDown(() async {
    if (await directory.exists()) await directory.delete(recursive: true);
  });

  Future<void> mount(
    WidgetTester tester, _Recorder rec, _Player player, {
    UploadVerifiedTalkAudio? uploader,
    bool Function(String)? active,
    ValueChanged<VerifiedPostAudio?>? onResult,
  }) async {
    await tester.pumpWidget(MaterialApp(home: Scaffold(
      body: Builder(builder: (context) => TextButton(
        onPressed: () async {
          final result = await showModalBottomSheet<VerifiedPostAudio>(
            context: context, isScrollControlled: true,
            builder: (_) => TalkCaptureSheet(
              accountId: 'account-a',
              isCurrentAccount: active ?? (_) => true,
              upload: uploader,
              recorder: rec,
              player: player,
              tempDirectory: () async => directory,
            ),
          );
          onResult?.call(result);
        },
        child: const Text('Open recorder'),
      )),
    )));
    await tester.tap(find.text('Open recorder'));
    await tester.pumpAndSettle();
  }

  Future<void> recordForOneSecond(WidgetTester tester) async {
    await tester.tap(find.text('Record'));
    await tester.pump();
    // Stopwatch uses the real monotonic clock rather than fake frame time.
    await tester.runAsync(() => Future<void>.delayed(
      const Duration(milliseconds: 1200)));
    await tester.pump();
    await tester.tap(find.text('Stop'));
    await tester.pumpAndSettle();
    expect(find.text('Preview selection'), findsOneWidget);
  }

  testWidgets('permission denied cannot fabricate a recording or upload',
      (tester) async {
    final rec = _Recorder(permission: false), player = _Player();
    await mount(tester, rec, player,
      uploader: ({required localPath, required uploadRequestId, required startMs, required endMs}) async =>
        const VerifiedPostAudio(assetId: 'should-not-exist', durationMs: 1200));
    await tester.tap(find.text('Record'));
    await tester.pumpAndSettle();
    expect(find.text('Microphone permission is required.'), findsOneWidget);
    expect(rec.starts, 0);
    expect(find.text('Use recording'), findsNothing);
    await tester.tap(find.text('Discard and close'));
    await tester.pumpAndSettle();
  });

  testWidgets('record/pause/preview works but unavailable upload stays disabled',
      (tester) async {
    final rec = _Recorder(), player = _Player();
    await mount(tester, rec, player);
    await tester.tap(find.text('Record'));
    await tester.pump();
    await tester.tap(find.text('Pause'));
    await tester.pump();
    expect(find.text('Resume'), findsOneWidget);
    await tester.tap(find.text('Resume'));
    await tester.pump();
    await tester.runAsync(() => Future<void>.delayed(
      const Duration(milliseconds: 1200)));
    await tester.pump();
    await tester.tap(find.text('Stop'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Private upload unavailable'), findsOneWidget);
    expect(tester.widget<FilledButton>(
      find.widgetWithText(FilledButton, 'Use recording')).onPressed, isNull);
    await tester.tap(find.text('Preview selection'));
    await tester.pump();
    expect(player.previews, 1);
    await tester.tap(find.text('Discard and close'));
    await tester.pumpAndSettle();
    expect(await File(rec.path!).exists(), false);
  });

  testWidgets('uncertain upload retains the same file for retry, verified success cleans it',
      (tester) async {
    final rec = _Recorder(), player = _Player();
    final received = <VerifiedPostAudio?>[];
    final attemptedPaths = <String>[];
    final attemptedRequestIds = <String>[];
    int attempts = 0;
    await mount(tester, rec, player, onResult: received.add,
      uploader: ({required localPath, required uploadRequestId, required startMs, required endMs}) async {
        attemptedPaths.add(localPath);
        attemptedRequestIds.add(uploadRequestId);
        expect(await File(localPath).exists(), true);
        attempts++;
        if (attempts == 1) throw StateError('network timeout');
        return VerifiedPostAudio(
          assetId: 'server-verified-owned-asset', durationMs: endMs - startMs);
      });
    await recordForOneSecond(tester);
    await tester.tap(find.text('Use recording'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Private upload not confirmed'), findsOneWidget);
    expect(await File(rec.path!).exists(), true);
    await tester.tap(find.text('Use recording'));
    await tester.pumpAndSettle();
    expect(attemptedPaths, [rec.path, rec.path]);
    expect(attemptedRequestIds[0], startsWith('talk-media-'));
    expect(attemptedRequestIds[1], attemptedRequestIds[0]);
    expect(rec.starts, 1);
    expect(received.single?.assetId, 'server-verified-owned-asset');
    expect(await File(rec.path!).exists(), false);
  });

  testWidgets('session loss prevents upload of previously recorded account media',
      (tester) async {
    final rec = _Recorder(), player = _Player();
    bool active = true;
    int uploaded = 0;
    await mount(tester, rec, player, active: (_) => active,
      uploader: ({required localPath, required uploadRequestId, required startMs, required endMs}) async {
        uploaded++;
        return VerifiedPostAudio(assetId: 'asset', durationMs: endMs - startMs);
      });
    await recordForOneSecond(tester);
    active = false;
    await tester.pump();
    expect(tester.widget<FilledButton>(
      find.widgetWithText(FilledButton, 'Use recording')).onPressed, isNull);
    expect(uploaded, 0);
    await tester.tap(find.text('Discard and close'));
    await tester.pumpAndSettle();
    expect(await File(rec.path!).exists(), false);
  });
}
