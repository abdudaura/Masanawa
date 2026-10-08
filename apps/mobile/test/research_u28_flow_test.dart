import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/research/research.dart';
import 'package:masanawa/src/research/research_panel.dart';

Map<String, dynamic> fixture({
  String status = 'sources_found',
  String mode = 'general',
  bool withSources = true,
}) => {
  'mode': mode,
  'status': status,
  'checkedAt': '2026-10-08T17:00:00Z',
  'sourceCount': withSources ? 1 : 0,
  'independentDomainCount': withSources ? 1 : 0,
  'caveat': 'Indexed excerpts only: open the original sources.',
  'sources': withSources ? [
    {
      'referenceId': 'src_abcd1234',
      'title': 'Public information',
      'url': 'https://example.org/news',
      'domain': 'example.org',
      'excerpt': 'An untrusted externally indexed snippet.',
      'evidenceKind': 'indexed_excerpt',
      'publishedAt': '2026-10-07T00:00:00Z',
    },
  ] : [],
};

class _FakeTransport implements ResearchTransport {
  final queued = <Completer<ResearchResult>>[];
  final cancelTokens = <CancelToken?>[];
  @override
  Future<ResearchResult> search({
    required String query, required ResearchMode mode,
    CancelToken? cancelToken,
  }) {
    cancelTokens.add(cancelToken);
    final pending = Completer<ResearchResult>();
    queued.add(pending);
    return pending.future;
  }
}

void main() {
  test('strict source identity and malformed current status fail closed', () {
    final result = ResearchResult.fromJson(fixture());
    expect(result.sources.single.url.host, 'example.org');
    expect(result.canClaimCurrentEvidence, false);
    expect(() => ResearchResult.fromJson(fixture()
      ..['sources'][0]['url'] = 'http://example.org/news'), throwsFormatException);
    expect(() => ResearchResult.fromJson(fixture()
      ..['sources'][0]['url'] = 'https://127.0.0.1/a'), throwsFormatException);
    expect(() => ResearchResult.fromJson(fixture()
      ..['sources'][0]['domain'] = 'wrong.example.org'), throwsFormatException);
    expect(ResearchResult.fromJson(fixture(
      mode: 'current', status: 'insufficient_evidence',
    )).canClaimCurrentEvidence, false);
  });

  test('result accounting cannot forge a successful source count', () {
    expect(() => ResearchResult.fromJson(fixture()..['sourceCount'] = 3),
        throwsFormatException);
    expect(() => ResearchResult.fromJson(fixture(
      status: 'sources_found', withSources: false,
    )), throwsFormatException);
  });

  test('new request and account switch fence late source readbacks', () async {
    final fake = _FakeTransport();
    final controller = ResearchController(fake, accountKey: 'account-A');
    final first = controller.search('government budget', ResearchMode.current);
    final second = controller.search('forest history', ResearchMode.general);
    expect(fake.cancelTokens.first!.isCancelled, true);
    fake.queued[1].complete(ResearchResult.fromJson(fixture()));
    await second;
    expect(controller.result?.sources.single.domain, 'example.org');
    controller.switchAccount('account-B');
    expect(controller.result, null);
    fake.queued.first.complete(ResearchResult.fromJson(fixture()));
    await first;
    expect(controller.result, null);
    controller.dispose();
  });

  test('provider errors do not reveal credentials, and sign-out cancels request', () async {
    final fake = _FakeTransport();
    final controller = ResearchController(fake, accountKey: 'A');
    final active = controller.search('medical advice', ResearchMode.general);
    fake.queued.single.completeError(
        Exception('PRIVATE_PROVIDER_SECRET query=medical advice'));
    await active;
    expect(controller.error, isNot(contains('PRIVATE_PROVIDER_SECRET')));
    final next = controller.search('historical site', ResearchMode.general);
    controller.clear();
    expect(fake.cancelTokens.last!.isCancelled, true);
    fake.queued.last.complete(ResearchResult.fromJson(fixture()));
    await next;
    expect(controller.result, null);
    controller.dispose();
  });

  testWidgets('research screen presents source caveat, source link and empty state',
      (tester) async {
    final fake = _FakeTransport();
    final controller = ResearchController(fake, accountKey: 'A');
    Uri? opened;
    await tester.pumpWidget(MaterialApp(home: Scaffold(
      body: ResearchPanel(
        controller: controller,
        openSource: (source) async { opened = source; },
      ),
    )));
    await tester.enterText(find.byKey(const ValueKey('research-query')),
        'new solar technology');
    await tester.tap(find.byKey(const ValueKey('research-submit')));
    await tester.pump();
    fake.queued.single.complete(ResearchResult.fromJson(fixture()));
    await tester.pumpAndSettle();
    expect(find.textContaining('Indexed excerpts only'), findsOneWidget);
    expect(find.textContaining('Public information'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('source-src_abcd1234')));
    expect(opened.toString(), 'https://example.org/news');
    await tester.tap(find.byKey(const ValueKey('research-submit')));
    await tester.pump();
    fake.queued.last.complete(ResearchResult.fromJson(fixture(
      status: 'no_sources', withSources: false,
    )));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('research-empty')), findsOneWidget);
    controller.dispose();
  });
}
