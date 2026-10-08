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

/// Device-private preview file; removable on cancel, send or session end.
/// Pending uploads preserve the same request ID after uncertain errors.
class HumanVoiceController extends ChangeNotifier {
  HumanVoiceController({
    required this.conversationId, required this.ownerUserId,
    required this.transport, HumanVoiceCapture? capture,
    AudioPlayer? player,
  }):_capture=capture??PlatformHumanVoiceCapture(),_player=player??AudioPlayer();

  final String conversationId,ownerUserId;
  final HumanVoiceTransport transport;
  final HumanVoiceCapture _capture;
  final AudioPlayer _player;
  final List<HumanVoiceNote> _notes=[];
  List<HumanVoiceNote> get notes=>List.unmodifiable(_notes);

  String? error;
  String? _localFile;
  String? _request;
  Timer? _limitTimer;
  bool recording=false,review=false,sending=false,loading=false,playing=false,closed=false;
  bool get canSend=>review&&!sending&&!recording&&_localFile!=null;
  void _notify(){if(!closed)notifyListeners();}
  void _fail(String reason){error=reason;_notify();}
  Future<String> _privatePath() async {
    final dir=await getTemporaryDirectory();
    return '${dir.path}/masanawa-private-note-${_requestId()}.ogg';
  }
  Future<void> begin() async {
    if(closed||recording||review||sending)return;
    error=null;
    try {
      if(!await _capture.permission()){
        _fail('Microphone permission denied. You can still send a text message.');
        return;
      }
      final path=await _privatePath();
      if(closed)return;
      await _capture.start(path);
      _localFile=path;
      _request=_requestId();
      recording=true;review=false;
      _limitTimer?.cancel();
      _limitTimer=Timer(const Duration(seconds:90),(){unawaited(stop());});
      _notify();
    } catch(_) {await discard();_fail('Voice recording is unavailable on this device. Use text instead.');}
  }
  Future<void> stop() async {
    if(closed||!recording)return;
    _limitTimer?.cancel();_limitTimer=null;
    recording=false;
    try{
      final path=await _capture.stop();
      if(closed)return;
      final file=File(path??_localFile??'');
      final len=await file.length();
      if(len<84||len>1536*1024){
        await discard();
        _fail('Voice note must be shorter than 90 seconds and under 1.5 MB.');
        return;
      }
      _localFile=file.path;
      review=true;
      error=null;_notify();
    }catch(_){await discard();_fail('Voice recording failed. Please retry or type a message.');}
  }
  Future<void> preview() async {
    final path=_localFile;
    if(closed||!review||path==null||playing)return;
    playing=true;error=null;_notify();
    try{
      await _player.setFilePath(path);
      await _player.play();
    }catch(_){_fail('Could not preview this recording.');}
    finally{playing=false;_notify();}
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
      for(final note in values){
        if(!_notes.any((saved)=>saved.messageId==note.messageId))_notes.add(note);
      }
      _notes.sort((a,b)=>BigInt.parse(b.sequence).compareTo(BigInt.parse(a.sequence)));
    }catch(_){if(!closed)error='Private voice history unavailable. Retry after signing in.';}
    finally{loading=false;_notify();}
  }
  Future<void> play(HumanVoiceNote note) async {
    if(closed||playing||note.conversationId!=conversationId)return;
    playing=true;_notify();
    String? path;
    try{
      final bytes=await transport.read(note.messageId);
      if(closed)return;
      path=await _privatePath();
      await File(path).writeAsBytes(bytes,flush:true);
      await _player.setFilePath(path);
      await _player.play();
    }catch(_){if(!closed)_fail('Voice note unavailable, deleted or access revoked.');}
    finally{
      await _player.stop();
      if(path!=null){try{await File(path).delete();}catch(_){}}
      playing=false;_notify();
    }
  }
  Future<void> delete(HumanVoiceNote note) async {
    if(closed||note.senderUserId!=ownerUserId||note.conversationId!=conversationId)return;
    try{
      await transport.remove(note.messageId);
      if(closed)return;
      _notes.removeWhere((m)=>m.messageId==note.messageId);
      _notify();
    }catch(_){_fail('Could not remove voice note. Retry.');}
  }
  Future<void> _dropFile() async {
    try{await _player.stop();}catch(_){}
    final path=_localFile;_localFile=null;_request=null;
    if(path!=null){try{await File(path).delete();}catch(_){}}
  }
  Future<void> discard() async {
    _limitTimer?.cancel();_limitTimer=null;
    if(recording){try{await _capture.stop();}catch(_){}}
    recording=false;review=false;
    await _dropFile();
    error=null;_notify();
  }
  /// Called on sign-out, account switch and screen disposal. Wipes temporary
  /// media and does not let late replies restore old account's private state.
  Future<void> shutdown() async {
    if(closed)return;
    closed=true;_limitTimer?.cancel();_limitTimer=null;
    if(recording){try{await _capture.stop();}catch(_){}}
    _notes.clear();recording=false;review=false;
    await _dropFile();
    await _player.dispose();
    await _capture.dispose();
    super.dispose();
  }
}
