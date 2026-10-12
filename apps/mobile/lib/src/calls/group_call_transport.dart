import 'package:dio/dio.dart';
import '../agents/agent_shell.dart';
import '../core/network/api_client.dart';

class GroupContact {
  const GroupContact({
    required this.characterId,
    required this.displayName,
    this.supportAgent = false,
  });
  final String characterId;
  final String displayName;
  final bool supportAgent;
}

class GroupParticipant {
  const GroupParticipant({
    required this.characterId,
    required this.displayName,
    required this.state,
    this.callId,
  });
  final String characterId, displayName, state;
  final String? callId;
  factory GroupParticipant.fromJson(Map json) {
    if (json['characterId'] is! String ||
        (json['characterId'] as String).isEmpty ||
        json['displayName'] is! String ||
        (json['displayName'] as String).isEmpty ||
        !const [
          'selected',
          'connecting',
          'active',
          'left',
          'failed',
        ].contains(json['state']) ||
        (json['callId'] != null && json['callId'] is! String)) {
      throw const FormatException('Invalid group participant');
    }
    return GroupParticipant(
      characterId: json['characterId'] as String,
      displayName: json['displayName'] as String,
      state: json['state'] as String,
      callId: json['callId'] as String?,
    );
  }
}

class MasanaCallGroup {
  const MasanaCallGroup({
    required this.groupId,
    required this.state,
    required this.createdAt,
    required this.participants,
    this.endedAt,
  });
  final String groupId, state;
  final DateTime createdAt;
  final DateTime? endedAt;
  final List<GroupParticipant> participants;
  factory MasanaCallGroup.fromJson(Map json) {
    final created = DateTime.tryParse(
      json['createdAt'] is String ? json['createdAt'] as String : '',
    );
    final ended = json['endedAt'] == null
        ? null
        : DateTime.tryParse(
            json['endedAt'] is String ? json['endedAt'] as String : '',
          );
    if (json['groupId'] is! String ||
        (json['groupId'] as String).isEmpty ||
        !const ['connecting', 'active', 'ended'].contains(json['state']) ||
        created == null ||
        (json['endedAt'] != null && ended == null) ||
        json['participants'] is! List) {
      throw const FormatException('Invalid call group');
    }
    final participants = (json['participants'] as List)
        .map((p) {
          if (p is! Map) {
            throw const FormatException('Invalid group participant');
          }
          return GroupParticipant.fromJson(p);
        })
        .toList(growable: false);
    if (participants.length < 2 ||
        participants.length > 4 ||
        participants.map((p) => p.characterId).toSet().length !=
            participants.length) {
      throw const FormatException('Invalid group membership');
    }
    return MasanaCallGroup(
      groupId: json['groupId'] as String,
      state: json['state'] as String,
      createdAt: created,
      endedAt: ended,
      participants: List.unmodifiable(participants),
    );
  }
}

abstract interface class GroupCallTransport {
  Future<MasanaCallGroup> create(String requestId, List<String> characterIds);
  Future<MasanaCallGroup> load(String groupId);
  Future<AgentLiveVoiceGrant> token(
    String groupId,
    String characterId, {
    String? admissionId,
  });
  Future<MasanaCallGroup> remove(String groupId, String characterId);
  Future<MasanaCallGroup> end(String groupId);
}

/// A separate authenticated client pins every request to this account. The
/// mutable shared ApiClient interceptor cannot replace its bearer mid-request.
class GatewayGroupCallTransport implements GroupCallTransport {
  GatewayGroupCallTransport({
    required ApiClient api,
    required this.accountKey,
    required this.currentAccountKey,
    String? accessToken,
    HttpClientAdapter? adapter,
  }) : _dio = Dio(
         BaseOptions(
           baseUrl: api.dio.options.baseUrl,
           headers: {
             'Authorization': 'Bearer ${accessToken ?? api.accessToken ?? ''}',
           },
           connectTimeout: const Duration(seconds: 15),
           receiveTimeout: const Duration(seconds: 20),
           sendTimeout: const Duration(seconds: 15),
           followRedirects: false,
         ),
       ) {
    if (adapter != null) _dio.httpClientAdapter = adapter;
  }
  final Dio _dio;
  final String accountKey;
  final String? Function() currentAccountKey;
  final Set<String> _ownedGroups = {};
  void _check() {
    if (accountKey.isEmpty || currentAccountKey() != accountKey) {
      throw const ApiException(
        'This call belongs to a different sign-in session.',
        code: 'GROUP_ACCOUNT_CHANGED',
      );
    }
  }

  Future<Map> _request(
    String method,
    String path, [
    Map<String, dynamic>? body,
    bool cleanup = false,
    bool retainCreatedGroup = false,
  ]) async {
    if (!cleanup) _check();
    try {
      final result = await _dio.request<dynamic>(
        path,
        data: body,
        options: Options(method: method),
      );
      if (!cleanup && !retainCreatedGroup) _check();
      if (result.data is! Map) {
        throw const FormatException('Invalid group response');
      }
      return result.data as Map;
    } on DioException catch (error) {
      if (!cleanup) _check();
      throw mapDioError(error);
    }
  }

  String _path(String groupId) =>
      '/v1/calls/groups/${Uri.encodeComponent(groupId)}';
  MasanaCallGroup _group(Map response) {
    if (response['group'] is! Map) {
      throw const FormatException('Invalid group response');
    }
    return MasanaCallGroup.fromJson(response['group'] as Map);
  }

  @override
  Future<MasanaCallGroup> create(
    String requestId,
    List<String> characterIds,
  ) async {
    final group = _group(
      await _request(
        'POST',
        '/v1/calls/groups',
        {'requestId': requestId, 'characterIds': characterIds},
        false,
        true,
      ),
    );
    _ownedGroups.add(group.groupId);
    return group;
  }

  @override
  Future<MasanaCallGroup> load(String groupId) async =>
      _group(await _request('GET', _path(groupId)));
  @override
  Future<MasanaCallGroup> remove(String groupId, String characterId) async =>
      _group(
        await _request(
          'DELETE',
          '${_path(groupId)}/participants/${Uri.encodeComponent(characterId)}',
        ),
      );
  @override
  Future<MasanaCallGroup> end(String groupId) async {
    if (!_ownedGroups.contains(groupId)) _check();
    return _group(
      await _request(
        'POST',
        '${_path(groupId)}/end',
        {},
        _ownedGroups.contains(groupId),
      ),
    );
  }

  @override
  Future<AgentLiveVoiceGrant> token(
    String groupId,
    String characterId, {
    String? admissionId,
  }) async {
    final json = await _request(
      'POST',
      '${_path(groupId)}/participants/${Uri.encodeComponent(characterId)}/token',
      {'admissionId': ?admissionId},
    );
    final expiry = DateTime.tryParse(
      json['expiresAt'] is String ? json['expiresAt'] as String : '',
    );
    if (json['groupId'] != groupId ||
        json['characterId'] != characterId ||
        json['callId'] is! String ||
        (json['callId'] as String).isEmpty ||
        json['token'] is! String ||
        json['websocketUrl'] is! String ||
        json['model'] is! String ||
        json['voiceName'] is! String ||
        expiry == null) {
      throw const FormatException('Invalid group voice grant');
    }
    return AgentLiveVoiceGrant(
      token: json['token'] as String,
      websocketUrl: json['websocketUrl'] as String,
      model: json['model'] as String,
      voiceName: json['voiceName'] as String,
      expiresAt: expiry,
      callId: json['callId'] as String,
    );
  }
}
