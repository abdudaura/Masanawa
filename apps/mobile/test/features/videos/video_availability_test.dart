import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/features/videos/video_models.dart';
import 'package:masanawa/src/features/videos/official_video_player_screen.dart';

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
}
