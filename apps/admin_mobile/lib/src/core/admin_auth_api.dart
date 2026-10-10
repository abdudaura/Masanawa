import 'package:dio/dio.dart';

const adminAuthBaseUrl = String.fromEnvironment('ADMIN_AUTH_BASE_URL');

String requireAdminAuthBaseUrl() {
  final value = adminAuthBaseUrl.trim();
  if (value.isEmpty) {
    throw const AdminAuthException(
      'ADMIN_AUTH_NOT_CONFIGURED',
      'ADMIN_AUTH_BASE_URL is not configured for the Masanawa Gateway.',
    );
  }
  return value;
}

class AdminAuthException implements Exception {
  const AdminAuthException(this.code, this.message, [this.statusCode]);
  final String code;
  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}

class AdminAuthTokens {
  const AdminAuthTokens({
    required this.accessToken,
    required this.refreshToken,
    required this.accessExpiresIn,
    required this.userId,
    required this.name,
  });

  final String accessToken;
  final String refreshToken;
  final int accessExpiresIn;
  final String userId;
  final String name;

  factory AdminAuthTokens.fromJson(Map<String, dynamic> json) {
    final user = Map<String, dynamic>.from(json['user'] as Map);
    return AdminAuthTokens(
      accessToken: json['accessToken'] as String,
      refreshToken: json['refreshToken'] as String,
      accessExpiresIn: json['accessExpiresIn'] as int? ?? 0,
      userId: user['id'] as String,
      name: user['name'] as String? ?? '',
    );
  }
}

class AdminAuthApi {
  AdminAuthApi({Dio? dio})
      : _dio = dio ??
            Dio(
              BaseOptions(
                baseUrl: adminAuthBaseUrl.trim(),
                connectTimeout: const Duration(seconds: 10),
                receiveTimeout: const Duration(seconds: 20),
                headers: {'Accept': 'application/json'},
              ),
            );

  final Dio _dio;

  void _ensureConfigured() {
    requireAdminAuthBaseUrl();
  }

  Map<String, dynamic> _identity(String identifier) {
    final value = identifier.trim();
    if (value.contains('@')) return {'email': value.toLowerCase()};
    return {'phone': value};
  }

  Future<int> sendOtp(String identifier) async {
    _ensureConfigured();
    try {
      final response = await _dio.post<dynamic>(
        '/auth/otp',
        data: _identity(identifier),
      );
      final data = Map<String, dynamic>.from(response.data as Map);
      return data['resendInSeconds'] as int? ?? 60;
    } on DioException catch (error) {
      throw _exception(error, 'Unable to send the sign-in code.');
    }
  }

  Future<AdminAuthTokens> verifyOtp({
    required String identifier,
    required String code,
    String? name,
  }) async {
    _ensureConfigured();
    try {
      final response = await _dio.post<dynamic>(
        '/auth/verify',
        data: {
          ..._identity(identifier),
          'code': code.trim(),
          if (name != null && name.trim().isNotEmpty) 'name': name.trim(),
        },
      );
      return AdminAuthTokens.fromJson(
        Map<String, dynamic>.from(response.data as Map),
      );
    } on DioException catch (error) {
      throw _exception(error, 'Unable to verify the sign-in code.');
    }
  }

  Future<AdminAuthTokens> refresh(String refreshToken) async {
    _ensureConfigured();
    try {
      final response = await _dio.post<dynamic>(
        '/auth/refresh',
        data: {'refreshToken': refreshToken},
      );
      return AdminAuthTokens.fromJson(
        Map<String, dynamic>.from(response.data as Map),
      );
    } on DioException catch (error) {
      throw _exception(error, 'Your admin session has expired.');
    }
  }

  Future<void> logout(String accessToken) async {
    _ensureConfigured();
    try {
      await _dio.post<dynamic>(
        '/auth/logout',
        options: Options(
          headers: {'Authorization': 'Bearer $accessToken'},
        ),
      );
    } on DioException {
      // Local sign-out must still succeed if the server is unavailable.
    }
  }

  AdminAuthException _exception(DioException error, String fallback) {
    final status = error.response?.statusCode;
    String? code;
    final data = error.response?.data;
    if (data is Map) {
      code = data['code']?.toString();
    }
    final normalized = code ?? 'AUTH_REQUEST_FAILED';
    final message = switch (normalized) {
      'NAME_REQUIRED_ON_SIGNUP' =>
        'This account is new. Enter your name to finish creating it.',
      'AUTH_INVALID_CODE' || 'OTP_INVALID' =>
        'That sign-in code is not valid.',
      'AUTH_EXPIRED_CODE' || 'OTP_EXPIRED' =>
        'That sign-in code has expired. Request a new one.',
      _ when status == 429 => 'Too many attempts. Try again shortly.',
      _ => fallback,
    };
    return AdminAuthException(normalized, message, status);
  }
}
