import 'package:livekit_client/livekit_client.dart';
import 'human_call_models.dart';

abstract interface class HumanCallRoom {
  bool get connected;
  Future<void> connect(HumanCallCredentials credential,HumanCallKind kind);
  Future<void> setMuted(bool muted);
  Future<void> setCameraEnabled(bool enabled);
  Future<void> flipCamera();
  Future<void> setSpeaker(bool enabled);
  Future<void> close();
}

/// C09 uses a completely different private LiveKit room than public Talks.
/// The caller must have server-accepted call state and OS permissions BEFORE
/// invoking connect(); this implementation never joins a ringing call.
class LiveKitHumanCallRoom implements HumanCallRoom {
  Room? _room;
  bool _cameraOn=false;
  bool _muted=false;
  CameraPosition _position=CameraPosition.front;
  static Future<void>? _initializing;

  Room? get room => _room;

  static Future<void> _init() async {
    final existing=_initializing;
    if(existing!=null) return existing;
    final task=LiveKitClient.initialize();
    _initializing=task;
    try { await task; }
    catch (_) { if (identical(_initializing,task)) _initializing=null; rethrow; }
  }

  @override
  bool get connected => _room!=null;

  @override
  Future<void> connect(HumanCallCredentials credential,HumanCallKind kind) async {
    if(_room!=null) throw StateError('Another call already has media focus');
    await _init();
    final room=Room();
    try {
      await room.connect(
        credential.serverUrl,credential.participantToken,
        connectOptions:const ConnectOptions(autoSubscribe:true),
      );
      if(room.name!=credential.roomName || room.localParticipant==null) {
        throw StateError('Private call room or participant mismatch');
      }
      // Media is deliberately enabled only after a server-accepted state,
      // a short-lived C09 credential, and UI-granted platform permissions.
      await room.localParticipant!.setMicrophoneEnabled(true);
      if(kind==HumanCallKind.video) {
        await room.localParticipant!.setCameraEnabled(
          true,cameraCaptureOptions:const CameraCaptureOptions(
            cameraPosition:CameraPosition.front,maxFrameRate:15,
          ),
        );
        _cameraOn=true;
      }
      if(AudioManager.instance.canSwitchSpeakerphone) {
        await AudioManager.instance.setSpeakerOutputPreferred(
          kind==HumanCallKind.video,
        );
      }
      _room=room;
    } catch (_) {
      try { await room.localParticipant?.setMicrophoneEnabled(false); }
      catch (_) {}
      try { await room.localParticipant?.setCameraEnabled(false); }
      catch (_) {}
      try { await room.disconnect(); } catch (_) {}
      await room.dispose();
      rethrow;
    }
  }

  @override
  Future<void> setMuted(bool muted) async {
    final room=_room;
    if(room==null) throw StateError('No connected call');
    await room.localParticipant?.setMicrophoneEnabled(!muted);
    _muted=muted;
  }

  @override
  Future<void> setCameraEnabled(bool enabled) async {
    final room=_room;
    if(room==null) throw StateError('No connected call');
    await room.localParticipant?.setCameraEnabled(enabled);
    _cameraOn=enabled;
  }

  @override
  Future<void> flipCamera() async {
    final room=_room;
    if(room==null || !_cameraOn) return;
    final tracks=room.localParticipant?.videoTrackPublications;
    if(tracks==null) return;
    for(final pub in tracks) {
      final track=pub.track;
      if(track is LocalVideoTrack) {
        _position=_position==CameraPosition.front?CameraPosition.back:CameraPosition.front;
        await track.setCameraPosition(_position);
        return;
      }
    }
  }

  @override
  Future<void> setSpeaker(bool enabled) async {
    if(_room==null) throw StateError('No connected call');
    if(AudioManager.instance.canSwitchSpeakerphone) {
      await AudioManager.instance.setSpeakerOutputPreferred(enabled);
    }
  }

  @override
  Future<void> close() async {
    final room=_room;
    _room=null;
    _cameraOn=false;
    _muted=false;
    if(room==null) return;
    try { await room.localParticipant?.setMicrophoneEnabled(false); } catch (_) {}
    try { await room.localParticipant?.setCameraEnabled(false); } catch (_) {}
    try { await room.disconnect(); } catch (_) {}
    await room.dispose();
    if(AudioManager.instance.canSwitchSpeakerphone) {
      try { await AudioManager.instance.setSpeakerOutputPreferred(false); }
      catch (_) {}
    }
  }
}
