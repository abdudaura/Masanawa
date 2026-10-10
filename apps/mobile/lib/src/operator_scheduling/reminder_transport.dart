import 'dart:math';
import 'package:dio/dio.dart';

import '../core/network/api_client.dart';
import 'reminder_models.dart';

abstract class ReminderTransport {
  Future<List<ScheduledReminder>> list();
  Future<ScheduledReminder> create({
    required String requestId,
    required Map<String, dynamic> spec,
  });
  Future<ScheduledReminder> change({
    required String id,
    required int revision,
    required String action,
  });
}

class GatewayReminderTransport implements ReminderTransport {
  GatewayReminderTransport(this.api);
  final ApiClient api;

  void _requireSignedIn() {
    if (api.accessToken == null || api.accessToken!.isEmpty) {
      throw const ApiException('Sign in to manage reminders', code: 'SIGNED_OUT');
    }
  }

  Map<String, dynamic> _json(dynamic value) {
    if (value is! Map) throw const FormatException('Invalid reminders response');
    return Map<String, dynamic>.from(value);
  }

  @override
  Future<List<ScheduledReminder>> list() async {
    _requireSignedIn();
    final response = await api.dio.get<dynamic>('/v1/operator/schedules');
    final rows = _json(response.data)['schedules'];
    if (rows is! List || rows.length > 100) {
      throw const FormatException('Invalid reminders list');
    }
    return List.unmodifiable(rows.map((e) =>
        ScheduledReminder.fromJson(_json(e))));
  }

  @override
  Future<ScheduledReminder> create({
    required String requestId,
    required Map<String, dynamic> spec,
  }) async {
    _requireSignedIn();
    final response = await api.dio.post<dynamic>(
      '/v1/operator/schedules',
      data: {'requestId': requestId, 'spec': spec},
    );
    return ScheduledReminder.fromJson(_json(_json(response.data)['schedule']));
  }

  @override
  Future<ScheduledReminder> change({
    required String id,
    required int revision,
    required String action,
  }) async {
    _requireSignedIn();
    final response = await api.dio.post<dynamic>(
      '/v1/operator/schedules/${Uri.encodeComponent(id)}/actions',
      data: {'revision': revision, 'action': action},
    );
    return ScheduledReminder.fromJson(_json(_json(response.data)['schedule']));
  }
}

/// The caller retains this request ID for an uncertain/retry response;
/// changing the submitted spec creates a NEW ID.
class ReminderCreateRequest {
  ReminderCreateRequest({required this.requestId, required this.specKey});
  final String requestId;
  final String specKey;

  static ReminderCreateRequest generate(Map<String, dynamic> spec) {
    final secure = Random.secure();
    return ReminderCreateRequest(
      requestId: secureReminderRequestId(
        List<int>.generate(16, (_) => secure.nextInt(256)),
      ),
      specKey: canonicalReminderSpec(spec),
    );
  }
}
