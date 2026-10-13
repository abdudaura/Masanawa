import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/features/videos/video_models.dart';
import 'package:masanawa/src/features/videos/official_video_player_screen.dart';

Future<void> _useTallVideoViewport(WidgetTester tester) async {
  await tester.binding.setSurfaceSize(const Size(800, 950));
  addTearDown(() => tester.binding.setSurfaceSize(null));
}

void main() {
  final video = ExternalVideo(
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Verified lecture', channelName: 'Original Publisher',
    provider: 'youtube',
    sourceUrl: Uri.parse('https://www.youtube.com/watch?v=abcDE12_-34'),
  );
  Widget player(Future<bool> Function(String) check) => MaterialApp(
    home: OfficialVideoPlayerScreen(
      video: video, checkAvailability: check,
      embedBuilder: (_) => const Text('Official iframe'),
      open: (_) async => true,
    ),
  );

  testWidgets('C29: withdrawn item never creates a player', (tester) async {
    await _useTallVideoViewport(tester);
    var calls = 0;
    await tester.pumpWidget(player((id) async {
      calls++;
      expect(id, video.id);
      return false;
    }));
    await tester.tap(find.text('Play official video'));
    await tester.pumpAndSettle();
    expect(calls, 1);
    expect(find.text('Official iframe'), findsNothing);
    expect(find.text('Video unavailable here. Open at source.'), findsOneWidget);
    expect(find.text('Open in youtube'), findsOneWidget);
  });

  testWidgets('C29: connection error never assumes available; retry rechecks',
      (tester) async {
    await _useTallVideoViewport(tester);
    var tries = 0;
    await tester.pumpWidget(player((_) async {
      tries++;
      if (tries == 1) throw StateError('offline');
      return true;
    }));
    await tester.tap(find.text('Play official video'));
    await tester.pumpAndSettle();
    expect(find.text('Official iframe'), findsNothing);
    expect(find.text('Could not check video availability. Retry when online.'),
      findsOneWidget);
    await tester.ensureVisible(find.text('Retry'));
    await tester.tap(find.text('Retry'));
    await tester.pump();
    await tester.tap(find.text('Play official video'));
    await tester.pumpAndSettle();
    expect(tries, 2);
    expect(find.text('Official iframe'), findsOneWidget);
  });

  testWidgets('C29: stale checks cannot reopen player after widget replacement',
      (tester) async {
    await _useTallVideoViewport(tester);
    final pending = <void Function(bool)>[];
    Future<bool> delayed(String _) {
      final pendingCheck = Completer<bool>();
      pending.add(pendingCheck.complete);
      return pendingCheck.future;
    }
    await tester.pumpWidget(player(delayed));
    await tester.tap(find.text('Play official video'));
    await tester.pump();
    expect(pending, hasLength(1));
    await tester.pumpWidget(player((_) async => false));
    pending.first(true);
    await tester.pumpAndSettle();
    expect(find.text('Official iframe'), findsNothing);
  });
  testWidgets('C29: missing authenticated verifier stays fail-closed',
      (tester) async {
    await _useTallVideoViewport(tester);
    await tester.pumpWidget(MaterialApp(home: OfficialVideoPlayerScreen(
      video: video,
      embedBuilder: (_) => const Text('Official iframe'),
      open: (_) async => true,
    )));
    await tester.pumpAndSettle();
    expect(find.text('Official iframe'), findsNothing);
    expect(find.text('Could not check video availability. Retry when online.'),
      findsOneWidget);
    await tester.tap(find.text('Retry'));
    await tester.pump();
    await tester.tap(find.text('Play official video'));
    await tester.pump();
    expect(find.text('Official iframe'), findsNothing);
  });

  testWidgets('C29: opening at source rechecks approval after catalog fetch',
      (tester) async {
    await _useTallVideoViewport(tester);
    var checked = 0;
    Uri? opened;
    await tester.pumpWidget(MaterialApp(home: OfficialVideoPlayerScreen(
      video: video,
      checkAvailability: (id) async {
        expect(id, video.id);
        checked++;
        return false;
      },
      open: (url) async { opened = url; return true; },
      embedBuilder: (_) => const Text('Official iframe'),
    )));
    await tester.ensureVisible(find.text('Open in youtube'));
    await tester.tap(find.text('Open in youtube'));
    await tester.pumpAndSettle();
    expect(checked, 1);
    expect(opened, isNull);
    expect(find.text('Official iframe'), findsNothing);
    expect(find.text('Video unavailable here. Open at source.'), findsOneWidget);
  });

  testWidgets('C29: approved external open uses canonical provider URL',
      (tester) async {
    await _useTallVideoViewport(tester);
    Uri? opened;
    var checked = 0;
    await tester.pumpWidget(MaterialApp(home: OfficialVideoPlayerScreen(
      video: video,
      checkAvailability: (_) async { checked++; return true; },
      open: (url) async { opened = url; return true; },
      embedBuilder: (_) => const Text('Official iframe'),
    )));
    await tester.ensureVisible(find.text('Open in youtube'));
    await tester.tap(find.text('Open in youtube'));
    await tester.pumpAndSettle();
    expect(checked, 1);
    expect(opened, video.sourceUrl);
  });

  testWidgets('C29: stale external approval cannot open after account remount',
      (tester) async {
    await _useTallVideoViewport(tester);
    final pending = Completer<bool>();
    Uri? opened;
    Widget mount(Future<bool> Function(String) check) => MaterialApp(
      home: OfficialVideoPlayerScreen(
        video: video,
        checkAvailability: check,
        open: (url) async { opened = url; return true; },
        embedBuilder: (_) => const Text('Official iframe'),
      ),
    );
    await tester.pumpWidget(mount((_) => pending.future));
    await tester.ensureVisible(find.text('Open in youtube'));
    await tester.tap(find.text('Open in youtube'));
    await tester.pump();
    await tester.pumpWidget(mount((_) async => false));
    pending.complete(true);
    await tester.pumpAndSettle();
    expect(opened, isNull);
  });

}
