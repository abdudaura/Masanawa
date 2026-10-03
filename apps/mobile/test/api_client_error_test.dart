import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/network/api_client.dart';

DioException _error(int status, Map<String, dynamic> body,
    {DioExceptionType type = DioExceptionType.badResponse}) {
  final ro = RequestOptions(path: '/auth/otp');
  return DioException(
    requestOptions: ro,
    type: type,
    response: Response<Map<String, dynamic>>(
      requestOptions: ro,
      statusCode: status,
      data: body,
    ),
  );
}

void main() {
  group('mapDioError professional messages', () {
    test('VALIDATION_FAILED with an email issue reads as prose', () {
      final e = mapDioError(_error(400, {
        'code': 'VALIDATION_FAILED',
        'message': 'Invalid request payload.',
        'issues': [
          {
            'path': ['email'],
            'message': 'Invalid email',
          },
        ],
      }));
      expect(
        e.message,
        'That email address doesn\'t look right. Please check it and try again.',
      );
      expect(e.code, 'VALIDATION_FAILED');
    });

    test('VALIDATION_FAILED without issues uses generic friendly copy', () {
      final e = mapDioError(_error(400, {
        'code': 'VALIDATION_FAILED',
        'message': 'Invalid request payload.',
      }));
      expect(e.message, 'Please check the details you entered and try again.');
    });

    test('OTP_INVALID maps to a friendly code message', () {
      final e = mapDioError(_error(401, {
        'code': 'OTP_INVALID',
        'message': 'That code is incorrect or has expired. Please try again.',
      }));
      expect(e.message, 'That code is incorrect or has expired. Please try again.');
    });

    test('legacy envelope (HTTP_401 + UNAUTHORIZED message) maps to session copy', () {
      final e = mapDioError(_error(401, {
        'code': 'HTTP_401',
        'message': 'UNAUTHORIZED',
      }));
      expect(e.message, 'Your session has expired. Please sign in again.');
      expect(e.code, 'UNAUTHORIZED');
    });

    test('legacy OTP lockout maps to a wait-and-retry message', () {
      final e = mapDioError(_error(429, {
        'code': 'HTTP_429',
        'message': 'OTP_LOCKED',
      }));
      expect(
        e.message,
        'Too many incorrect attempts. Please wait a few minutes and try again.',
      );
      expect(e.code, 'OTP_LOCKED');
    });

    test('nested error envelope preserves code + status and maps copy', () {
      final e = mapDioError(_error(403, {
        'error': {'code': 'NOT_A_MEMBER', 'message': 'Join the community first.'}
      }));
      expect(e.code, 'NOT_A_MEMBER');
      expect(e.statusCode, 403);
      expect(e.message, 'You\'re not a member of this community yet.');
    });

    test('unmapped 500 uses a generic server message', () {
      final e = mapDioError(_error(500, {
        'code': 'HTTP_500',
        'message': 'Internal server error',
      }));
      expect(e.message, 'Something went wrong on our end. Please try again shortly.');
    });

    test('connection errors are friendly', () {
      final ro = RequestOptions(path: '/feed');
      final e = mapDioError(DioException(
        requestOptions: ro,
        type: DioExceptionType.connectionError,
      ));
      expect(e.message, 'Could not reach UNigeria. Check your connection.');
    });
  });
}
