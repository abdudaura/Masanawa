import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../agents/agent_session.dart';
import '../agents/masanawa_transport.dart';
import '../core/network/api_client.dart';

/// Dio with sane defaults for the UNigeria API. Base URL applied in ApiClient.
final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(
    BaseOptions(
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 15),
      sendTimeout: const Duration(seconds: 10),
      validateStatus: (status) => status != null && status >= 200 && status < 300,
    ),
  );
  return dio;
});

/// Typed API client (auth + AI chat).
final apiClientProvider = Provider<ApiClient>((ref) {
  final client = ApiClient(dio: ref.watch(dioProvider));
  return client;
});

/// Agent runtime transport. Live gateway when the builder pointed at one
/// (`AGENT_RUNTIME_ENABLED=true` + `AGENT_BASE_URL=…`); otherwise the honest
/// preview transport. Callers always fall back on transport errors.
final agentTransportProvider = Provider<AgentTransport>((ref) {
  if (isAgentRuntimeConfigured) {
    return MasanawaAgentTransport(
      dio: ref.watch(dioProvider),
      baseUrl: kAgentBaseUrl,
      readAccessToken: () => ref.read(apiClientProvider).accessToken,
    );
  }
  return PreviewAgentTransport(
    sendPreview: (message, masana) =>
        ref.read(apiClientProvider).aiChat(message, masana: masana),
  );
});
