import 'dart:async';
import 'dart:io';
import 'dart:math';
import 'dart:typed_data';

import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';

import 'human_voice_models.dart';
import 'human_voice_transport.dart';

String _requestId() {
  final random=Random.secure();
  final chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  return List.generate(24,(_)=>chars[random.nextInt(chars.length)]).join();
}

/// One audio capture is private and local. NO public LiveKit or Gemini audio tracks.
abstract class HumanVoiceCapture {
  Future<bool> permission();
  Future<void> start(String path);
  Future<String?> stop();
  Future<void> dispose();
}
class PlatformHumanVoiceCapture implements HumanVoiceCapture {
  final AudioRecorder _recorder=AudioRecorder();
  @override Future<bool> permission()=>_recorder.hasPermission();
  @override Future<void> start(String path) async {
    await _recorder.start(const RecordConfig(
      encoder:AudioEncoder.opus, bitRate:32000, sampleRate:48000, numChannels:1,
    ),path:path);
  }
  @override Future<String?> stop()=>_recorder.stop();
  @override Future<void> dispose()=>_recorder.dispose();
}

/// The just_audio play future normally completes when playback finishes, not
/// when it starts. Keep it outside the controller's user-action Future so a
/// Stop button can interrupt a long note immediately.
abstract interface class HumanVoicePlayer {
  Future<void> loadFile(String path);
  Future<void> play();
  Future<void> stop();
  Future<void> dispose();
}
class JustAudioHumanVoicePlayer implements HumanVoicePlayer {
  final AudioPlayer _audio = AudioPlayer();
  @override Future<void> loadFile(String path) async {
    await _audio.setFilePath(path);
  }
  @override Future<void> play() => _audio.play();
  @override Future<void> stop() => _audio.stop();
  @override Future<void> dispose() => _audio.dispose();
}

/// Device-private preview file; removable on cancel, send or session end.
/// Pending uploads preserve the same request ID after uncertain errors.
class HumanVoiceController extends ChangeNotifier {
  HumanVoiceController({
    required this.conversationId, required this.ownerUserId,
    required this.transport, HumanVoiceCapture? capture,
    HumanVoicePlayer? player,
    Future<String> Function()? privatePath,
  }):_capture=capture??PlatformHumanVoiceCapture(),
     _player=player??JustAudioHumanVoicePlayer(),
     _pathFactory=privatePath;

  final String conversationId,ownerUserId;
  final HumanVoiceTransport transport;
  final HumanVoiceCapture _capture;
  final HumanVoicePlayer _player;
  final Future<String> Function()? _pathFactory;
  int _playGeneration=0;
  String? _downloadedPlaybackFile;
  String? playingMessageId;
  final List<HumanVoiceNote> _notes=[];
  List<HumanVoiceNote> get notes=>List.unmodifiable(_notes);

  String? error;
  String? _localFile;
  String? _request;
  Timer? _limitTimer;
  Completer<void>? _startFinished;
  Completer<void>? _stopFinished;
  Completer<void>? _discardFinished;
  int _recordGeneration=0;
  bool _starting=false, _stopping=false;
  bool recording=false,review=false,sending=false,loading=false,playing=false,closed=false;
  bool canLoadOlder=false;
  bool get canSend=>review&&!sending&&!recording&&!playing&&
      _discardFinished==null&&_localFile!=null;
  void _notify(){if(!closed)notifyListeners();}
  void _fail(String reason){error=reason;_notify();}
  Future<String> _privatePath() async {
    if(_pathFactory!=null)return _pathFactory();
    final dir=await getTemporaryDirectory();
    return '${dir.path}/masanawa-private-note-${_requestId()}.ogg';
  }
  Future<void> _erase(String? path) async {
    if(path==null||path.isEmpty)return;
    try{await File(path).delete();}catch(_){}
  }

  // A recorder is permitted to finalize to a different native output path
  // than the path passed to start(). Cancellation and account shutdown must
  // erase BOTH paths, not just the original temporary recording.
  Future<void> _stopCaptureAndEraseAlternateOutput() async {
    String? completedPath;
    try{completedPath=await _capture.stop();}catch(_){}
    if(completedPath!=_localFile)await _erase(completedPath);
  }

