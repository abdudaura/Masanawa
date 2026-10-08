import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import '../../core/network/api_client.dart';
import '../../core/providers.dart';
import '../../talks/talk_safety.dart';

class HumanProfileSafetyPreference {
  const HumanProfileSafetyPreference({required this.blocked, required this.muted});
  final bool blocked;
  final bool muted;
  factory HumanProfileSafetyPreference.parse(dynamic data) {
    if (data is! Map || data['blocked'] is! bool || data['muted'] is! bool) {
      throw const FormatException('Invalid safety response');
    }
    return HumanProfileSafetyPreference(
      blocked: data['blocked'] as bool, muted: data['muted'] as bool,
    );
  }
}

abstract interface class HumanProfileSafetyTransport {
  Future<HumanProfileSafetyPreference> read(String handle);
  Future<HumanProfileSafetyPreference> set(String handle, {
    required bool blocked, required bool muted,
  });
  Future<String> report(String handle, {
    required TalkSafetyReportReason reason,
    required String requestId,
    required String detail,
  });
}

class GatewayHumanProfileSafetyTransport implements HumanProfileSafetyTransport {
  const GatewayHumanProfileSafetyTransport(this.api);
  final ApiClient api;

  String _handle(String handle) {
    final normalized=handle.trim().toLowerCase().replaceFirst(RegExp(r'^@'), '');
    if (!RegExp(r'^[a-z0-9_][a-z0-9_.-]{1,39}$').hasMatch(normalized)) {
      throw const FormatException('Invalid profile handle');
    }
    return normalized;
  }

  void _signedIn() {
    if (api.accessToken == null || api.accessToken!.isEmpty) {
      throw StateError('Sign in required');
    }
  }

  @override
  Future<HumanProfileSafetyPreference> read(String handle) async {
    _signedIn();
    final result=await api.dio.get<dynamic>(
      '/safety/profiles/${Uri.encodeComponent(_handle(handle))}/preference',
    );
    return HumanProfileSafetyPreference.parse(result.data);
  }

  @override
  Future<HumanProfileSafetyPreference> set(String handle, {
    required bool blocked, required bool muted,
  }) async {
    _signedIn();
    final result=await api.dio.put<dynamic>(
      '/safety/profiles/${Uri.encodeComponent(_handle(handle))}/preference',
      data:{'blocked':blocked,'muted':muted},
      options:Options(extra:{'masanawaAuthRetried':true}),
    );
    return HumanProfileSafetyPreference.parse(result.data);
  }

  @override
  Future<String> report(String handle, {
    required TalkSafetyReportReason reason,
    required String requestId,
    required String detail,
  }) async {
    _signedIn();
    if(requestId.length < 12 || requestId.length>256 || detail.length>2000){
      throw const FormatException('Invalid safety report');
    }
    final result=await api.dio.post<dynamic>('/safety/reports',data:{
      'targetKind':'profile',
      'targetId':_handle(handle),
      'reason':reason.wire,
      if(detail.trim().isNotEmpty) 'detail':detail.trim(),
      'clientRequestId':requestId,
    },options:Options(extra:{'masanawaAuthRetried':true}));
    final data=result.data;
    if(result.statusCode!=202 || data is! Map ||
       data['accepted']!=true || data['reportId'] is! String ||
       (data['reportId'] as String).isEmpty){
      throw const FormatException('Report not confirmed by server');
    }
    return data['reportId'] as String;
  }
}

final humanProfileSafetyTransportProvider = Provider<HumanProfileSafetyTransport>(
  (ref)=>GatewayHumanProfileSafetyTransport(ref.watch(apiClientProvider)),
);
