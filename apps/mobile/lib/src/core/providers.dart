import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../agents/agent_directory.dart';
import '../agents/creator_clone.dart';
import '../agents/creator_economy.dart';
import '../agents/creator_skills.dart';
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
  return MasanawaAgentDirectoryTransport(
    dio: ref.watch(dioProvider),
    baseUrl: kAgentBaseUrl,
    readAccessToken: () => ref.read(apiClientProvider).accessToken,
  );
});

final agentTransportProvider = Provider<AgentTransport>((ref) {
  return MasanawaAgentTransport(
    dio: ref.watch(dioProvider),
    baseUrl: kAgentBaseUrl,
    readAccessToken: () => ref.read(apiClientProvider).accessToken,
  );
});

final creatorCloneTransportProvider = Provider<CreatorCloneTransport>((ref) {
  return MasanawaCreatorCloneTransport(
    dio: ref.watch(dioProvider),
    baseUrl: kAgentBaseUrl,
    readAccessToken: () => ref.read(apiClientProvider).accessToken,
  );
});

final creatorEconomyTransportProvider = Provider<CreatorEconomyTransport>((ref) {
  return MasanawaCreatorEconomyTransport(
    dio: ref.watch(dioProvider),
    baseUrl: kAgentBaseUrl,
    readAccessToken: () => ref.read(apiClientProvider).accessToken,
  );
});

final creatorSkillTransportProvider = Provider<CreatorSkillTransport>((ref) {
  return MasanawaCreatorSkillTransport(
    dio: ref.watch(dioProvider),
    baseUrl: kAgentBaseUrl,
    readAccessToken: () => ref.read(apiClientProvider).accessToken,
  );
});
