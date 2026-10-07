import 'package:dio/dio.dart';

import '../core/network/api_client.dart';
import 'clone_onboarding.dart';

/// Reuses ApiClient's current bearer and refresh interceptor. Never stores credentials.
class HttpCloneOnboardingTransport implements CloneOnboardingTransport {
  HttpCloneOnboardingTransport({required this.dio, required String baseUrl})
    : baseUrl = baseUrl.replaceFirst(RegExp(r'/+$'), '') {
    final uri = Uri.tryParse(this.baseUrl);
    if (uri == null ||
        !uri.hasAuthority ||
        uri.userInfo.isNotEmpty ||
        uri.hasQuery ||
        uri.hasFragment ||
        (uri.scheme != 'https' &&
            !(uri.scheme == 'http' &&
                {'localhost', '127.0.0.1', '::1'}.contains(uri.host))))
      throw ArgumentError('Invalid clone setup Gateway');
  }
  final Dio dio;
  final String baseUrl;

  Future<CloneOnboardingView> _request(
    String method,
    String path, [
    Map<String, dynamic>? body,
  ]) async {
    try {
      final response = await dio.request<Map<String, dynamic>>(
        '$baseUrl$path',
        data: body,
        options: Options(
          method: method,
          followRedirects: false,
          receiveTimeout: const Duration(seconds: 75),
        ),
      );
      final json = response.data;
      if (json == null) throw const FormatException('Missing setup response');
      return CloneOnboardingView.fromJson(json);
    } on DioException catch (error) {
      throw mapDioError(error);
    } on FormatException {
      throw const ApiException(
        'Setup status could not be read. Reload before continuing.',
      );
    }
  }

  @override
  Future<CloneOnboardingView> read() => _request('GET', '/creator/onboarding');
  @override
  Future<CloneOnboardingView> save({
    required int? expectedRevision,
    required Map<String, dynamic> profile,
  }) => _request('PUT', '/creator/onboarding/profile', {
    'expectedRevision': expectedRevision,
    'profile': profile,
  });
  @override
  Future<CloneOnboardingView> preview(int expectedRevision) => _request(
    'POST',
    '/creator/onboarding/preview',
    {'expectedRevision': expectedRevision},
  );
  @override
  Future<CloneOnboardingView> confirm({
    required int expectedPreviewRevision,
    required String requestId,
  }) => _request('POST', '/creator/onboarding/confirm', {
    'expectedPreviewRevision': expectedPreviewRevision,
    'requestId': requestId,
  });
  @override
  Future<CloneOnboardingView> cancel(int expectedRevision) => _request(
    'POST',
    '/creator/onboarding/cancel',
    {'expectedRevision': expectedRevision},
  );
}
