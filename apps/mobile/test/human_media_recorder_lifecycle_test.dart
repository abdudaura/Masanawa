import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/human_media/human_voice_controller.dart';
import 'package:masanawa/src/human_media/human_voice_models.dart';
import 'package:masanawa/src/human_media/human_voice_transport.dart';

class _Capture implements HumanVoiceCapture {
  _Capture({this.permissionGate, this.startGate, this.stopGate,
    this.nullStopPath=false, this.alternateStopPath});
  final Completer<bool>? permissionGate;
  final Completer<void>? startGate;
  final Completer<void>? stopGate;
  final bool nullStopPath;
  final String? alternateStopPath;
  int permissions=0, starts=0, stops=0, disposals=0;
  String? path;

  @override Future<bool> permission() {
    permissions++;
    return permissionGate?.future ?? Future<bool>.value(true);
  }
  @override Future<void> start(String target) async {
    starts++;
    path=target;
    if(startGate!=null)await startGate!.future;
    // The real platform can write the recording only AFTER the native start
    // call resumes. A shutdown must still delete this late private file.
    await File(target).writeAsBytes(List<int>.filled(84, 42),flush:true);
  }
  @override Future<String?> stop() async {
    stops++;
    if(stopGate!=null)await stopGate!.future;
    if(alternateStopPath!=null){
      // Simulate a native encoder finalizing at a different file location.
      await File(alternateStopPath!).writeAsBytes(
          List<int>.filled(84, 24),flush:true);
      return alternateStopPath;
    }
    return nullStopPath ? null : path;
  }
  @override Future<void> dispose() async {disposals++;}
}

class _Player implements HumanVoicePlayer {
  @override Future<void> loadFile(String path) async {}
  @override Future<void> play() async {}
  @override Future<void> stop() async {}
  @override Future<void> dispose() async {}
}
class _Transport implements HumanVoiceTransport {
  @override Future<HumanVoiceNote> send(String id,String request,Uint8List ogg) async =>
      throw StateError('No private note should be sent');
  @override Future<List<HumanVoiceNote>> list(String id,{String? before,int limit=30}) async =>
      const [];
  @override Future<Uint8List> read(String id) async => throw StateError('No read');
  @override Future<void> remove(String id) async => throw StateError('No remove');
}

Future<void> _yieldUntil(bool Function() predicate) async {
  for(var i=0;i<30&&!predicate();i++){
    await Future<void>.delayed(Duration.zero);
  }
  expect(predicate(),isTrue);
}