  /// A permission dialog or native recorder start may outlive the widget.
  /// Fence each start attempt and wait for it before disposing the native mic.
  Future<void> begin() async {
    if(closed||recording||review||sending||_starting||_stopping||
        _discardFinished!=null)return;
    _starting=true;
    final finished=_startFinished=Completer<void>();
    final generation=++_recordGeneration;
    String? path;
    bool attemptedStart=false;
    error=null;
    try {
      final allowed=await _capture.permission();
      if(closed||generation!=_recordGeneration)return;
      if(!allowed){
        _fail('Microphone permission denied. You can still send a text message.');
        return;
      }
      path=await _privatePath();
      if(closed||generation!=_recordGeneration){
        await _erase(path);
        return;
      }
      attemptedStart=true;
      await _capture.start(path);
      if(closed||generation!=_recordGeneration){
        String? completedPath;
        try{completedPath=await _capture.stop();}catch(_){}
        await _erase(completedPath);
        await _erase(path);
        return;
      }
      _localFile=path;
      _request=_requestId();
      recording=true;review=false;
      _limitTimer?.cancel();
      _limitTimer=Timer(const Duration(seconds:90),(){unawaited(stop());});
      _notify();
    } catch(_) {
      // A partially started native recorder must never retain microphone access.
      if(attemptedStart){
        String? completedPath;
        try{completedPath=await _capture.stop();}catch(_){}
        await _erase(completedPath);
      }
      await _erase(path);
      if(!closed&&generation==_recordGeneration)
        _fail('Voice recording is unavailable on this device. Use text instead.');
    } finally {
      _starting=false;
      _startFinished=null;
      finished.complete();
    }
  }
  Future<void> stop() async {
    if(closed||!recording||_stopping)return;
    _stopping=true;
    final finished=_stopFinished=Completer<void>();
    final generation=_recordGeneration;
    _limitTimer?.cancel();_limitTimer=null;
    recording=false;
    String? completedPath;
    try{
      completedPath=await _capture.stop();
      if(closed||generation!=_recordGeneration){
        // A shutdown/discard is already erasing the original recording.
        // Some encoders return a different output path; erase that too.
        if(completedPath!=_localFile)await _erase(completedPath);
        return;
      }
      final file=File(completedPath??_localFile??'');
      final len=await file.length();
      if(len<84||len>1536*1024){
        await _dropFile();
        await _erase(completedPath);
        review=false;
        _fail('Voice note must be shorter than 90 seconds and under 1.5 MB.');
        return;
      }
      // Some native recorders return null when the original output path is
      // authoritative; never erase the file we are about to review.
      if(completedPath!=null&&completedPath!=_localFile)
        await _erase(_localFile);
      _localFile=file.path;
      review=true;
      error=null;_notify();
    }catch(_){
      await _erase(completedPath);
      await _dropFile();
      review=false;
      if(!closed&&generation==_recordGeneration)
        _fail('Voice recording failed. Please retry or type a message.');
    }finally{
      _stopping=false;
      _stopFinished=null;
      finished.complete();
    }
  }
  // Match completed/failed playback to its request: a delayed completion
  // after Stop, logout, or a different note must not restore stale state.
  Future<void> _finishPlayback(int generation,{String? failedMessage}) async {
    if(generation!=_playGeneration)return;
    ++_playGeneration;
    try{await _player.stop();}catch(_){}
    await _clearDownloadedPlayback();
    playing=false;playingMessageId=null;
    if(failedMessage!=null&&!closed)_fail(failedMessage);
    else _notify();
  }

  Future<void> _clearDownloadedPlayback() async {
    final path=_downloadedPlaybackFile;
    _downloadedPlaybackFile=null;
    if(path!=null){try{await File(path).delete();}catch(_){}}
  }

  void _runPlayer(int generation,String errorMessage) {
    if(closed||generation!=_playGeneration)return;
    try{
      unawaited(_player.play().then((_) =>
          _finishPlayback(generation)).catchError((Object _) =>
          _finishPlayback(generation,failedMessage:errorMessage)));
    }catch(_){
      unawaited(_finishPlayback(generation,failedMessage:errorMessage));
    }
  }

  Future<void> stopPlayback() async {
    if(!playing)return;
    ++_playGeneration;
    playing=false;playingMessageId=null;
    _notify();
    try{await _player.stop();}catch(_){}
    await _clearDownloadedPlayback();
  }

  Future<void> preview() async {
    final path=_localFile;
    if(closed||!review||path==null||playing||_discardFinished!=null)return;
    final generation=++_playGeneration;
    playing=true;playingMessageId=null;error=null;_notify();
    try{
      await _player.loadFile(path);
      if(closed||generation!=_playGeneration)return;
      _runPlayer(generation,'Could not preview this recording.');
    }catch(_){
      await _finishPlayback(generation,
          failedMessage:'Could not preview this recording.');
    }
  }

