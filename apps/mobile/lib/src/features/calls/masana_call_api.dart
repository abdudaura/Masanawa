import 'dart:math';
import 'package:dio/dio.dart';

class MasanaCallTicket {
  const MasanaCallTicket({
    required this.callId, required this.url, required this.token,
    required this.expiresAt,
  });
  final String callId, url, token;
  final DateTime expiresAt;
  factory MasanaCallTicket.fromJson(Map<String,dynamic> data) {
    final id=data['callId'], url=data['url'], token=data['token'];
    final expiry=DateTime.tryParse(data['expiresAt']?.toString() ?? '');
    if (id is! String || !RegExp(r'^call_[a-f0-9-]{36}$').hasMatch(id) ||
        url is! String || !url.startsWith('wss://') ||
        token is! String || token.isEmpty || expiry==null) {
      throw const FormatException('Call provider response invalid');
    }
    return MasanaCallTicket(callId:id,url:url,token:token,expiresAt:expiry);
  }
}
class MasanaCallApi {
  const MasanaCallApi(this.dio);
  final Dio dio;
  static String makeRequestId() {
    final random=Random.secure();
    final bytes=List<int>.generate(16,(_)=>random.nextInt(256));
    return 'request_${bytes.map((b)=>b.toRadixString(16).padLeft(2,'0')).join()}';
  }
  Future<MasanaCallTicket> start(String characterId,String requestId) async {
    final response=await dio.post<Map<String,dynamic>>('/v1/calls',
      data:{'characterId':characterId,'requestId':requestId});
    final data=response.data;
    if(data==null) throw const FormatException('Missing call response');
    return MasanaCallTicket.fromJson(data);
  }
  Future<void> connected(String callId) async {
    await dio.post<void>('/v1/calls/${Uri.encodeComponent(callId)}/connected');
  }
  Future<void> end(String callId) async {
    await dio.post<void>('/v1/calls/${Uri.encodeComponent(callId)}/end');
  }
  Future<String> state(String callId) async {
    final response=await dio.get<Map<String,dynamic>>('/v1/calls/${Uri.encodeComponent(callId)}');
    return (response.data?['state'] as String?) ?? 'unknown';
  }
}
