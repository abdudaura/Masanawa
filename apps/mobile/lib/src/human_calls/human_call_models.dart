enum HumanCallKind { audio, video }
enum HumanCallState { ringing, active, declined, cancelled, missed, ended }

String _required(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value is! String || value.isEmpty) {
    throw FormatException('Invalid private call $key');
  }
  return value;
}

class HumanCall {
  const HumanCall({
    required this.callId, required this.conversationId,
    required this.callerUserId, required this.calleeUserId,
    required this.kind, required this.state, required this.createdAt,
    this.answeredAt, this.endedAt,
  });

  factory HumanCall.fromJson(dynamic payload) {
    if (payload is! Map) throw const FormatException('Invalid private call');
    final json = Map<String, dynamic>.from(payload);
    final kind = switch (_required(json, 'kind')) {
      'audio' => HumanCallKind.audio,
      'video' => HumanCallKind.video,
      _ => throw const FormatException('Unknown call kind'),
    };
    final state = switch (_required(json, 'state')) {
      'ringing' => HumanCallState.ringing,
      'active' => HumanCallState.active,
      'declined' => HumanCallState.declined,
      'cancelled' => HumanCallState.cancelled,
      'missed' => HumanCallState.missed,
      'ended' => HumanCallState.ended,
      _ => throw const FormatException('Unknown call state'),
    };
    DateTime date(String key) =>
        DateTime.tryParse(_required(json, key))?.toUtc() ??
        (throw FormatException('Invalid $key'));
    DateTime? optional(String key) {
      if (json[key] == null) return null;
      return date(key);
    }
    final call = HumanCall(
      callId: _required(json,'callId'),
      conversationId: _required(json,'conversationId'),
      callerUserId: _required(json,'callerUserId'),
      calleeUserId: _required(json,'calleeUserId'),
      kind:kind, state:state, createdAt:date('createdAt'),
      answeredAt:optional('answeredAt'),endedAt:optional('endedAt'),
    );
    if (call.callerUserId == call.calleeUserId ||
        (call.state == HumanCallState.active && call.answeredAt == null)) {
      throw const FormatException('Invalid call participants or state');
    }
    return call;
  }

  final String callId;
  final String conversationId;
  final String callerUserId;
  final String calleeUserId;
  final HumanCallKind kind;
  final HumanCallState state;
  final DateTime createdAt;
  final DateTime? answeredAt;
  final DateTime? endedAt;

  bool get terminal => switch(state) {
    HumanCallState.declined || HumanCallState.cancelled ||
    HumanCallState.missed || HumanCallState.ended => true,
    _ => false,
  };
}
class HumanCallCredentials {
  const HumanCallCredentials({
    required this.serverUrl,required this.participantToken,
    required this.roomName,required this.participantIdentity,
    required this.expiresAt,
  });

  factory HumanCallCredentials.fromJson(dynamic payload, String callId) {
    if (payload is! Map) throw const FormatException('Invalid call credentials');
    final json = Map<String,dynamic>.from(payload);
    final serverUrl = Uri.tryParse(_required(json,'server_url'));
    final expiry = DateTime.tryParse(_required(json,'expires_at'));
    final roomName = _required(json,'room_name');
    if (serverUrl == null || serverUrl.scheme != 'wss' ||
        serverUrl.host.isEmpty || serverUrl.userInfo.isNotEmpty ||
        expiry == null || !expiry.isAfter(DateTime.now().add(const Duration(seconds:2))) ||
        roomName != 'human-call_$callId') {
      throw const FormatException('Private call credentials unavailable or expired');
    }
    return HumanCallCredentials(
      serverUrl:serverUrl.toString(),
      participantToken:_required(json,'participant_token'),
      roomName:roomName,
      participantIdentity:_required(json,'participant_identity'),
      expiresAt:expiry,
    );
  }

  final String serverUrl;
  final String participantToken;
  final String roomName;
  final String participantIdentity;
  final DateTime expiresAt;
}
