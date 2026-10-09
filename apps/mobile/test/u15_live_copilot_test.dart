import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/talk_live_copilot/controller.dart';
import 'package:masanawa/src/talk_live_copilot/models.dart';
import 'package:masanawa/src/talk_live_copilot/panel.dart';

class _Transport implements HostCopilotTransport {
  Future<List<HostCopilotSuggestion>> Function(String)? onSuggestions;
  Future<HostCopilotTurnReceipt> Function(String, String, String, String)? onTurn;
  final requestIds = <String>[];

  @override
  Future<List<HostCopilotSuggestion>> suggestions(String talkId) async =>
      onSuggestions?.call(talkId) ?? [];

  @override
  Future<HostCopilotTurnReceipt> approveTurn({
    required String talkId, required String seatId,
    required String requestId, required String hostApprovedTranscript,
  }) async {
    requestIds.add(requestId);
    return onTurn?.call(talkId, seatId, requestId, hostApprovedTranscript) ??
        const HostCopilotTurnReceipt(
          status: HostCopilotStatus.published, reason: 'published',
        );
  }
}
void main() {
  test('account switch fences delayed private Host suggestion results', () async {
    final transport = _Transport();
    final completer = Completer<List<HostCopilotSuggestion>>();
    transport.onSuggestions = (_) => completer.future;
    final controller = HostCopilotController(transport: transport);
    controller.openScope(accountSessionKey: 'account-A-session-1',
      talkId: 'talk-A', seatId: 'seat-A');
    final pending = controller.refresh();
    controller.openScope(accountSessionKey: 'account-B-session-2',
      talkId: 'talk-B', seatId: 'seat-B');
    completer.complete([
      const HostCopilotSuggestion(kind: 'topic', prompt: 'Private to A'),
    ]);
    await pending;
    expect(controller.suggestions, isEmpty);
    expect(controller.error, isNull);
    controller.dispose();
  });

  test('lost ACK reuses one idempotency key; new approval generates a new one', () async {
    final transport = _Transport();
    var attempts = 0;
    transport.onTurn = (_, __, ___, ____) async {
      attempts++;
      if (attempts == 1) throw TimeoutException('Lost response');
      return const HostCopilotTurnReceipt(
        status: HostCopilotStatus.published, reason: 'published',
      );
    };
    final controller = HostCopilotController(transport: transport);
    controller.openScope(accountSessionKey: 'session-A',
      talkId: 'talk-A', seatId: 'seat-A');
    await controller.approve('One question');
    expect(controller.error, contains('status unknown'));
    await controller.approve('One question');
    expect(controller.lastReceipt?.status, HostCopilotStatus.published);
    expect(transport.requestIds, hasLength(2));
    expect(transport.requestIds.first, transport.requestIds.last);
    await controller.approve('A new reviewed question');
    expect(transport.requestIds[2], isNot(transport.requestIds[1]));
    controller.dispose();
  });

  test('an uncertain server result disables a second paid AI turn', () async {
    final transport = _Transport();
    transport.onTurn = (_, __, ___, ____) async =>
        const HostCopilotTurnReceipt(
          status: HostCopilotStatus.uncertain, reason: 'worker_outcome_unknown',
        );
    final controller = HostCopilotController(transport: transport);
    controller.openScope(accountSessionKey: 'session-A',
      talkId: 'talk-A', seatId: 'seat-A');
    await controller.approve('First turn');
    expect(controller.blockedOnUnknown, true);
    await controller.approve('Second turn');
    expect(transport.requestIds, hasLength(1));
    controller.dispose();
  });

  test('old session does not capture returned turn acknowledgement', () async {
    final transport = _Transport();
    final completer = Completer<HostCopilotTurnReceipt>();
    transport.onTurn = (_, __, ___, ____) => completer.future;
    final controller = HostCopilotController(transport: transport);
    controller.openScope(accountSessionKey: 'session-A',
      talkId: 'talk-A', seatId: 'seat-A');
    final request = controller.approve('First turn');
    controller.openScope(accountSessionKey: 'session-B',
      talkId: 'talk-B', seatId: 'seat-B');
    completer.complete(const HostCopilotTurnReceipt(
      status: HostCopilotStatus.published, reason: 'published',
    ));
    await request;
    expect(controller.lastReceipt, isNull);
    expect(controller.busy, false);
    controller.dispose();
  });

  testWidgets('Host explicitly reviews before speaking to an admitted AI Seat',
      (tester) async {
    final transport = _Transport();
    final controller = HostCopilotController(transport: transport);
    await tester.pumpWidget(MaterialApp(home: Scaffold(body:
      HostCopilotPanel(controller: controller,
        accountSessionKey: 'session-A', talkId: 'talk-A', seatId: 'seat-A'))));
    await tester.enterText(find.byType(TextField), 'How does this work?');
    await tester.pump();
    await tester.tap(find.text('Review AI turn'));
    await tester.pumpAndSettle();
    expect(find.text('Approve AI Seat turn?'), findsOneWidget);
    expect(transport.requestIds, isEmpty);
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(transport.requestIds, isEmpty);
    await tester.tap(find.text('Review AI turn'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Approve turn'));
    await tester.pumpAndSettle();
    expect(transport.requestIds, hasLength(1));
    expect(find.textContaining('audibility is not verified'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
    controller.dispose();
  });
}
