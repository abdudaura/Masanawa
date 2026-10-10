import '../core/network/api_client.dart';
import 'human_dm_models.dart';

abstract class HumanDmTransport {
  Future<String> open(String otherUserId);
  Future<List<HumanDmConversation>> inbox({String? before});
  Future<HumanDmPage> history(String conversationId, {String? before});
  Future<HumanDmMessage> send(String conversationId, String requestId, String body);
  Future<HumanDmMessage> edit(String messageId, String body);
  Future<HumanDmMessage> remove(String messageId);
  Future<String> read(String conversationId, String throughSequence);
}
/// Uses the existing ApiClient bearer/refresh interceptor; never embeds an access token.
class GatewayHumanDmTransport implements HumanDmTransport {
  const GatewayHumanDmTransport(this.api);
  final ApiClient api;
  Map<String,dynamic> _object(dynamic raw) {
    if (raw is Map<String,dynamic>) return raw;
    if (raw is Map) return raw.cast<String,dynamic>();
    throw const FormatException('Invalid human message response');
  }
  List<T> _items<T>(dynamic raw, T Function(Map<String,dynamic>) parse) {
    if (raw is! List) throw const FormatException('Invalid human message list');
    return raw.map((e) => parse(_object(e))).toList(growable:false);
  }
  @override
  Future<String> open(String otherUserId) async {
    final r=await api.dio.post<dynamic>('/messages',data:{'otherUserId':otherUserId});
    return _object(r.data)['conversationId'] as String;
  }
  @override
  Future<List<HumanDmConversation>> inbox({String? before}) async {
    final r=await api.dio.get<dynamic>('/messages',queryParameters:{'limit':40,if(before!=null)'before':before});
    return _items(_object(r.data)['conversations'],HumanDmConversation.fromJson);
  }
  @override
  Future<HumanDmPage> history(String conversationId,{String? before}) async {
    final r=await api.dio.get<dynamic>('/messages/${Uri.encodeComponent(conversationId)}',
      queryParameters:{'limit':40,if(before!=null)'before':before});
    final body=_object(r.data);
    return HumanDmPage(messages:_items(body['messages'],HumanDmMessage.fromJson),
      nextBefore:body['nextBefore'] as String?);
  }
  @override
  Future<HumanDmMessage> send(String conversationId,String requestId,String body) async {
    final r=await api.dio.post<dynamic>('/messages/${Uri.encodeComponent(conversationId)}',
      data:{'clientRequestId':requestId,'body':body});
    return HumanDmMessage.fromJson(_object(r.data));
  }
  @override
  Future<HumanDmMessage> edit(String messageId,String body) async {
    final r=await api.dio.patch<dynamic>('/messages/items/${Uri.encodeComponent(messageId)}',data:{'body':body});
    return HumanDmMessage.fromJson(_object(r.data));
  }
  @override
  Future<HumanDmMessage> remove(String messageId) async {
    final r=await api.dio.delete<dynamic>('/messages/items/${Uri.encodeComponent(messageId)}');
    return HumanDmMessage.fromJson(_object(r.data));
  }
  @override
  Future<String> read(String conversationId,String throughSequence) async {
    final r=await api.dio.put<dynamic>('/messages/${Uri.encodeComponent(conversationId)}/read',
      data:{'throughSequence':throughSequence});
    return _object(r.data)['lastReadSequence'] as String;
  }
}
