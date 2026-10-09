import '../core/network/api_client.dart';
import 'human_call_models.dart';

abstract interface class HumanCallTransport {
  Future<HumanCall> start({
    required String conversationId,
    required String requestId,
    required HumanCallKind kind,
  });
  Future<HumanCall> get(String callId);
  Future<HumanCall> act(String callId, String action);
  Future<HumanCallCredentials> credentials(String callId);
  Future<List<HumanCall>> recent();
}

class GatewayHumanCallTransport implements HumanCallTransport {
  GatewayHumanCallTransport(this.api);
  final ApiClient api;
  void _auth() {
    if (api.accessToken == null || api.accessToken!.isEmpty) {
      throw const ApiException(
        'Sign in before making private calls',
        statusCode:401,code:'AUTH_REQUIRED',
      );
    }
  }

  @override
  Future<HumanCall> start({
    required String conversationId,
    required String requestId,
    required HumanCallKind kind,
  }) async {
    _auth();
    final response=await api.dio.post<dynamic>(
      '/v1/messages/calls',
      data:{
        'conversationId':conversationId,
        'requestId':requestId,
        'kind':kind.name,
      },
    );
    return HumanCall.fromJson(response.data);
  }

  @override
  Future<HumanCall> get(String callId) async {
    _auth();
    final response=await api.dio.get<dynamic>('/v1/messages/calls/${Uri.encodeComponent(callId)}');
    return HumanCall.fromJson(response.data);
  }

  @override
  Future<HumanCall> act(String callId,String action) async {
    _auth();
    if (!{'accept','decline','end'}.contains(action)) {
      throw ArgumentError.value(action,'action','Unknown call transition');
    }
    final response=await api.dio.post<dynamic>(
      '/v1/messages/calls/${Uri.encodeComponent(callId)}/$action',data:<String,dynamic>{},
    );
    return HumanCall.fromJson(response.data);
  }

  @override
  Future<HumanCallCredentials> credentials(String callId) async {
    _auth();
    final response=await api.dio.post<dynamic>(
      '/v1/messages/calls/${Uri.encodeComponent(callId)}/media-token',
      data:<String,dynamic>{},
    );
    return HumanCallCredentials.fromJson(response.data,callId);
  }

  @override
  Future<List<HumanCall>> recent() async {
    _auth();
    final response=await api.dio.get<dynamic>(
      '/v1/messages/calls',queryParameters:{'limit':30},
    );
    if (response.data is! Map) throw const FormatException('Invalid private calls list');
    final map=Map<String,dynamic>.from(response.data as Map);
    final rows=map['calls'];
    if (rows is! List || rows.length>50) {
      throw const FormatException('Invalid private calls list');
    }
    return List<HumanCall>.unmodifiable(rows.map(HumanCall.fromJson));
  }
}
