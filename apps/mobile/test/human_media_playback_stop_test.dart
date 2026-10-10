import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/human_media/human_voice_controller.dart';
import 'package:masanawa/src/human_media/human_voice_controls.dart';
import 'package:masanawa/src/human_media/human_voice_models.dart';
import 'package:masanawa/src/human_media/human_voice_transport.dart';

const conversationId = '00000000-0000-4000-8000-000000000001';
const ownUserId = 'user_one';
class _Player implements HumanVoicePlayer {
  final pending = Completer<void>();
  int loads = 0, plays = 0, stops = 0, disposals = 0;
  @override Future<void> loadFile(String path) async { loads++; }
  @override Future<void> play() { plays++; return pending.future; }
  @override Future<void> stop() async { stops++; }
  @override Future<void> dispose() async { disposals++; }
}
class _Transport implements HumanVoiceTransport {
  Completer<Uint8List>? delayedRead;
  int reads = 0, removals = 0;
  @override Future<Uint8List> read(String id) async {
    reads++;
    final wait = delayedRead;
    if (wait != null) return wait.future;
    return Uint8List.fromList(List<int>.filled(120, 2));
  }
  @override Future<List<HumanVoiceNote>> list(String id, {String? before, int limit = 30}) async => [];
  @override Future<HumanVoiceNote> send(String id, String key, Uint8List bytes) async =>
    throw StateError('No sending in playback test');
  @override Future<void> remove(String id) async { removals++; }
}
class _Capture implements HumanVoiceCapture {
  String? filePath;
  @override Future<bool> permission() async => true;
  @override Future<void> start(String path) async {
    filePath = path;
    await File(path).writeAsBytes(List<int>.filled(120, 4), flush:true);
  }
  @override Future<String?> stop() async => filePath;
  @override Future<void> dispose() async {}
}
Future<Directory> sandbox() => Directory.systemTemp.createTemp('masanawa-c04-');
Future<String> Function() pathFactory(Directory dir) {
  var index = 0;
  return () async => '${dir.path}/private-${++index}.ogg';
}
HumanVoiceNote sampleNote({String senderUserId = 'user_two'}) => HumanVoiceNote(
  messageId: '00000000-0000-4000-8000-000000000010',
  conversationId: conversationId,
  sequence: '10', senderUserId: senderUserId,
  clientRequestId: 'voice_request_123456',
  durationMs: 3500,sizeBytes: 120,
  createdAt: DateTime.utc(2026,10,8),
);

