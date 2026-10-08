import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/core/api/account_deletion_models.dart';

void main() {
  final projection = <String, dynamic>{
    'requestId': '19d875b1-0f5d-48ec-b8ee-01e56eac742b',
    'phase': 'requested',
    'revision': 1,
    'createdAt': '2026-10-08T01:00:00.000Z',
    'updatedAt': '2026-10-08T01:00:00.000Z',
  };

  test('rejects malformed deletion response instead of claiming completion', () {
    expect(
      () => AccountDeletionRequestView.fromJson({
        ...projection, 'phase': 'deleted_instantly',
      }),
      throwsFormatException,
    );
    expect(
      () => AccountDeletionRequestView.fromJson({
        ...projection, 'revision': 0,
      }),
      throwsFormatException,
    );
    final verified = AccountDeletionRequestView.fromJson({
      ...projection, 'phase': 'identity-verified',
    });
    expect(verified.finished, isFalse);
    expect(verified.needsVerification, isFalse);
  });

  test('requests, verifies and reads authenticated canonical status', () async {
    final paths = <String>[];
    final dio = Dio(BaseOptions(baseUrl: 'https://localhost.invalid'));
    final api = ApiClient(dio: dio);
    api.accessToken = 'session-token';
    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (request, handler) {
        expect(request.headers['Authorization'], 'Bearer session-token');
        paths.add(request.path);
        if (request.path.endsWith('/verify')) {
          expect(request.data, {'code': '123456'});
        } else if (request.path.endsWith('/request')) {
          expect(request.data, isEmpty);
        }
        handler.resolve(Response<Map<String, dynamic>>(
          requestOptions: request,
          statusCode: 200,
          data: request.path.endsWith('/request')
              ? {
                  'request': projection,
                  'verificationSent': true,
                  'verificationChannel': 'email',
                }
              : request.path.endsWith('/verify')
                  ? {
                      'request': {...projection, 'phase': 'identity-verified', 'revision': 2},
                    }
                  : {'request': projection},
        ));
      },
    ));
    final read = await api.accountDeletionStatus();
    expect(read?.phase, 'requested');
    final sent = await api.requestAccountDeletion();
    expect(sent.verificationSent, isTrue);
    expect(sent.verificationChannel, 'email');
    final verified = await api.verifyAccountDeletion('123456');
    expect(verified.finished, isFalse);
    expect(verified.phase, 'identity-verified');
    expect(paths, [
      '/account/deletion',
      '/account/deletion/request',
      '/account/deletion/verify',
    ]);
  });
}
