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


  ResponseBody jsonResponse(String body, {int status = 200}) =>
      ResponseBody.fromString(
        body,
        status,
        headers: {Headers.contentTypeHeader: ['application/json']},
      );

  const credits = '{"spendableCredits":75,"pendingEarningsCredits":10,'
      '"availableEarningsCredits":25,"entries":[]}';

  test('loads separate authenticated NGN minor units and Credits', () async {
    final requested = <String>[];
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((options) async {
      requested.add(options.path);
      if (options.path == '/v1/wallet/ngn') {
        return jsonResponse('{"balanceKobo":123456,"balance":"1234.56"}');
      }
      return jsonResponse(credits);
    });
    final wallet = await GatewayWalletTransport(api: ApiClient(dio: dio)).load();
    expect(requested, containsAll(['/v1/wallet', '/v1/wallet/ngn']));
    expect(wallet.spendableCredits, 75);
    expect(wallet.availableEarningsCredits, 25);
    expect(wallet.ngnBalanceVerified, isTrue);
    expect(wallet.ngnBalanceKobo, 123456);
  });

  test('NGN 503 preserves independent Credits without misreporting ₦0', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((options) async =>
        options.path == '/v1/wallet/ngn'
            ? jsonResponse('{"error":"unavailable"}', status: 503)
            : jsonResponse(credits));
    final wallet = await GatewayWalletTransport(api: ApiClient(dio: dio)).load();
    expect(wallet.spendableCredits, 75);
    expect(wallet.ngnBalanceVerified, isFalse);
    expect(wallet.ngnBalanceLabel, 'NGN balance unavailable');
  });

  test('NGN malformed amount never becomes a real zero balance', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((options) async =>
        options.path == '/v1/wallet/ngn'
            ? jsonResponse('{"balanceKobo":1.5}')
            : jsonResponse(credits));
    final wallet = await GatewayWalletTransport(api: ApiClient(dio: dio)).load();
    expect(wallet.spendableCredits, 75);
    expect(wallet.ngnBalanceVerified, isFalse);
  });

  test('native NGN auth failure is not masked by a successful Credits read', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((options) async =>
        options.path == '/v1/wallet/ngn'
            ? jsonResponse('{"error":"unauthorized"}', status: 401)
            : jsonResponse(credits));
    await expectLater(
      GatewayWalletTransport(api: ApiClient(dio: dio)).load(),
      throwsA(isA<DioException>()),
    );
  });

  test('Credits projection auth/data failures never show a financial balance', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((options) async =>
        options.path == '/v1/wallet/ngn'
            ? jsonResponse('{"balanceKobo":100}')
            : jsonResponse('{"error":"unauthorized"}', status: 401));
    await expectLater(
      GatewayWalletTransport(api: ApiClient(dio: dio)).load(),
      throwsA(isA<DioException>()),
    );
  });

}