void main() {
  test('Stop interrupts a long private audio play Future and erases download', () async {
    final dir=await sandbox(),player=_Player(),transport=_Transport();
    final controller=HumanVoiceController(
      conversationId:conversationId,ownerUserId:ownUserId,transport:transport,
      capture:_Capture(),player:player,privatePath:pathFactory(dir),
    );
    await controller.play(sampleNote());
    expect(controller.playing,true);
    expect(player.plays,1);
    expect(dir.listSync().whereType<File>().length,1);
    await controller.stopPlayback();
    expect(controller.playing,false);
    expect(controller.playingMessageId,isNull);
    expect(dir.listSync().whereType<File>(),isEmpty);
    player.pending.complete();
    await Future<void>.delayed(Duration.zero);
    expect(controller.playing,false);
    await controller.shutdown();
    expect(player.disposals,1);
    await dir.delete(recursive:true);
  });

  test('Stop during authorization/download cancels late private bytes', () async {
    final dir=await sandbox(),player=_Player(),transport=_Transport();
    final waiting=Completer<Uint8List>();
    transport.delayedRead=waiting;
    final controller=HumanVoiceController(
      conversationId:conversationId,ownerUserId:ownUserId,transport:transport,
      capture:_Capture(),player:player,privatePath:pathFactory(dir),
    );
    final future=controller.play(sampleNote());
    await Future<void>.delayed(Duration.zero);
    await controller.stopPlayback();
    waiting.complete(Uint8List.fromList(List<int>.filled(120, 3)));
    await future;
    expect(player.loads,0);
    expect(player.plays,0);
    expect(dir.listSync().whereType<File>(),isEmpty);
    await controller.shutdown();
    await dir.delete(recursive:true);
  });

  test('Stop erases an audio file materialized by a late private path factory', () async {
    final dir=await sandbox(),player=_Player(),transport=_Transport();
    final requested=Completer<void>(),pendingPath=Completer<String>();
    final controller=HumanVoiceController(
      conversationId:conversationId,ownerUserId:ownUserId,transport:transport,
      capture:_Capture(),player:player,privatePath:(){
        requested.complete();
        return pendingPath.future;
      },
    );
    final playback=controller.play(sampleNote());
    await requested.future;
    await controller.stopPlayback();
    final file=File('${dir.path}/late-playback.ogg');
    // An asynchronous path provider can have allocated a file before it
    // resolves. It must not survive cancellation of the owning generation.
    await file.writeAsBytes(List<int>.filled(120, 7),flush:true);
    pendingPath.complete(file.path);
    await playback;
    expect(await file.exists(),isFalse);
    expect(player.loads,0);
    expect(player.plays,0);
    expect(controller.playing,isFalse);
    await controller.shutdown();
    await dir.delete(recursive:true);
  });

  test('Sign-out erases a late private playback path after player disposal', () async {
    final dir=await sandbox(),player=_Player(),transport=_Transport();
    final requested=Completer<void>(),pendingPath=Completer<String>();
    final controller=HumanVoiceController(
      conversationId:conversationId,ownerUserId:ownUserId,transport:transport,
      capture:_Capture(),player:player,privatePath:(){
        requested.complete();
        return pendingPath.future;
      },
    );
    final playback=controller.play(sampleNote());
    await requested.future;
    await controller.shutdown();
    final file=File('${dir.path}/late-after-logout.ogg');
    await file.writeAsBytes(List<int>.filled(120, 6),flush:true);
    pendingPath.complete(file.path);
    await playback;
    expect(await file.exists(),isFalse);
    expect(player.loads,0);
    expect(player.plays,0);
    expect(player.disposals,1);
    expect(controller.closed,isTrue);
    await dir.delete(recursive:true);
  });

  test('Delete own voice note stops playback and removes private download', () async {
    final dir=await sandbox(),player=_Player(),transport=_Transport();
    final controller=HumanVoiceController(
      conversationId:conversationId,ownerUserId:ownUserId,transport:transport,
      capture:_Capture(),player:player,privatePath:pathFactory(dir),
    );
    final note=sampleNote(senderUserId:ownUserId);
    await controller.play(note);
    expect(controller.playing,true);
    expect(dir.listSync().whereType<File>().length,1);
    await controller.delete(note);
    expect(transport.removals,1);
    expect(controller.playing,false);
    expect(controller.playingMessageId,isNull);
    expect(dir.listSync().whereType<File>(),isEmpty);
    player.pending.complete();
    await Future<void>.delayed(Duration.zero);
    expect(controller.playing,false);
    await controller.shutdown();
    await dir.delete(recursive:true);
  });

  test('Stop preview keeps reviewed private recording for deliberate send/discard', () async {
    final dir=await sandbox(),player=_Player(),transport=_Transport();
    final controller=HumanVoiceController(
      conversationId:conversationId,ownerUserId:ownUserId,transport:transport,
      capture:_Capture(),player:player,privatePath:pathFactory(dir),
    );
    await controller.begin();
    await controller.stop();
    expect(controller.review,true);
    await controller.preview();
    expect(controller.playing,true);
    expect(controller.canSend,false);
    await controller.stopPlayback();
    expect(controller.playing,false);
    expect(controller.review,true);
    expect(controller.canSend,true);
    expect(dir.listSync().whereType<File>().length,1);
    await controller.discard();
    expect(dir.listSync().whereType<File>(),isEmpty);
    await controller.shutdown();
    await dir.delete(recursive:true);
  });

  testWidgets('private voice review has accessible Stop and returns to Preview', (tester) async {
    final dir=await sandbox(),player=_Player(),transport=_Transport();
    final capture=_Capture();
    await tester.pumpWidget(MaterialApp(home:Scaffold(body:HumanVoiceNotesPanel(
      conversationId:conversationId,currentUserId:ownUserId,
      transport:transport,capture:capture,player:player,privatePath:pathFactory(dir),
    ))));
    await tester.pump();
    await tester.tap(find.byTooltip('Record private voice note'));
    await tester.pump();
    await tester.tap(find.byTooltip('Stop and review recording'));
    await tester.pump();
    await tester.tap(find.byTooltip('Preview recording'));
    await tester.pump();
    expect(find.byTooltip('Stop recording preview'),findsOneWidget);
    await tester.tap(find.byTooltip('Stop recording preview'));
    await tester.pump();
    expect(find.byTooltip('Preview recording'),findsOneWidget);
    player.pending.complete();
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
    await dir.delete(recursive:true);
  });
}
