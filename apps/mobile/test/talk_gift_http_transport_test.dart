import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/talks/talk_gift_http_transport.dart';

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

ResponseBody _receipt({
  String giftId = 'gift-1',
  int amount = 100,
}) {
  return ResponseBody.fromString(
    '{"giftId":"$giftId","talkId":"talk-1","recipientUserId":"host-1",'
    '"recipientName":"Amina","amountCredits":$amount,"status":"completed",'
    '"completedAt":"2026-10-07T10:00:00Z"}',
    200,
    headers: {
      Headers.contentTypeHeader: ['application/json'],
    },
  );
}

void main() {
  test('Talk gift sends only talk path, request id and amount', () async {
    String? path;
    Map<String, dynamic>? body;
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((options) async {
      path = options.path;
      body = (options.data as Map).cast<String, dynamic>();
      return _receipt();
    });

    final transport = GatewayTalkGiftTransport(
      api: ApiClient(dio: dio),
      now: () => DateTime.utc(2026, 10, 7, 10),
    );

    final receipt = await transport.sendGift(
      talkId: 'talk-1',
      amountCredits: 100,
    );

    expect(receipt.recipientUserId, 'host-1');
    expect(receipt.recipientName, 'Amina');
    expect(path, '/talks/talk-1/gifts');
    expect(body?['amountCredits'], 100);
    expect((body?['requestId'] as String).startsWith('talk-gift-'), isTrue);
    expect(body?.containsKey('recipientUserId'), isFalse);
    expect(body?.containsKey('hostUserId'), isFalse);
  });

  test('ambiguous Talk gift retry reuses the same request id', () async {
    final ids = <String>[];
    var attempt = 0;
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((options) async {
      attempt += 1;
      final data = (options.data as Map).cast<String, dynamic>();
      ids.add(data['requestId'] as String);
      if (attempt == 1) {
        throw DioException(
          requestOptions: options,
          type: DioExceptionType.connectionError,
          error: 'response lost',
        );
      }
      return _receipt(giftId: 'gift-replayed');
    });

    final transport = GatewayTalkGiftTransport(
      api: ApiClient(dio: dio),
      now: () => DateTime.utc(2026, 10, 7, 10),
    );

    await expectLater(
      transport.sendGift(talkId: 'talk-1', amountCredits: 100),
      throwsA(isA<DioException>()),
    );

    final receipt = await transport.sendGift(
      talkId: 'talk-1',
      amountCredits: 100,
    );

    expect(receipt.giftId, 'gift-replayed');
    expect(ids, hasLength(2));
    expect(ids[1], ids[0]);
  });

  test('a later intentional identical gift gets a new request id', () async {
    final ids = <String>[];
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((options) async {
      final data = (options.data as Map).cast<String, dynamic>();
      ids.add(data['requestId'] as String);
      return _receipt();
    });

    var tick = 0;
    final transport = GatewayTalkGiftTransport(
      api: ApiClient(dio: dio),
      now: () => DateTime.utc(2026, 10, 7, 10, 0, tick++),
    );

    await transport.sendGift(talkId: 'talk-1', amountCredits: 100);
    await transport.sendGift(talkId: 'talk-1', amountCredits: 100);

    expect(ids, hasLength(2));
    expect(ids[1], isNot(ids[0]));
  });

  test('catalog loads server prices, filters unavailable and sends selected identity', () async {
    String? sentItem;
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((options) async {
      if (options.method == 'GET') {
        expect(options.path, '/talks/talk-1/gifts/catalog');
        return ResponseBody.fromString(
          '{"talkId":"talk-1","currency":"Credits","items":['
          '{"id":"heart","name":"Heart","visual":"heart","amountCredits":100,"available":true},'
          '{"id":"crown","name":"Crown","visual":"crown","amountCredits":500,"available":false}]}',
          200,
          headers: {Headers.contentTypeHeader: ['application/json']},
        );
      }
      sentItem = (options.data as Map)['catalogItemId'] as String?;
      return ResponseBody.fromString(
        '{"giftId":"gift-1","talkId":"talk-1","recipientUserId":"host-1",'
        '"recipientName":"Amina","amountCredits":100,'
        '"catalogItemId":"heart","status":"completed",'
        '"completedAt":"2026-10-07T10:00:00Z"}',
        200,
        headers: {Headers.contentTypeHeader: ['application/json']},
      );
    });
    final t = GatewayTalkGiftTransport(api: ApiClient(dio: dio));
    final catalog = await t.loadCatalog(talkId: 'talk-1');
    expect(catalog.items, hasLength(1));
    expect(catalog.items.single.id, 'heart');
    expect(catalog.items.single.amountCredits, 100);
    final receipt = await t.sendGift(
      talkId: 'talk-1', amountCredits: 100, catalogItemId: 'heart',
    );
    expect(sentItem, 'heart');
    expect(receipt.catalogItemId, 'heart');
  });

  test('catalog rejects duplicate/foreign-talk/inconsistent prices before presentation', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((options) async =>
      ResponseBody.fromString(
        '{"talkId":"other-talk","currency":"Credits","items":['
        '{"id":"heart","name":"Heart","visual":"heart","amountCredits":100,"available":true}]}',
        200,
        headers: {Headers.contentTypeHeader: ['application/json']},
      ));
    final t = GatewayTalkGiftTransport(api: ApiClient(dio: dio));
    await expectLater(t.loadCatalog(talkId: 'talk-1'), throwsFormatException);
  });

  test('qualified empty catalog is parsed without inventing gift options', () async {
    var posts = 0;
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((options) async {
      if (options.method != 'GET') posts++;
      return ResponseBody.fromString(
        '{"talkId":"talk-1","currency":"Credits","items":[]}',
        200,
        headers: {Headers.contentTypeHeader: ['application/json']},
      );
    });
    final transport = GatewayTalkGiftTransport(api: ApiClient(dio: dio));
    final catalog = await transport.loadCatalog(talkId: 'talk-1');
    expect(catalog.items, isEmpty);
    expect(posts, 0);
  });

  test('a mismatched settled receipt is never treated as successful gift', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((options) async =>
      ResponseBody.fromString(
        '{"giftId":"gift-1","talkId":"talk-1","recipientUserId":"host-1",'
        '"recipientName":"Amina","amountCredits":500,'
        '"catalogItemId":"heart","status":"completed",'
        '"completedAt":"2026-10-07T10:00:00Z"}',
        200,
        headers: {Headers.contentTypeHeader: ['application/json']},
      ));
    final t = GatewayTalkGiftTransport(api: ApiClient(dio: dio));
    await expectLater(
      t.sendGift(talkId: 'talk-1', amountCredits: 100, catalogItemId: 'heart'),
      throwsFormatException,
    );
  });

  test('incomplete receipt is rejected without celebrating unconfirmed payment', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((options) async =>
      ResponseBody.fromString(
        '{"giftId":"gift-1","talkId":"talk-1","recipientUserId":"host-1",'
        '"recipientName":"Amina","amountCredits":100,'
        '"catalogItemId":"heart","status":"pending",'
        '"completedAt":"2026-10-07T10:00:00Z"}',
        200,
        headers: {Headers.contentTypeHeader: ['application/json']},
      ));
    final t = GatewayTalkGiftTransport(api: ApiClient(dio: dio));
    await expectLater(
      t.sendGift(talkId: 'talk-1', amountCredits: 100, catalogItemId: 'heart'),
      throwsFormatException,
    );
  });
}
