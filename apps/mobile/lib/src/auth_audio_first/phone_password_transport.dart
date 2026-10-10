import 'package:dio/dio.dart';

import '../core/api/models.dart';
import '../core/network/api_client.dart';

/// Anonymous auth transport. Deliberately separate from the session's Dio
/// interceptor: a 401 here must NOT rotate an unrelated signed-in account.
class PhonePasswordTransport {
  PhonePasswordTransport({Dio? dio})
      : _dio = dio ?? Dio(BaseOptions(
          baseUrl: kApiBaseUrl,
          connectTimeout: const Duration(seconds: 10),
          receiveTimeout: const Duration(seconds: 15),
          sendTimeout: const Duration(seconds: 10),
        ));

  final Dio _dio;

  Future<AuthTokens> register({
    required String phone,
    required String password,
    required String name,
  }) => _submit('/auth/phone/register', {
        'phone': phone,
        'password': password,
        'name': name,
      });

  Future<AuthTokens> login({
    required String phone,
    required String password,
  }) => _submit('/auth/phone/login', {
        'phone': phone,
        'password': password,
      });

  Future<AuthTokens> _submit(String path, Map<String, String> body) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        path,
        data: body,
        options: Options(headers: const {'cache-control': 'no-store'}),
      );
      final data = response.data;
      if (data == null) {
        throw const ApiException('Authentication response is unavailable.',
            code: 'AUTH_UNAVAILABLE');
      }
      return AuthTokens.fromJson(data);
    } on DioException catch (error) {
      throw mapDioError(error);
    } on ApiException {
      rethrow;
    } catch (_) {
      throw const ApiException('Authentication response is unavailable.',
          code: 'AUTH_UNAVAILABLE');
    }
  }
}
