import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/features/gwani/cases_api.dart';
import 'package:masanawa/src/features/gwani/cases_screen.dart';

void main() {
  test('J13 appeal command always sends the idempotency key', () async {
    final requests = <Map<String, dynamic>>[];
    final dio = Dio(BaseOptions(baseUrl: 'https://example.invalid'));
    dio.interceptors.add(InterceptorsWrapper(onRequest: (options, handler) {
      requests.add(Map<String, dynamic>.from(options.data as Map));
      handler.resolve(Response(requestOptions: options, statusCode: 200,
          data: {'accepted': true}));
    }));
    final api = GwaniCasesApi(dio);
    await api.appeal('case_1', 'please reconsider',
        clientRequestId: 'appeal-fixed-key');
    await api.appeal('case_1', 'please reconsider',
        clientRequestId: 'appeal-fixed-key');
    expect(requests, hasLength(2));
    expect(requests.first['clientRequestId'], 'appeal-fixed-key');
    expect(requests[1], requests.first);
  });

  testWidgets('J13 lost appeal reply retries the same key in Flutter', (tester) async {
    final sentKeys = <String>[];
    var attempts = 0;
    final dio = Dio(BaseOptions(baseUrl: 'https://example.invalid'));
    dio.interceptors.add(InterceptorsWrapper(onRequest: (options, handler) {
      if (options.method == 'POST') {
        final payload = Map<String, dynamic>.from(options.data as Map);
        sentKeys.add(payload['clientRequestId'] as String);
        attempts++;
        if (attempts == 1) {
          handler.reject(DioException(requestOptions: options,
              type: DioExceptionType.connectionTimeout));
        } else {
          handler.resolve(Response(requestOptions: options, statusCode: 200,
              data: {'accepted': true}));
        }
        return;
      }
      if (options.path.endsWith('/case_1')) {
        handler.resolve(Response(requestOptions: options, statusCode: 200,
            data: <String, dynamic>{
              'caseId': 'case_1', 'state': attempts >= 2 ? 'appealed' : 'dismissed',
              'details': 'reported', 'events': <dynamic>[],
            }));
      } else {
        handler.resolve(Response(requestOptions: options, statusCode: 200,
            data: <String, dynamic>{'cases': [
              {'caseId':'case_1','category':'spam','state':'dismissed'}
            ]}));
      }
    }));
    await tester.pumpWidget(MaterialApp(
        home: GwaniCasesScreen(api: GwaniCasesApi(dio))));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('spam').last);
    await tester.tap(find.text('spam').last);
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).last, 'reconsider');
    await tester.tap(find.text('Submit appeal'));
    await tester.pumpAndSettle();
    expect(sentKeys, hasLength(1));
    await tester.tap(find.text('Submit appeal'));
    await tester.pumpAndSettle();
    expect(sentKeys, hasLength(2));
    expect(sentKeys[0], isNotEmpty);
    expect(sentKeys[1], sentKeys[0]);
  });
}