void main() {
  late Directory directory;
  late String path;
  setUp(() async {
    directory=await Directory.systemTemp.createTemp('masanawa-f17-');
    path='${directory.path}/private.ogg';
  });
  tearDown(() async {
    if(await directory.exists())await directory.delete(recursive:true);
  });

  HumanVoiceController controller(_Capture capture) => HumanVoiceController(
    conversationId:'00000000-0000-4000-8000-000000000001',
    ownerUserId:'user_A',
    transport:_Transport(),capture:capture,player:_Player(),
    privatePath:()async=>path,
  );

  test('account switch waits for a pending native start then stops and erases late audio',() async {
    final startGate=Completer<void>();
    final capture=_Capture(startGate:startGate);
    final subject=controller(capture);
    final starting=subject.begin();
    await _yieldUntil(()=>capture.starts==1);
    var shutdownDone=false;
    final closing=subject.shutdown().then((_){shutdownDone=true;});
    await Future<void>.delayed(Duration.zero);
    expect(shutdownDone,isFalse);
    expect(capture.disposals,0);
    startGate.complete();
    await Future.wait([starting,closing]);
    expect(capture.stops,1);
    expect(capture.disposals,1);
    expect(subject.closed,isTrue);
    expect(subject.recording,isFalse);
    expect(await File(path).exists(),isFalse);
  });

  test('two begin taps cannot open duplicate native recorders through permission prompt',() async {
    final permissionGate=Completer<bool>();
    final capture=_Capture(permissionGate:permissionGate);
    final subject=controller(capture);
    final first=subject.begin();
    final second=subject.begin();
    expect(capture.permissions,1);
    permissionGate.complete(true);
    await Future.wait([first,second]);
    expect(capture.starts,1);
    expect(subject.recording,isTrue);
    await subject.discard();
    expect(capture.stops,1);
    expect(await File(path).exists(),isFalse);
    await subject.shutdown();
  });

  test('discard cancels a late start without leaving microphone or file behind',() async {
    final startGate=Completer<void>();
    final capture=_Capture(startGate:startGate);
    final subject=controller(capture);
    final starting=subject.begin();
    await _yieldUntil(()=>capture.starts==1);
    final discarded=subject.discard();
    startGate.complete();
    await Future.wait([starting,discarded]);
    expect(subject.recording,isFalse);
    expect(subject.review,isFalse);
    expect(capture.stops,1);
    expect(await File(path).exists(),isFalse);
    await subject.shutdown();
  });

  test('shutdown waits for pending stop before disposing and erases finished file',() async {
    final stopGate=Completer<void>();
    final capture=_Capture(stopGate:stopGate);
    final subject=controller(capture);
    await subject.begin();
    expect(subject.recording,isTrue);
    final stopping=subject.stop();
    await _yieldUntil(()=>capture.stops==1);
    final closing=subject.shutdown();
    await Future<void>.delayed(Duration.zero);
    expect(capture.disposals,0);
    stopGate.complete();
    await Future.wait([stopping,closing]);
    expect(capture.disposals,1);
    expect(subject.review,isFalse);
    expect(await File(path).exists(),isFalse);
  });

  test('shutdown does not dispose a native capture while discard is stopping it',() async {
    final stopGate=Completer<void>();
    final capture=_Capture(stopGate:stopGate);
    final subject=controller(capture);
    await subject.begin();
    final cancelling=subject.discard();
    await _yieldUntil(()=>capture.stops==1);
    final closing=subject.shutdown();
    await Future<void>.delayed(Duration.zero);
    expect(capture.disposals,0);
    stopGate.complete();
    await Future.wait([cancelling,closing]);
    expect(capture.stops,1);
    expect(capture.disposals,1);
    expect(await File(path).exists(),isFalse);
  });

  test('discard in progress rejects a new begin tap until the native stop finishes',() async {
    final stopGate=Completer<void>();
    final capture=_Capture(stopGate:stopGate);
    final subject=controller(capture);
    await subject.begin();
    final discarding=subject.discard();
    await _yieldUntil(()=>capture.stops==1);
    await subject.begin();
    expect(capture.starts,1);
    expect(capture.permissions,1);
    expect(subject.canSend,isFalse);
    stopGate.complete();
    await discarding;
    await subject.shutdown();
    expect(await File(path).exists(),isFalse);
  });

  test('native stop with null output path preserves original preview until discarded',() async {
    final capture=_Capture(nullStopPath:true);
    final subject=controller(capture);
    await subject.begin();
    await subject.stop();
    expect(subject.review,isTrue);
    expect(await File(path).exists(),isTrue);
    await subject.discard();
    expect(await File(path).exists(),isFalse);
    await subject.shutdown();
  });

  test('discard wipes original and alternate native output paths',() async {
    final alternate='${directory.path}/native-finalized.ogg';
    final capture=_Capture(alternateStopPath:alternate);
    final subject=controller(capture);
    await subject.begin();
    expect(await File(path).exists(),isTrue);
    await subject.discard();
    expect(capture.stops,1);
    expect(subject.recording,isFalse);
    expect(await File(path).exists(),isFalse);
    expect(await File(alternate).exists(),isFalse);
    await subject.shutdown();
  });

  test('account shutdown wipes alternate native stop output before dispose',() async {
    final alternate='${directory.path}/native-finalized.ogg';
    final capture=_Capture(alternateStopPath:alternate);
    final subject=controller(capture);
    await subject.begin();
    await subject.shutdown();
    expect(capture.stops,1);
    expect(capture.disposals,1);
    expect(subject.closed,isTrue);
    expect(await File(path).exists(),isFalse);
    expect(await File(alternate).exists(),isFalse);
  });

  test('logout racing with discard does not preserve alternate recording',() async {
    final stopGate=Completer<void>();
    final alternate='${directory.path}/native-finalized.ogg';
    final capture=_Capture(stopGate:stopGate,alternateStopPath:alternate);
    final subject=controller(capture);
    await subject.begin();
    final discardFuture=subject.discard();
    await _yieldUntil(()=>capture.stops==1);
    final signOutFuture=subject.shutdown();
    expect(capture.disposals,0);
    stopGate.complete();
    await Future.wait([discardFuture,signOutFuture]);
    expect(capture.stops,1);
    expect(capture.disposals,1);
    expect(await File(path).exists(),isFalse);
    expect(await File(alternate).exists(),isFalse);
  });

  test('shutdown during permission prompt never starts or saves a recording',() async {
    final permissionGate=Completer<bool>();
    final capture=_Capture(permissionGate:permissionGate);
    final subject=controller(capture);
    final starting=subject.begin();
    final closing=subject.shutdown();
    permissionGate.complete(true);
    await Future.wait([starting,closing]);
    expect(capture.permissions,1);
    expect(capture.starts,0);
    expect(capture.disposals,1);
    expect(await File(path).exists(),isFalse);
  });
}
