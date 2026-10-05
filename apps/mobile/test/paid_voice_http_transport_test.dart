import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/voice/paid_voice_http_transport.dart';

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
  test('paid voice quote posts twin + expected seconds only', () async {
    Map<String, dynamic>? seen;
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((options) async {
      seen = (options.data as Map).cast<String, dynamic>();
      return ResponseBody.fromString(
        '{"quoteId":"voice-quote-1","characterId":"character-1","policyRevision":1,"trialPolicyRevision":1,"chargeMode":"trial","trialDurationDays":7,"trialStartsAt":"2026-10-05T10:00:00Z","trialExpiresAt":"2026-10-12T10:00:00Z","estimatedSeconds":300,"estimatedPriceCredits":0,"spendCapCredits":0,"ownerShareBasisPoints":3000,"quoteExpiresAt":"2026-10-05T10:05:00Z"}',
        200,
        headers: {
          Headers.contentTypeHeader: ['application/json'],
        },
      );
    });

    final transport = GatewayPaidVoiceTransport(api: ApiClient(dio: dio));
    final quote = await transport.quote(
      characterId: 'character-1',
      expectedSeconds: 300,
    );

    expect(quote.isTrial, isTrue);
    expect(quote.trialDurationDays, 7);
    expect(seen?['characterId'], 'character-1');
    expect(seen?['expectedSeconds'], 300);
    expect(seen?.containsKey('priceCredits'), isFalse);
  });

  test('paid voice start explicitly accepts server quote id', () async {
    Map<String, dynamic>? seen;
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((options) async {
      seen = (options.data as Map).cast<String, dynamic>();
      return ResponseBody.fromString(
        '{"admissionId":"voice-admission-1","quoteId":"voice-quote-1","characterId":"character-1","chargeMode":"trial","admittedAt":"2026-10-05T10:00:01Z","expiresAt":"2026-10-05T10:10:01Z","spendCapCredits":0}',
        200,
        headers: {
          Headers.contentTypeHeader: ['application/json'],
        },
      );
    });

    final transport = GatewayPaidVoiceTransport(api: ApiClient(dio: dio));
    final admission = await transport.start(
      characterId: 'character-1',
      quoteId: 'voice-quote-1',
    );

    expect(admission.admissionId, 'voice-admission-1');
    expect(seen?['accepted'], isTrue);
    expect(seen?['quoteId'], 'voice-quote-1');
  });
}
