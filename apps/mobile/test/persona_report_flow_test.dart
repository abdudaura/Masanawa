import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/talks/talk_safety_http_transport.dart';
import 'package:masanawa/src/screens/profile/persona_profile_screen.dart';
import 'package:masanawa/src/state/talk_social_profile_state.dart';
import 'package:masanawa/src/social/talk_social_profiles.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';
import 'package:masanawa/src/screens/profile/persona_report_sheet.dart';
import 'package:masanawa/src/state/talk_safety_state.dart';
import 'package:masanawa/src/talks/talk_safety.dart';

class _PersonaProfiles implements TalkSocialProfileTransport {
  @override
  Future<PersonaProfile?> loadPersona(String publicId) async => PersonaProfile(
    publicId: publicId,
    displayName: 'Gwani Expert',
    kind: PersonaProfileKind.expert,
    isAvailable: true,
    seatFeeLabel: 'Price on quote',
  );
  @override
  Future<HumanProfile?> loadHuman(String handle) async => null;
  @override
  Future<HumanProfile?> loadHumanByUserId(String userId) async => null;
  @override
  Future<HumanProfile> setFollowing({required String handle, required bool following}) async => throw UnimplementedError();
  @override
  Future<HumanProfile> setFollowingUserId({required String userId, required bool following}) async => throw UnimplementedError();
}

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
      theme: buildMasanawaTheme(brightness: Brightness.light),
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

  testWidgets('public Expert profile opens the wired report sheet', (tester) async {
    final transport = _FakeSafety();
    await tester.pumpWidget(ProviderScope(
      overrides: [
        talkSafetyTransportProvider.overrideWithValue(transport),
        talkSocialProfileTransportProvider.overrideWithValue(_PersonaProfiles()),
      ],
      child: MaterialApp(
        theme: buildMasanawaTheme(brightness: Brightness.light),
        home: const PersonaProfileScreen(publicId: 'persona-public-7'),
      ),
    ));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.byKey(const ValueKey('persona-report-action')));
    await tester.tap(find.byKey(const ValueKey('persona-report-action')));
    await tester.pumpAndSettle();
    expect(find.text('Report Gwani Expert'), findsOneWidget);
    await tester.ensureVisible(find.text('Spam'));
    await tester.tap(find.text('Spam'));
    await tester.pump();
    await tester.ensureVisible(find.text('Send report'));
    await tester.tap(find.text('Send report'));
    await tester.pumpAndSettle();
    expect(transport.targets, ['persona-public-7']);
    expect(find.text('Report received for review.'), findsOneWidget);
  });

  test('HTTP transport preserves supplied request ID, payload and customer bearer', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://example.invalid'));
    RequestOptions? sent;
    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        sent = options;
        handler.resolve(Response<dynamic>(
          requestOptions: options, statusCode: 202, data: {'accepted': true},
        ));
      },
    ));
    final api = ApiClient(dio: dio)..accessToken = 'customer-access-token';
    await GatewayTalkSafetyTransport(api: api).reportTarget(
      targetKind: TalkSafetyTargetKind.persona,
      targetId: 'persona-public-7',
      reason: TalkSafetyReportReason.fraud,
      detail: '  Verified concern  ',
      clientRequestId: 'request-stable-1',
    );
    expect(sent?.path, '/safety/reports');
    expect(sent?.headers['Authorization'], 'Bearer customer-access-token');
    expect(sent?.data, {
      'targetKind': 'persona',
      'targetId': 'persona-public-7',
      'reason': 'fraud',
      'detail': 'Verified concern',
      'clientRequestId': 'request-stable-1',
    });
  });
}
