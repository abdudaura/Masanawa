import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/network/api_client.dart';
import '../core/providers.dart';

class CallHistoryItem {
  const CallHistoryItem({
    required this.callId,
    required this.characterId,
    required this.displayName,
    required this.state,
    required this.createdAt,
    this.direction = 'outgoing',
  });
  final String callId;
  final String characterId;
  final String displayName;
  final String state;
  final String direction;
  bool get incoming => direction == 'incoming';
  bool get missed => incoming && (state == 'missed' || state == 'expired');
  final DateTime createdAt;

  factory CallHistoryItem.fromJson(Map<String, dynamic> json) {
    final callId = json['callId'];
    final characterId = json['characterId'];
    final displayName = json['displayName'];
    final state = json['state'];
    final createdAt = json['createdAt'] is String
        ? DateTime.tryParse(json['createdAt'] as String)
        : null;
    if (callId is! String ||
        callId.isEmpty ||
        characterId is! String ||
        characterId.isEmpty ||
        displayName is! String ||
        displayName.isEmpty ||
        !const [
          'connecting',
          'active',
          'ended',
          'expired',
          'ringing',
          'accepted',
          'declined',
          'cancelled',
          'missed',
        ].contains(state) ||
        !const ['outgoing', 'incoming'].contains(json['direction']) ||
        json['kind'] != 'audio' ||
        createdAt == null) {
      throw const FormatException('Invalid Masana call history record');
    }
    return CallHistoryItem(
      callId: callId,
      characterId: characterId,
      displayName: displayName,
      state: state as String,
      createdAt: createdAt,
      direction: json['direction'] as String,
    );
  }
}

class CallHistoryPage {
  const CallHistoryPage({required this.calls, this.nextCursor});
  final List<CallHistoryItem> calls;
  final String? nextCursor;
}

abstract interface class CallHistoryTransport {
  Future<CallHistoryPage> loadPage({String? cursor, String query = '', CancelToken? cancelToken});
}

class GatewayCallHistoryTransport implements CallHistoryTransport {
  const GatewayCallHistoryTransport({required this.api});
  final ApiClient api;
  @override
  Future<CallHistoryPage> loadPage({
    String? cursor,
    String query = '',
    CancelToken? cancelToken,
  }) async {
    final parameters = <String, dynamic>{'limit': 30};
    if (cursor != null) parameters['cursor'] = cursor;
    if (query.isNotEmpty) parameters['q'] = query;
    final response = await api.dio.get<dynamic>(
      '/v1/calls',
      queryParameters: parameters,
      cancelToken: cancelToken,
    );
    final data = response.data;
    if (data is! Map ||
        data['calls'] is! List ||
        (data['nextCursor'] != null && data['nextCursor'] is! String)) {
      throw const FormatException('Invalid call history response');
    }
    final calls = (data['calls'] as List)
        .map((item) {
          if (item is! Map) {
            throw const FormatException('Invalid call history item');
          }
          return CallHistoryItem.fromJson(item.cast<String, dynamic>());
        })
        .toList(growable: false);
    return CallHistoryPage(
      calls: calls,
      nextCursor: data['nextCursor'] as String?,
    );
  }
}

final callHistoryTransportProvider = Provider<CallHistoryTransport>(
  (ref) => GatewayCallHistoryTransport(api: ref.watch(apiClientProvider)),
);
