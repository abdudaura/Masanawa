import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/network/api_client.dart';
import '../core/providers.dart';
import '../talks/talk_safety.dart';

/// Human profile safety is attached to a customer session on ApiClient.
/// The Gateway resolves the profile handle to the canonical tenant-scoped user.
abstract interface class HumanProfileSafetyTransport {
  Future<TalkSafetyPreference> load(String handle);
  Future<TalkSafetyPreference> update({
    required String handle,
    required bool blocked,
    required bool muted,
  });
}

class GatewayHumanProfileSafetyTransport implements HumanProfileSafetyTransport {
  const GatewayHumanProfileSafetyTransport(this.api);
  final ApiClient api;

  String _path(String handle) {
    final normalized = handle.trim().toLowerCase().replaceFirst(RegExp(r'^@'), '');
    if (!RegExp(r'^[a-z0-9_][a-z0-9_.-]{1,39}$').hasMatch(normalized)) {
      throw const FormatException('Invalid public profile handle');
    }
    return '/safety/profiles/' + Uri.encodeComponent(normalized) + '/preference';
  }

  TalkSafetyPreference _parse(Object? data) {
    if (data is! Map || data['blocked'] is! bool || data['muted'] is! bool) {
      throw const FormatException('Invalid authenticated safety preference');
    }
    return TalkSafetyPreference(
      blocked: data['blocked'] as bool,
      muted: data['muted'] as bool,
    );
  }

  @override
  Future<TalkSafetyPreference> load(String handle) async {
    final response = await api.dio.get<dynamic>(_path(handle));
    return _parse(response.data);
  }

  @override
  Future<TalkSafetyPreference> update({
    required String handle,
    required bool blocked,
    required bool muted,
  }) async {
    final response = await api.dio.put<dynamic>(
      _path(handle),
      data: <String, bool>{'blocked': blocked, 'muted': muted},
    );
    return _parse(response.data);
  }
}

final humanProfileSafetyTransportProvider = Provider<HumanProfileSafetyTransport>(
  (ref) => GatewayHumanProfileSafetyTransport(ref.watch(apiClientProvider)),
);
