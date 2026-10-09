import 'dart:async';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/human_media/human_voice_transport.dart';

const _messageId = '00000000-0000-4000-8000-000000000002';
const _endpoint = '/messages/voice/$_messageId';
const _limit = 1536 * 1024;

class _VoiceAdapter implements HttpClientAdapter {
  _VoiceAdapter(this.handler);
  final Future<ResponseBody> Function(RequestOptions options) handler;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) => handler(options);

  @override
  void close({bool force = false}) {}
}

ResponseBody _audio(
  Stream<Uint8List> stream, {
  String contentType = 'audio/ogg',
  String? length,
}) => ResponseBody(
  stream,
  200,
  headers: {
    Headers.contentTypeHeader: [contentType],
    if (length != null) Headers.contentLengthHeader: [length],
  },
);

Uint8List _chunk(int size) => Uint8List.fromList(List<int>.filled(size, 7));

void main() {
  test('reads bounded private audio in chunks with the canonical bearer', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://gateway.test'));
    final client = ApiClient(dio: dio)..accessToken = 'alice-session';
    final expected = _chunk(120);
    dio.httpClientAdapter = _VoiceAdapter((options) async {
      expect(options.uri.path, _endpoint);
      expect(options.method, 'GET');
      expect(options.responseType, ResponseType.stream);
      expect(options.headers['Authorization'], 'Bearer alice-session');
      return _audio(
        Stream.fromIterable([
          Uint8List.sublistView(expected, 0, 40),
          Uint8List.sublistView(expected, 40),
        ]),
        contentType: 'audio/ogg; charset=binary',
        length: '${expected.length}',
      );
    });

    final received = await GatewayHumanVoiceTransport(client).read(_messageId);
    expect(received, expected);
  });

  test('rejects an oversized streamed response and cancels unread chunks', () async {
    var cancelled = false;
    final stream = StreamController<Uint8List>(
      onCancel: () => cancelled = true,
    );
    final dio = Dio(BaseOptions(baseUrl: 'https://gateway.test'));
    final client = ApiClient(dio: dio)..accessToken = 'alice-session';
    dio.httpClientAdapter = _VoiceAdapter((_) async => _audio(stream.stream));
    final pending = GatewayHumanVoiceTransport(client).read(_messageId);
    stream.add(_chunk(_limit));
    stream.add(_chunk(1));
    await expectLater(pending, throwsFormatException);
    expect(cancelled, isTrue);
    await stream.close();
  });

  test('rejects invalid content type before buffering and cancels the stream', () async {
    var cancelled = false;
    final stream = StreamController<Uint8List>(
      onCancel: () => cancelled = true,
    );
    final dio = Dio(BaseOptions(baseUrl: 'https://gateway.test'));
    final client = ApiClient(dio: dio)..accessToken = 'alice-session';
    dio.httpClientAdapter = _VoiceAdapter(
      (_) async => _audio(stream.stream, contentType: 'text/html'),
    );
    await expectLater(
      GatewayHumanVoiceTransport(client).read(_messageId),
      throwsFormatException,
    );
    expect(cancelled, isTrue);
    await stream.close();
  });

  test('rejects oversized declared length before downloading private bytes', () async {
    var cancelled = false;
    final stream = StreamController<Uint8List>(
      onCancel: () => cancelled = true,
    );
    final dio = Dio(BaseOptions(baseUrl: 'https://gateway.test'));
    final client = ApiClient(dio: dio)..accessToken = 'alice-session';
    dio.httpClientAdapter = _VoiceAdapter(
      (_) async => _audio(stream.stream, length: '${_limit + 1}'),
    );
    await expectLater(
      GatewayHumanVoiceTransport(client).read(_messageId),
      throwsFormatException,
    );
    expect(cancelled, isTrue);
    await stream.close();
  });

  test('rejects truncated payloads and inconsistent content-length', () async {
    for (final entry in [
      (length: null, size: 83),
      (length: '105', size: 104),
    ]) {
      final dio = Dio(BaseOptions(baseUrl: 'https://gateway.test'));
      final client = ApiClient(dio: dio)..accessToken = 'alice-session';
      dio.httpClientAdapter = _VoiceAdapter((_) async => _audio(
        Stream.value(_chunk(entry.size)),
        length: entry.length,
      ));
      await expectLater(
        GatewayHumanVoiceTransport(client).read(_messageId),
        throwsFormatException,
      );
    }
  });

  test('sign-out while streaming prevents private media from being returned', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://gateway.test'));
    final client = ApiClient(dio: dio)..accessToken = 'alice-session';
    dio.httpClientAdapter = _VoiceAdapter((_) async => _audio(
      Stream.fromIterable([_chunk(60), _chunk(60)]).map((chunk) {
        client.accessToken = 'bob-session';
        return chunk;
      }),
    ));
    await expectLater(
      GatewayHumanVoiceTransport(client).read(_messageId),
      throwsA(isA<ApiException>()),
    );
  });

  test('DELETE checks the original session after an uncertain server outcome', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://gateway.test'));
    final client = ApiClient(dio: dio)..accessToken = 'alice-session';
    dio.httpClientAdapter = _VoiceAdapter((options) async {
      expect(options.method, 'DELETE');
      expect(options.uri.path, _endpoint);
      expect(options.headers['Authorization'], 'Bearer alice-session');
      client.accessToken = 'bob-session';
      return ResponseBody.fromString(
        '{"status":"deleted"}',
        200,
        headers: {
          Headers.contentTypeHeader: ['application/json'],
        },
      );
    });
    await expectLater(
      GatewayHumanVoiceTransport(client).remove(_messageId),
      throwsA(isA<ApiException>()),
    );
  });

  test('DELETE with an unchanged authenticated session returns normally', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://gateway.test'));
    final client = ApiClient(dio: dio)..accessToken = 'alice-session';
    dio.httpClientAdapter = _VoiceAdapter((_) async => ResponseBody.fromString(
      '{"status":"deleted"}',
      200,
      headers: {Headers.contentTypeHeader: ['application/json']},
    ));
    await GatewayHumanVoiceTransport(client).remove(_messageId);
  });
}
