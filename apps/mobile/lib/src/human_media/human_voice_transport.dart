import 'dart:async';
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
    // Dio's ResponseType.bytes buffers the whole server response before this
    // client can enforce its 1.5 MiB limit. A faulty upstream proxy (or a
    // compromised endpoint) can otherwise exhaust a budget Android device.
    final cancellation=CancelToken();
    final response=await api.dio.get<ResponseBody>(
      '/messages/voice/$messageId',
      options:Options(responseType:ResponseType.stream),
      cancelToken:cancellation,
    );
    final stream=response.data;
    if(stream==null)throw const FormatException('Empty private voice response');
    // A StreamIterator need not subscribe until its first moveNext(). On bad
    // headers, explicitly subscribe then cancel to close the upstream HTTP
    // response without waiting for any attacker-controlled body bytes.
    Future<void> cancelUnread() async {
      final subscription=stream.stream.listen((_) {},
          onError:(Object _,StackTrace __) {});
      await subscription.cancel();
      cancellation.cancel('Private voice response rejected');
      await Future<void>.delayed(Duration.zero);
    }
    final type=response.headers.value(Headers.contentTypeHeader)
        ?.split(';').first.trim().toLowerCase();
    if(type!='audio/ogg') {
      await cancelUnread();
      throw const FormatException('Invalid private voice content type');
    }
    final rawLength=response.headers.value(Headers.contentLengthHeader);
    final claimedLength=rawLength==null?null:int.tryParse(rawLength);
    if(rawLength!=null&&(claimedLength==null||
        claimedLength<84||claimedLength>1536*1024)) {
      await cancelUnread();
      throw const FormatException('Invalid private voice content length');
    }
    final iterator=StreamIterator<Uint8List>(stream.stream);
    try {
      final builder=BytesBuilder(copy:true);
      var received=0;
      while(await iterator.moveNext()) {
        // A sign-out/account switch during a slow download must cancel the
        // unread stream rather than caching private audio for the next user.
        if(token!=api.accessToken)
          throw const ApiException('Account session changed');
        final chunk=iterator.current;
        if(chunk.length>1536*1024-received)
          throw const FormatException('Private voice response exceeds size limit');
        received+=chunk.length;
        builder.add(chunk);
      }
      if(token!=api.accessToken)
        throw const ApiException('Account session changed');
      if(received<84||(claimedLength!=null&&received!=claimedLength))
        throw const FormatException('Truncated private voice response');
      return builder.takeBytes();
    } finally {
      // Also cancel on invalid headers, oversized chunks, network exceptions,
      // and sign-out, so the remaining body never drains into memory.
      await iterator.cancel();
      cancellation.cancel('Private voice read finished');
      await Future<void>.delayed(Duration.zero);
    }
  }
  @override
  Future<void> remove(String messageId) async {
    auth();uuid(messageId);
    final token=api.accessToken;
    await api.dio.delete<dynamic>('/messages/voice/$messageId');
    // Deletion may already be committed by the server; if account A signs out
    // while it is pending, never let account B's UI treat A's receipt as its own.
    if(token!=api.accessToken)
      throw const ApiException('Account session changed; check voice history');
  }
}
