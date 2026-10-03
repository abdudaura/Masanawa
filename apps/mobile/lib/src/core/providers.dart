import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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
