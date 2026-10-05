import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/commerce/wallet_http_transport.dart';
import 'package:masanawa/src/core/network/api_client.dart';

class _Adapter implements HttpClientAdapter {
  _Adapter(this.handler);

  final Future<ResponseBody> Function(RequestOptions options) handler;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<List<int>>? requestStream,
    Future<void>? cancelFuture,
  ) =>
      handler(options);

  @override
  void close({bool force = false}) {}
}

void main() {
  test('Wallet transfer posts one server idempotency request id', () async {
    Map<String, dynamic>? seen;
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((options) async {
      seen = (options.data as Map).cast<String, dynamic>();
      return ResponseBody.fromString(
        '{"transferId":"transfer-1","recipientUserId":"user-b","amountCredits":250,"completedAt":"2026-10-05T10:00:00Z"}',
        200,
        headers: {
          Headers.contentTypeHeader: ['application/json'],
        },
      );
    });

    final transport = GatewayWalletTransport(
      api: ApiClient(dio: dio),
      now: () => DateTime.utc(2026, 10, 5, 10),
    );

    final receipt = await transport.sendCredits(
      recipient: 'friend@example.com',
      amountCredits: 250,
    );

    expect(receipt.transferId, 'transfer-1');
    expect(seen?['recipient'], 'friend@example.com');
    expect(seen?['amountCredits'], 250);
    expect(
      (seen?['requestId'] as String).startsWith('wallet-transfer-'),
      isTrue,
    );
    expect(seen?.containsKey('senderUserId'), isFalse);
  });

  test('Gift posts only twin route + amount, not owner user id', () async {
    String? seenPath;
    Map<String, dynamic>? seen;
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((options) async {
      seenPath = options.path;
      seen = (options.data as Map).cast<String, dynamic>();
      return ResponseBody.fromString(
        '{"giftId":"gift-1","recipientUserId":"user-owner","characterId":"character-owner","amountCredits":100,"completedAt":"2026-10-05T10:00:00Z"}',
        200,
        headers: {
          Headers.contentTypeHeader: ['application/json'],
        },
      );
    });

    final transport = GatewayWalletTransport(
      api: ApiClient(dio: dio),
      now: () => DateTime.utc(2026, 10, 5, 10),
    );

    final receipt = await transport.sendGift(
      recipientCharacterId: 'character-owner',
      amountCredits: 100,
    );

    expect(receipt.giftId, 'gift-1');
    expect(seenPath, '/v1/twins/character-owner/gifts');
    expect(seen?['amountCredits'], 100);
    expect(seen?.containsKey('recipientUserId'), isFalse);
  });

  test('reuses the same transfer request id after an ambiguous network failure', () async {
    final requestIds = <String>[];
    var attempt = 0;
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((options) async {
      attempt += 1;
      final data = (options.data as Map).cast<String, dynamic>();
      requestIds.add(data['requestId'] as String);
      if (attempt == 1) {
        throw DioException(
          requestOptions: options,
          type: DioExceptionType.connectionError,
          error: 'response lost',
        );
      }
      return ResponseBody.fromString(
        '{"transferId":"transfer-replayed","recipientUserId":"user-b","amountCredits":250,"completedAt":"2026-10-05T10:00:00Z"}',
        200,
        headers: {
          Headers.contentTypeHeader: ['application/json'],
        },
      );
    });

    final transport = GatewayWalletTransport(
      api: ApiClient(dio: dio),
      now: () => DateTime.utc(2026, 10, 5, 10),
    );

    await expectLater(
      transport.sendCredits(
        recipient: 'friend@example.com',
        amountCredits: 250,
      ),
      throwsA(isA<DioException>()),
    );

    final receipt = await transport.sendCredits(
      recipient: 'friend@example.com',
      amountCredits: 250,
    );

    expect(receipt.transferId, 'transfer-replayed');
    expect(requestIds.length, 2);
    expect(requestIds[1], requestIds[0]);
  });

  test('uses a new request id for the next intentional identical transfer after success', () async {
    final requestIds = <String>[];
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((options) async {
      final data = (options.data as Map).cast<String, dynamic>();
      requestIds.add(data['requestId'] as String);
      return ResponseBody.fromString(
        '{"transferId":"transfer-ok","recipientUserId":"user-b","amountCredits":50,"completedAt":"2026-10-05T10:00:00Z"}',
        200,
        headers: {
          Headers.contentTypeHeader: ['application/json'],
        },
      );
    });

    var tick = 0;
    final transport = GatewayWalletTransport(
      api: ApiClient(dio: dio),
      now: () => DateTime.utc(2026, 10, 5, 10, 0, tick++),
    );

    await transport.sendCredits(
      recipient: 'friend@example.com',
      amountCredits: 50,
    );
    await transport.sendCredits(
      recipient: 'friend@example.com',
      amountCredits: 50,
    );

    expect(requestIds.length, 2);
    expect(requestIds[1], isNot(requestIds[0]));
  });

}
