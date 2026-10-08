import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:masanawa/src/screens/profile/persona_report_sheet.dart';
import 'package:masanawa/src/state/talk_safety_state.dart';
import 'package:masanawa/src/talks/talk_safety.dart';

class _FakeSafety implements TalkSafetyTransport {
  final ids = <String?>[];
  final targets = <String>[];
  final reasons = <TalkSafetyReportReason>[];
  final details = <String?>[];
  bool failOnce = false;

  @override
  Future<TalkSafetyPreference> loadUserPreference(String userId) async =>
      const TalkSafetyPreference(blocked: false, muted: false);

  @override
  Future<TalkSafetyPreference> setUserPreference({
    required String userId,
    required bool blocked,
    required bool muted,
  }) async => TalkSafetyPreference(blocked: blocked, muted: muted);

  @override
  Future<void> reportTalk({
    required String talkId,
    required bool isReplay,
    required TalkSafetyReportReason reason,
    String? detail,
  }) async => throw StateError('Unexpected Talk report');

  @override
  Future<void> reportTarget({
    required TalkSafetyTargetKind targetKind,
    required String targetId,
    required TalkSafetyReportReason reason,
    String? detail,
    String? clientRequestId,
  }) async {
    expect(targetKind, TalkSafetyTargetKind.persona);
    ids.add(clientRequestId);
    targets.add(targetId);
    reasons.add(reason);
    details.add(detail);
    if (failOnce) {
      failOnce = false;
      throw StateError('Ambiguous network timeout');
    }
  }
}

void main() {
  Widget app(_FakeSafety transport) => ProviderScope(
    overrides: [talkSafetyTransportProvider.overrideWithValue(transport)],
    child: MaterialApp(
      home: Scaffold(
        body: PersonaReportSheet(
          publicId: 'persona-public-7',
          displayName: 'Gwani Expert',
        ),
      ),
    ),
  );

  testWidgets('requires reason and sends authoritative persona id', (tester) async {
    final transport = _FakeSafety();
    await tester.pumpWidget(app(transport));
    expect(
      tester.widget<FilledButton>(
        find.byKey(const ValueKey('persona-report-submit')),
      ).onPressed,
      isNull,
    );
    await tester.ensureVisible(find.text('Fraud or scam'));
    await tester.tap(find.text('Fraud or scam'));
    await tester.pump();
    await tester.ensureVisible(find.text('Send report'));
    await tester.tap(find.text('Send report'));
    await tester.pumpAndSettle();
    expect(transport.targets, ['persona-public-7']);
    expect(transport.reasons, [TalkSafetyReportReason.fraud]);
    expect(transport.ids.single, startsWith('request_'));
    expect(find.byKey(const ValueKey('persona-report-confirmed')), findsOneWidget);
    expect(find.text('Retry same report'), findsNothing);
  });

  testWidgets('uncertain send freezes payload and reuses id on retry', (tester) async {
    final transport = _FakeSafety()..failOnce = true;
    await tester.pumpWidget(app(transport));
    await tester.ensureVisible(find.text('Spam'));
    await tester.tap(find.text('Spam'));
    await tester.pump();
    await tester.ensureVisible(find.byKey(const ValueKey('persona-report-detail')));
    await tester.enterText(
      find.byKey(const ValueKey('persona-report-detail')),
      'Unsafe impersonation',
    );
    await tester.ensureVisible(find.text('Send report'));
    await tester.tap(find.text('Send report'));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('persona-report-error')), findsOneWidget);
    final field = tester.widget<TextField>(
      find.byKey(const ValueKey('persona-report-detail')),
    );
    expect(field.readOnly, isTrue);
    await tester.ensureVisible(find.text('Retry same report'));
    await tester.tap(find.text('Retry same report'));
    await tester.pumpAndSettle();
    expect(transport.targets, ['persona-public-7', 'persona-public-7']);
    expect(transport.ids.length, 2);
    expect(transport.ids[0], transport.ids[1]);
    expect(transport.details, ['Unsafe impersonation', 'Unsafe impersonation']);
    expect(find.byKey(const ValueKey('persona-report-confirmed')), findsOneWidget);
  });
}