  Future<void> send() async {
    final path=_localFile,id=_request;
    if(closed||!canSend||path==null||id==null)return;
    sending=true;error=null;_notify();
    try{
      final file=File(path);
      final size=await file.length();
      if(size<84||size>1536*1024)throw const FormatException('Recording size changed');
      final bytes=Uint8List.fromList(await file.readAsBytes());
      if(bytes.length!=size)throw const FormatException('Recording changed during upload');
      final note=await transport.send(conversationId,id,bytes);
      if(closed)return;
      if(note.conversationId!=conversationId||note.senderUserId!=ownerUserId||
         note.clientRequestId!=id)throw const FormatException('Wrong-account voice receipt');
      _notes.removeWhere((n)=>n.messageId==note.messageId);
      _notes.insert(0,note);
      await _dropFile();
      review=false;error=null;
    }catch(_){
      // Keep original file + request ID; an uncertain success cannot be sent twice.
      if(!closed)error='Voice note not confirmed. Retry the same recording or discard it.';
    }finally{sending=false;_notify();}
  }
  Future<void> refresh({String? before}) async {
    if(closed||loading)return;
    loading=true;error=null;_notify();
    try{
      final values=await transport.list(conversationId,before:before);
      if(closed)return;
      if(values.any((note)=>note.conversationId!=conversationId))
        throw const FormatException('Mixed conversations');
      if(before==null)_notes.clear();
      canLoadOlder=values.length==30;
      for(final note in values){
        if(!_notes.any((saved)=>saved.messageId==note.messageId))_notes.add(note);
      }
      _notes.sort((a,b)=>BigInt.parse(b.sequence).compareTo(BigInt.parse(a.sequence)));
    }catch(_){if(!closed)error='Private voice history unavailable. Retry after signing in.';}
    finally{loading=false;_notify();}
  }
  Future<void> older() async {
    if(closed||loading||!canLoadOlder||_notes.isEmpty)return;
    await refresh(before:_notes.last.sequence);
  }
  Future<void> play(HumanVoiceNote note) async {
    if(closed||playing||note.conversationId!=conversationId)return;
    final generation=++_playGeneration;
    playing=true;playingMessageId=note.messageId;error=null;_notify();
    String? path;
    try{
      // Authorization for every private media read stays on the Gateway.
      final bytes=await transport.read(note.messageId);
      if(closed||generation!=_playGeneration)return;
      path=await _privatePath();
      if(closed||generation!=_playGeneration){
        // The asynchronous path factory may have already created a private
        // file before Stop or sign-out invalidated this playback generation.
        // Never orphan that file or allow it to enter a later session.
        await _erase(path);
        return;
      }
      _downloadedPlaybackFile=path;
      await File(path).writeAsBytes(bytes,flush:true);
      if(closed||generation!=_playGeneration){
        try{await File(path).delete();}catch(_){}
        return;
      }
      await _player.loadFile(path);
      if(closed||generation!=_playGeneration)return;
      _runPlayer(generation,'Voice note unavailable, deleted or access revoked.');
    }catch(_){
      if(path!=null&&generation!=_playGeneration){
        try{await File(path).delete();}catch(_){}
      }
      await _finishPlayback(generation,
          failedMessage:'Voice note unavailable, deleted or access revoked.');
    }
  }
  Future<void> delete(HumanVoiceNote note) async {
    if(closed||note.senderUserId!=ownerUserId||note.conversationId!=conversationId)return;
    // A user deleting their own message must not leave its private audio
    // playing or cached on this device while the server deletion is pending.
    if(playingMessageId==note.messageId)await stopPlayback();
    if(closed)return;
    try{
      await transport.remove(note.messageId);
      if(closed)return;
      _notes.removeWhere((m)=>m.messageId==note.messageId);
      _notify();
    }catch(_){_fail('Could not remove voice note. Retry.');}
  }
  Future<void> _dropFile() async {
    await stopPlayback();
    try{await _player.stop();}catch(_){}
    final path=_localFile;_localFile=null;_request=null;
    if(path!=null){try{await File(path).delete();}catch(_){}}
  }
  Future<void> discard() async {
    if(closed)return;
    // Cancellation is itself an async native recorder operation; shutdown
    // must wait until it has stopped the microphone and erased temp audio.
    if(_discardFinished!=null){
      await _discardFinished!.future;
      return;
    }
    final finished=_discardFinished=Completer<void>();
    ++_recordGeneration; // cancel an in-progress permission/start attempt
    _limitTimer?.cancel();_limitTimer=null;
    try {
      await _startFinished?.future;
      await _stopFinished?.future;
      if(recording){
        recording=false;
        await _stopCaptureAndEraseAlternateOutput();
      }
      review=false;
      await _dropFile();
      error=null;_notify();
    } finally {
      _discardFinished=null;
      finished.complete();
    }
  }
  /// Called on sign-out, account switch and screen disposal. Wipes temporary
  /// media and does not let late replies restore old account's private state.
  Future<void> shutdown() async {
    if(closed)return;
    closed=true;++_playGeneration;++_recordGeneration;
    _limitTimer?.cancel();_limitTimer=null;
    // Do not dispose the native recorder while permission/start/stop is in
    // flight. The cancelled start itself stops and erases any late capture.
    await _discardFinished?.future;
    await _startFinished?.future;
    await _stopFinished?.future;
    if(recording)await _stopCaptureAndEraseAlternateOutput();
    _notes.clear();canLoadOlder=false;recording=false;review=false;
    await _dropFile();
    await _clearDownloadedPlayback();
    await _player.dispose();
    await _capture.dispose();
    super.dispose();
  }
}
