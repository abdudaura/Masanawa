import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../core/providers.dart';
import '../../talks/talk_safety.dart';

abstract interface class HumanProfileReportTransport {
  Future<String> report(String handle, {
    required TalkSafetyReportReason reason,
    required String requestId,
    required String detail,
    required String reporterUserId,
  });
}

/// Uses the canonical customer-authenticated POST /safety/reports. No separate
/// account identity, moderation store, or client-claimed reporter field.
class GatewayHumanProfileReportTransport implements HumanProfileReportTransport {
  const GatewayHumanProfileReportTransport(this.api);
  final ApiClient api;

  String _handle(String handle) {
    final normalized=handle.trim().toLowerCase().replaceFirst(RegExp(r'^@'), '');
    if (!RegExp(r'^[a-z0-9_][a-z0-9_.-]{1,39}$').hasMatch(normalized)) {
      throw const FormatException('Invalid profile handle');
    }
    return normalized;
  }

  @override
  Future<String> report(String handle, {
    required TalkSafetyReportReason reason,
    required String requestId,
    required String detail,
    required String reporterUserId,
  }) async {
    if(api.accessToken==null || api.accessToken!.isEmpty){
      throw StateError('Sign in required');
    }
    if(requestId.length<12 || requestId.length>256 || detail.length>2000){
      throw const FormatException('Invalid safety report');
    }
    final result=await api.dio.post<dynamic>(
      '/safety/reports',
      data:{
        'targetKind':'profile',
        'targetId':_handle(handle),
        'reason':reason.wire,
        if(detail.trim().isNotEmpty) 'detail':detail.trim(),
        'clientRequestId':requestId,
        'expectedReporterUserId':reporterUserId,
      },
      // An expired original account token must NOT silently replay a
      // sensitive write under another user's subsequently refreshed session.
      options:Options(extra:{'masanawaAuthRetried':true}),
    );
    final data=result.data;
    if(result.statusCode!=202 || data is! Map ||
       data['accepted']!=true || data['reportId'] is! String ||
       (data['reportId'] as String).isEmpty){
      throw const FormatException('Report not confirmed by server');
    }
    return data['reportId'] as String;
  }
}

final humanProfileReportTransportProvider=Provider<HumanProfileReportTransport>(
  (ref)=>GatewayHumanProfileReportTransport(ref.watch(apiClientProvider)),
);
