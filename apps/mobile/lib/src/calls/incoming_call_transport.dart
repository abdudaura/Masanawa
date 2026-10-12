import 'package:dio/dio.dart';

import '../agents/agent_shell.dart';
import '../core/network/api_client.dart';

class IncomingCallRecord {
  const IncomingCallRecord({
    required this.callId,
    required this.characterId,
    required this.displayName,
    required this.state,
    required this.expiresAt,
    required this.createdAt,
  });
  final String callId, characterId, displayName, state;
  final DateTime expiresAt, createdAt;
  bool get ringing => state == 'ringing';
  factory IncomingCallRecord.fromJson(Map json) {
    final created = DateTime.tryParse(
      json['createdAt'] is String ? json['createdAt'] as String : '',
    );
    final expires = DateTime.tryParse(
      json['expiresAt'] is String ? json['expiresAt'] as String : '',
    );
    if ([
          'callId',
          'characterId',
          'displayName',
        ].any((key) => json[key] is! String || (json[key] as String).isEmpty) ||
        !const [
          'ringing',
          'accepted',
          'declined',
          'cancelled',
          'missed',
        ].contains(json['state']) ||
        created == null ||
        expires == null) {
      throw const FormatException('Invalid incoming Masana call');
    }
    return IncomingCallRecord(
      callId: json['callId'] as String,
      characterId: json['characterId'] as String,
      displayName: json['displayName'] as String,
      state: json['state'] as String,
      expiresAt: expires,
      createdAt: created,
    );
  }
}

abstract interface class IncomingCallTransport {
  Future<List<IncomingCallRecord>> list();
  Future<IncomingCallRecord> load(String callId);
  Future<IncomingCallRecord> accept(String callId);
  Future<IncomingCallRecord> decline(String callId);
  Future<AgentLiveVoiceGrant> token(String callId, {String? admissionId});
}

/// Credentials are captured for this sign-in; a mutable global interceptor
/// cannot substitute another account during an outstanding request.
class GatewayIncomingCallTransport implements IncomingCallTransport {
  GatewayIncomingCallTransport({
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
  void _check() {
    if (accountKey.isEmpty || currentAccountKey() != accountKey) {
      throw const ApiException(
        'The signed-in account changed.',
        code: 'INCOMING_ACCOUNT_CHANGED',
      );
    }
  }

  String _path(String id) => '/v1/calls/incoming/${Uri.encodeComponent(id)}';
  Future<Map> _request(
    String method,
    String path, [
    Map<String, dynamic>? body,
  ]) async {
    _check();
    try {
      final response = await _dio.request<dynamic>(
        path,
        data: body,
        options: Options(method: method),
      );
      _check();
      if (response.data is! Map) {
        throw const FormatException('Invalid incoming call response');
      }
      return response.data as Map;
    } on DioException catch (failure) {
      _check();
      throw mapDioError(failure);
    }
  }

  IncomingCallRecord _call(Map json, String id) {
    if (json['call'] is! Map) {
      throw const FormatException('Invalid incoming call response');
    }
    final call = IncomingCallRecord.fromJson(json['call'] as Map);
    if (call.callId != id) {
      throw const FormatException('Incoming call identity changed');
    }
    return call;
  }

  @override
  Future<List<IncomingCallRecord>> list() async {
    final json = await _request('GET', '/v1/calls/incoming');
    if (json['calls'] is! List) {
      throw const FormatException('Invalid incoming calls list');
    }
    return (json['calls'] as List)
        .map((value) {
          if (value is! Map) {
            throw const FormatException('Invalid incoming call');
          }
          return IncomingCallRecord.fromJson(value);
        })
        .toList(growable: false);
  }

  @override
  Future<IncomingCallRecord> load(String id) async =>
      _call(await _request('GET', _path(id)), id);
  @override
  Future<IncomingCallRecord> accept(String id) async =>
      _call(await _request('POST', '${_path(id)}/accept', {}), id);
  @override
  Future<IncomingCallRecord> decline(String id) async =>
      _call(await _request('POST', '${_path(id)}/decline', {}), id);
  @override
  Future<AgentLiveVoiceGrant> token(String id, {String? admissionId}) async {
    final json = await _request('POST', '${_path(id)}/token', {
      'admissionId': ?admissionId,
    });
    final expiry = DateTime.tryParse(
      json['expiresAt'] is String ? json['expiresAt'] as String : '',
    );
    if (json['callId'] != id ||
        [
          'token',
          'websocketUrl',
          'model',
          'voiceName',
        ].any((key) => json[key] is! String || (json[key] as String).isEmpty) ||
        expiry == null) {
      throw const FormatException('Invalid incoming voice grant');
    }
    return AgentLiveVoiceGrant(
      token: json['token'] as String,
      websocketUrl: json['websocketUrl'] as String,
      model: json['model'] as String,
      voiceName: json['voiceName'] as String,
      expiresAt: expiry,
      callId: id,
    );
  }
}
