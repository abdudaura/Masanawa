import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/agents/agent_session.dart';
import 'package:masanawa/src/agents/masanawa_transport.dart';
import 'package:masanawa/src/core/network/api_client.dart';

const requestId = 'request_0199f0d0-0000-7000-8000-000000000001';
const binding = AgentSessionBinding(
  characterId: 'character-1',
  characterSessionId: 'session-1',
);

class ReceiptStreamAdapter implements HttpClientAdapter {
  final events = StreamController<Uint8List>();
  void emit(Map<String, Object?> event) =>
      events.add(Uint8List.fromList(utf8.encode('${jsonEncode(event)}\n')));
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? stream,
    Future<void>? cancelFuture,
  ) async => ResponseBody(
    events.stream,
    200,
    headers: {
      Headers.contentTypeHeader: ['application/x-ndjson'],
    },
  );
  @override
  void close({bool force = false}) {
    if (!events.isClosed) unawaited(events.close());
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test('durable receipt arrives before the delayed answer', () async {
    final adapter = ReceiptStreamAdapter();
    final dio = Dio()..httpClientAdapter = adapter;
    final transport = MasanawaAgentTransport(
      dio: dio,
      baseUrl: 'https://gateway.test',
    );
    final accepted = Completer<AgentTurnReceipt>();
    var completed = false;
    final turn = transport
        .sendTurn(
          binding: binding,
          text: 'hello',
          requestId: requestId,
          onAccepted: accepted.complete,
        )
        .then((value) {
          completed = true;
          return value;
        });
    adapter.emit({
      'type': 'accepted',
      'requestId': requestId,
      'state': 'pending',
    });
    final receipt = await accepted.future.timeout(const Duration(seconds: 2));
    expect(receipt.requestId, requestId);
    expect(receipt.state, 'pending');
    expect(completed, isFalse);
    adapter.emit({
      'type': 'done',
      'reply': 'answer',
      'agentRunId': 'run-1',
      'parts': [],
    });
    await adapter.events.close();
    expect((await turn).text, 'answer');
    dio.close();
  });
  test(
    'foreign and malformed receipts cannot acknowledge this request',
    () async {
      final adapter = ReceiptStreamAdapter();
      final dio = Dio()..httpClientAdapter = adapter;
      final transport = MasanawaAgentTransport(
        dio: dio,
        baseUrl: 'https://gateway.test',
      );
      final receipts = <AgentTurnReceipt>[];
      final turn = transport.sendTurn(
        binding: binding,
        text: 'hello',
        requestId: requestId,
        onAccepted: receipts.add,
      );
      adapter.emit({
        'type': 'accepted',
        'requestId': 'request_0199f0d0-0000-7000-8000-000000000002',
        'state': 'pending',
      });
      adapter.emit({
        'type': 'accepted',
        'requestId': requestId,
        'state': 'read',
      });
      adapter.emit({'type': 'accepted', 'requestId': 42, 'state': 'pending'});
      adapter.emit({
        'type': 'done',
        'reply': 'answer',
        'agentRunId': 'run-1',
        'parts': [],
      });
      await adapter.events.close();
      await turn;
      expect(receipts, isEmpty);
      dio.close();
    },
  );
  for (final code in [
    'agents.turn_pending',
    'agents.turn_settlement_uncertain',
  ]) {
    test('stream preserves $code for canonical recovery', () async {
      final adapter = ReceiptStreamAdapter();
      final dio = Dio()..httpClientAdapter = adapter;
      final transport = MasanawaAgentTransport(
        dio: dio,
        baseUrl: 'https://gateway.test',
      );
      final turn = transport.sendTurn(
        binding: binding,
        text: 'hello',
        requestId: requestId,
        onAccepted: (_) {},
      );
      final assertion = expectLater(
        turn,
        throwsA(isA<ApiException>().having((e) => e.code, 'code', code)),
      );
      adapter.emit({'type': 'error', 'code': code});
      await adapter.events.close();
      await assertion;
      dio.close();
    });
  }
  test('preview never invents a durable receipt', () async {
    final receipts = <AgentTurnReceipt>[];
    final preview = PreviewAgentTransport(
      sendPreview: (_, __) async => 'preview',
    );
    await preview.sendTurn(
      binding: binding,
      text: 'hello',
      requestId: requestId,
      onAccepted: receipts.add,
    );
    expect(receipts, isEmpty);
  });
}
