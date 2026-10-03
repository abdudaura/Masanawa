import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../agents/agent_directory.dart';
import '../agents/agent_session.dart';
import '../agents/masanawa_transport.dart';
import '../core/network/api_client.dart';

final dioProvider = Provider<Dio>((ref) {
  return Dio(
    BaseOptions(
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 15),
      sendTimeout: const Duration(seconds: 10),
      validateStatus: (status) =>
          status != null && status >= 200 && status < 300,
    ),
  );
});

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(dio: ref.watch(dioProvider));
});

final agentDirectoryTransportProvider = Provider<AgentDirectoryTransport>((ref) {
  if (!isAgentRuntimeConfigured) return const EmptyAgentDirectoryTransport();
  return MasanawaAgentDirectoryTransport(
    dio: ref.watch(dioProvider),
    baseUrl: kAgentBaseUrl,
    readAccessToken: () => ref.read(apiClientProvider).accessToken,
  );
});

final agentTransportProvider = Provider<AgentTransport>((ref) {
  if (isAgentRuntimeConfigured) {
    return MasanawaAgentTransport(
      dio: ref.watch(dioProvider),
      baseUrl: kAgentBaseUrl,
      readAccessToken: () => ref.read(apiClientProvider).accessToken,
    );
  }
  return PreviewAgentTransport(
    sendPreview: (message, characterId) =>
        ref.read(apiClientProvider).aiChat(message, masana: characterId),
  );
});
