import 'dart:async';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'human_call_models.dart';
import 'human_call_room.dart';
import 'human_call_transport.dart';

class HumanCallController extends ChangeNotifier {
  HumanCallController({
    required this.currentUserId,required this.transport,
    required this.room,required this.isCurrentSession,
    required this.requestPermissions,
    this.pollInterval=const Duration(seconds:2),
  });

  final String currentUserId;
  final HumanCallTransport transport;
  final HumanCallRoom room;
  final bool Function() isCurrentSession;
  final Future<bool> Function(HumanCallKind kind) requestPermissions;
  final Duration pollInterval;
  HumanCall? call;
  String? error;
  bool busy=false;
  bool joining=false;
  bool muted=false;
  bool cameraEnabled=false;
  bool speakerEnabled=false;
  bool _disposed=false;
  int _generation=0;
  Timer? _pollTimer;
  Future<void>? _polling;
  Future<void>? _joinTask;

  bool get active => !_disposed && isCurrentSession();
  bool get connected => room.connected;
  bool get hasCall => call!=null;
  bool get isIncoming => call?.calleeUserId==currentUserId;
  bool get terminal => call?.terminal ?? false;
  void _notify() { if(!_disposed) notifyListeners(); }
  bool _current(int token)=>active && token==_generation;

  String _newRequestId() {
    final random=Random.secure();
    const alphabet='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-';
    return 'c${List.generate(23, (_) => alphabet[random.nextInt(alphabet.length)]).join()}';
  }

  Future<void> start(String conversationId,HumanCallKind kind) async {
    if(!active||busy||call!=null) return;
    final epoch=_generation;
    busy=true;error=null;_notify();
    final requestId=_newRequestId();
    try {
      final next=await transport.start(
        conversationId:conversationId,kind:kind,requestId:requestId,
      );
      if(!_current(epoch)) return;
      if(next.callerUserId!=currentUserId ||
          next.conversationId!=conversationId || next.kind!=kind) {
        throw const FormatException('Call admission did not match the current user');
      }
      call=next;
      _beginPolling();
    } catch (_) {
      if(_current(epoch)) error='Could not start a private call. Check connectivity and retry.';
    } finally {
      if(_current(epoch)) {busy=false;_notify();}
    }
  }

  /// Called only when a verified incoming call ID arrives from navigation,
  /// or after an authorized readback; never trusts a push caller-name payload.
  Future<void> load(String callId) async {
    if(!active) return;
    final epoch=++_generation;
    await room.close();
    call=null;error=null;busy=true;_notify();
    try {
      final next=await transport.get(callId);
      if(!_current(epoch))return;
      if(next.callerUserId!=currentUserId && next.calleeUserId!=currentUserId) {
        throw const FormatException('Private call is not for this account');
      }
      call=next;
      if(!next.terminal)_beginPolling();
    } catch (_) {
      if(_current(epoch))error='This call is unavailable or no longer permitted.';
    } finally {
      if(_current(epoch)){busy=false;_notify();}
    }
  }

  void _beginPolling() {
    _pollTimer?.cancel();
    if(!active || call==null || call!.terminal)return;
    _pollTimer=Timer.periodic(pollInterval,(_)=>unawaited(refresh()));
  }

  Future<void> refresh() {
    if(!active || call==null)return Future<void>.value();
    final ongoing=_polling;
    if(ongoing!=null)return ongoing;
    late final Future<void> task;
    task=_refresh().whenComplete(() {
      if(identical(_polling,task))_polling=null;
    });
    _polling=task;
    return task;
  }

  Future<void> _refresh() async {
    final epoch=_generation, current=call;
    if(current==null)return;
    try {
      final next=await transport.get(current.callId);
      if(!_current(epoch))return;
      if(next.callId!=current.callId ||
          next.conversationId!=current.conversationId ||
          next.callerUserId!=current.callerUserId ||
          next.calleeUserId!=current.calleeUserId) {
        throw const FormatException('Call identity changed during refresh');
      }
      call=next;
      error=null;_notify();
      if(next.terminal) {
        _pollTimer?.cancel();
        await room.close();
        if(!_current(epoch))return;
        _notify();
      } else if(next.state==HumanCallState.active) {
        await _joinIfAllowed(epoch);
      }
    } catch (_) {
      if(_current(epoch)) {
        // Lost permission/network never leaves a stale camera recording.
        await room.close();
        if(_current(epoch)){
          error='Connection lost or call permission changed. Retry to check status.';
          _notify();
        }
      }
    }
  }

