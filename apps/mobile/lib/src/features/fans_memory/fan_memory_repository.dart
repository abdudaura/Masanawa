import 'package:dio/dio.dart';

/// Uses the app's already-authenticated, account-fenced Dio transport.
class FanMemoryRepository {
  final Dio client;
  FanMemoryRepository(this.client);

  Future<Map<String, dynamic>> load(String characterId) async {
    final res = await client.get<Map<String, dynamic>>(
      '/v1/me/memory', queryParameters: {'characterId': characterId});
    return res.data ?? <String, dynamic>{};
  }

  Future<Map<String, dynamic>> consent(
      String characterId, bool enabled, int revision) async {
    final res = await client.patch<Map<String, dynamic>>('/v1/me/memory',
      data: {'characterId': characterId, 'enabled': enabled, 'expectedRevision': revision});
    return res.data ?? <String, dynamic>{};
  }

  Future<Map<String, dynamic>> erase(
      String characterId, String? recordId, String idempotencyKey) async {
    final res = await client.delete<Map<String, dynamic>>('/v1/me/memory',
      data: {'characterId': characterId, 'recordId': recordId},
      options: Options(headers: {'Idempotency-Key': idempotencyKey}));
    return res.data ?? <String, dynamic>{};
  }
}
