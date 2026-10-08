import 'dart:typed_data';
import 'package:dio/dio.dart';
import '../core/network/api_client.dart';
import 'human_voice_models.dart';

abstract class HumanVoiceTransport {
  Future<HumanVoiceNote> send(String conversationId,String clientRequestId,Uint8List ogg);
  Future<List<HumanVoiceNote>> list(String conversationId,{String? before,int limit=30});
  Future<Uint8List> read(String messageId);
  Future<void> remove(String messageId);
}

/// Never constructs public object URLs or stores provider credentials.
/// Uses the canonical ApiClient bearer/refresh pipeline for binary reads/writes.
class GatewayHumanVoiceTransport implements HumanVoiceTransport {
  const GatewayHumanVoiceTransport(this.api);
  final ApiClient api;
  void auth() {
    if(api.accessToken==null||api.accessToken!.isEmpty)
      throw const ApiException('Sign in to use private voice notes',
          statusCode:401,code:'AUTH_REQUIRED');
  }
  String uuid(String id) {
    if(!RegExp(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$').hasMatch(id))
      throw const FormatException('Invalid conversation or voice note ID');
    return id;
  }
  @override
  Future<HumanVoiceNote> send(String conversationId,String clientRequestId,Uint8List ogg) async {
    auth();uuid(conversationId);
    if(!RegExp(r'^[A-Za-z0-9_-]{12,128}$').hasMatch(clientRequestId))
      throw const FormatException('Invalid voice request reference');
    if(ogg.length<84||ogg.length>1536*1024)
      throw const FormatException('Voice note exceeds safe size limit');
    final token=api.accessToken;
    final result=await api.dio.post<dynamic>(
      '/messages/$conversationId/voice-notes',
      data:ogg,
      options:Options(contentType:'audio/ogg',headers:{
        'x-message-client-request-id':clientRequestId,
      }),
    );
    if(token!=api.accessToken)throw const ApiException('Account session changed; reopen conversation');
    return HumanVoiceNote.fromJson(result.data);
  }
  @override
  Future<List<HumanVoiceNote>> list(String conversationId,{String? before,int limit=30}) async {
    auth();uuid(conversationId);
    if(limit<1||limit>50)throw RangeError.range(limit,1,50);
    final token=api.accessToken;
    final response=await api.dio.get<dynamic>(
      '/messages/$conversationId/voice-notes',
      queryParameters:{'limit':limit,if(before!=null)'before':before},
    );
    if(token!=api.accessToken)throw const ApiException('Account session changed');
    final raw=response.data;
    if(raw is! Map||raw['voiceNotes'] is! List)
      throw const FormatException('Invalid voice note page');
    return List.unmodifiable((raw['voiceNotes'] as List).map(HumanVoiceNote.fromJson));
  }
  @override
  Future<Uint8List> read(String messageId) async {
    auth();uuid(messageId);
    final token=api.accessToken;
    final response=await api.dio.get<List<int>>(
      '/messages/voice/$messageId',
      options:Options(responseType:ResponseType.bytes),
    );
    if(token!=api.accessToken)throw const ApiException('Account session changed');
    final bytes=response.data;
    if(bytes==null||bytes.length<84||bytes.length>1536*1024)
      throw const FormatException('Invalid private voice download');
    return Uint8List.fromList(bytes);
  }
  @override
  Future<void> remove(String messageId) async {
    auth();uuid(messageId);
    await api.dio.delete<dynamic>('/messages/voice/$messageId');
  }
}