  Future<void> accept() async {
    if(!active||busy||call?.state!=HumanCallState.ringing||!isIncoming)return;
    final epoch=_generation, current=call!;
    // Ask permission BEFORE accepting the server call. Camera or microphone
    // rejection must not silently answer with live media.
    if(!await requestPermissions(current.kind)) {
      if(_current(epoch)){error='Microphone/camera permission required. You can decline.';_notify();}
      return;
    }
    if(!_current(epoch))return;
    busy=true;error=null;_notify();
    try {
      final next=await transport.act(current.callId,'accept');
      if(!_current(epoch))return;
      call=next;
      await _joinIfAllowed(epoch,permissionGranted:true);
    } catch (_) {
      if(_current(epoch))error='This call expired or was cancelled. Refresh status.';
      await room.close();
    } finally {
      if(_current(epoch)){busy=false;_notify();}
    }
  }

  Future<void> _joinIfAllowed(int epoch,{bool permissionGranted=false}) {
    if(!_current(epoch)||room.connected||joining||call?.state!=HumanCallState.active) {
      return Future<void>.value();
    }
    final existing=_joinTask;
    if(existing!=null)return existing;
    late final Future<void> task;
    task=_join(epoch,permissionGranted).whenComplete((){
      if(identical(_joinTask,task))_joinTask=null;
    });
    _joinTask=task;
    return task;
  }

  Future<void> _join(int epoch,bool granted) async {
    final current=call;
    if(current==null||!_current(epoch))return;
    joining=true;_notify();
    try {
      if(!granted && !await requestPermissions(current.kind)) {
        throw StateError('Device media permission denied');
      }
      if(!_current(epoch))return;
      final token=await transport.credentials(current.callId);
      if(!_current(epoch))return;
      // Refresh server admission after token issue; never join on a cached
      // ringing/ended screen after contact revoked or call cancelled.
      final latest=await transport.get(current.callId);
      if(!_current(epoch)||latest.state!=HumanCallState.active)return;
      call=latest;
      await room.connect(token,latest.kind);
      if(!_current(epoch))await room.close();
      else {
        cameraEnabled=latest.kind==HumanCallKind.video;
        speakerEnabled=latest.kind==HumanCallKind.video;
        muted=false;error=null;
      }
    } catch (_) {
      await room.close();
      if(_current(epoch))error='Private call media unavailable. Try again or end call.';
    } finally {
      if(_current(epoch)){joining=false;_notify();}
    }
  }

  Future<void> decline() => _act('decline');
  Future<void> end() => _act('end');
  Future<void> _act(String action) async {
    if(!active||busy||call==null)return;
    final epoch=_generation,current=call!;
    if(action=='decline' && (!isIncoming||current.state!=HumanCallState.ringing))return;
    busy=true;error=null;_notify();
    // Close physical capture immediately on hangup, even when HTTP fails.
    await room.close();
    if(!_current(epoch))return;
    try {
      final next=await transport.act(current.callId,action);
      if(!_current(epoch))return;
      call=next;
      if(next.terminal)_pollTimer?.cancel();
    } catch (_) {
      if(_current(epoch)) {
        error='Hangup is unconfirmed. Checking the server state…';
        _beginPolling();
      }
    } finally {
      if(_current(epoch)){busy=false;_notify();}
    }
  }

  Future<void> setMuted(bool value) async {
    if(!active||!room.connected)return;
    try {await room.setMuted(value);if(active){muted=value;_notify();}}
    catch(_){if(active){error='Could not change microphone.';_notify();}}
  }
  Future<void> setCamera(bool value) async {
    if(!active||!room.connected||call?.kind!=HumanCallKind.video)return;
    try {await room.setCameraEnabled(value);if(active){cameraEnabled=value;_notify();}}
    catch(_){if(active){error='Camera unavailable.';_notify();}}
  }
  Future<void> flipCamera() async {
    if(!active||!room.connected||!cameraEnabled)return;
    try {await room.flipCamera();}
    catch(_){if(active){error='Could not switch camera.';_notify();}}
  }
  Future<void> setSpeaker(bool value) async {
    if(!active||!room.connected)return;
    try {await room.setSpeaker(value);if(active){speakerEnabled=value;_notify();}}
    catch(_){if(active){error='Audio output unavailable.';_notify();}}
  }

  Future<void> stop() async {
    _generation++;
    _pollTimer?.cancel();
    _pollTimer=null;
    call=null;
    await room.close();
    if(!_disposed)_notify();
  }

  @override
  void dispose() {
    _disposed=true;
    _generation++;
    _pollTimer?.cancel();
    _pollTimer=null;
    unawaited(room.close());
    super.dispose();
  }
}
