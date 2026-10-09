import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/twin_training/twin_training_entry.dart';

void main() {
  testWidgets('account scope replacement fetches with the new ApiClient bearer', (tester) async {
    final dio = Dio(BaseOptions(baseUrl: 'https://api.masanawa.example'));
    final api = ApiClient(dio: dio)..accessToken = 'token-account-a';
    final observed = <String>[];

    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        observed.add(options.headers['Authorization']?.toString() ?? 'missing');
        handler.resolve(Response<Map<String, dynamic>>(
          requestOptions: options,
          statusCode: 200,
          data: const {
            'setup': null,
            'supportAgents': <dynamic>[],
            'defaultSupportAgentId': null,
            'nextStep': 'name',
            'prompt': 'What name should your personal clone use?',
            'runtimeReadiness': 'not-verified',
          },
        ));
      },
    ));

    await tester.pumpWidget(MaterialApp(
      home: TwinTrainingEntry(api: api, accountScopeKey: 'account-a:epoch-1'),
    ));
    await tester.pumpAndSettle();
    expect(observed, ['Bearer token-account-a']);
    expect(find.text('What name should your AI twin use?'), findsOneWidget);

    api.accessToken = 'token-account-b';
    await tester.pumpWidget(MaterialApp(
      home: TwinTrainingEntry(api: api, accountScopeKey: 'account-b:epoch-2'),
    ));
    await tester.pumpAndSettle();
    expect(observed, ['Bearer token-account-a', 'Bearer token-account-b']);
    expect(find.text('What name should your AI twin use?'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
