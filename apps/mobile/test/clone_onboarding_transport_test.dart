import 'dart:convert';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import '../lib/src/agents/clone_onboarding_transport.dart';
import '../lib/src/core/network/api_client.dart';

class RecordingAdapter implements HttpClientAdapter {
  final requests = <RequestOptions>[];
  int status = 200;
  bool malformed = false;
  bool expireOnce = false;
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? stream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    return ResponseBody.fromString(
      jsonEncode(
        malformed
            ? {'setup': null}
            : {
                'setup': null,
                'prompt': 'Start setup',
                'runtimeReadiness': 'not-verified',
              },
      ),
      expireOnce && requests.length == 1 ? 401 : status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  test(
    'uses canonical routes and live account bearer without redirects',
    () async {
      final dio = Dio();
      final adapter = RecordingAdapter();
      dio.httpClientAdapter = adapter;
      final client = ApiClient(dio: dio)..accessToken = 'first-account';
      final transport = HttpCloneOnboardingTransport(
        dio: client.dio,
        baseUrl: 'https://gateway.example/',
      );
      await transport.read();
      expect(
        adapter.requests.last.headers['Authorization'],
        'Bearer first-account',
      );
      client.accessToken = 'second-account';
      await transport.save(
        expectedRevision: null,
        profile: {'displayName': 'Amina'},
      );
      await transport.preview(1);
      await transport.confirm(
        expectedPreviewRevision: 2,
        requestId: 'request_01900000-0000-7000-8000-000000000001',
      );
      await transport.cancel(2);
      expect(adapter.requests.map((request) => request.uri.path).toList(), [
        '/creator/onboarding',
        '/creator/onboarding/profile',
        '/creator/onboarding/preview',
        '/creator/onboarding/confirm',
        '/creator/onboarding/cancel',
      ]);
      expect(adapter.requests.map((request) => request.method).toList(), [
        'GET',
        'PUT',
        'POST',
        'POST',
        'POST',
      ]);
      expect(
        adapter.requests.last.headers['Authorization'],
        'Bearer second-account',
      );
      expect(
        adapter.requests.every((request) => !request.followRedirects),
        true,
      );
      expect(adapter.requests[3].data, {
        'expectedPreviewRevision': 2,
        'requestId': 'request_01900000-0000-7000-8000-000000000001',
      });
    },
  );
  test('session refresh retries the exact confirmation body once', () async {
    final dio = Dio();
    final adapter = RecordingAdapter()..expireOnce = true;
    dio.httpClientAdapter = adapter;
    final client = ApiClient(dio: dio)..accessToken = 'expired';
    var refreshes = 0;
    client.onUnauthorized = () async {
      refreshes++;
      return 'renewed';
    };
    final transport = HttpCloneOnboardingTransport(
      dio: dio,
      baseUrl: 'https://gateway.example',
    );
    await transport.confirm(
      expectedPreviewRevision: 2,
      requestId: 'request_01900000-0000-7000-8000-000000000001',
    );
    expect(refreshes, 1);
    expect(adapter.requests.length, 2);
    expect(adapter.requests.last.headers['Authorization'], 'Bearer renewed');
    expect(adapter.requests.last.data, {
      'expectedPreviewRevision': 2,
      'requestId': 'request_01900000-0000-7000-8000-000000000001',
    });
  });
  test('rejects malformed status and transport failures', () async {
    final dio = Dio();
    final adapter = RecordingAdapter()..malformed = true;
    dio.httpClientAdapter = adapter;
    final transport = HttpCloneOnboardingTransport(
      dio: dio,
      baseUrl: 'https://gateway.example',
    );
    await expectLater(transport.read(), throwsA(isA<ApiException>()));
    adapter.malformed = false;
    adapter.status = 503;
    await expectLater(transport.read(), throwsA(isA<ApiException>()));
    expect(adapter.requests.length, 2);
  });
  test('rejects insecure or credential-bearing Gateway origins', () {
    for (final url in [
      'http://public.example',
      'https://user:password@gateway.example',
      'https://gateway.example?token=value',
      'https://gateway.example#secret',
    ]) {
      expect(
        () => HttpCloneOnboardingTransport(dio: Dio(), baseUrl: url),
        throwsArgumentError,
      );
    }
  });
}
