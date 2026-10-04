import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import 'package:masanawa/src/agents/agent_directory.dart';
import 'package:masanawa/src/agents/agent_feedback.dart';
import 'package:masanawa/src/agents/agent_session.dart';
import 'package:masanawa/src/agents/masanawa_transport.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/core/providers.dart';
import 'package:masanawa/src/state/agent_connection_state.dart';
import 'package:masanawa/src/state/agent_directory_state.dart';
import 'package:masanawa/src/state/ai_chat_state.dart';
import 'package:masanawa/src/screens/chat/masana_list_screen.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';

const agent = AgentDirectoryEntry(
  characterId: 'character-1',
  characterVersionId: 'version-1',
  displayName: 'Amina',
  roleLabel: 'Assistant',
  about: '',
  presence: AgentPresence.available,
);

class FakeDirectory implements AgentDirectoryTransport {
  final List<Completer<List<AgentDirectoryEntry>>> requests = [];
  @override
  Future<List<AgentDirectoryEntry>> loadDirectory() {
    final request = Completer<List<AgentDirectoryEntry>>();
    requests.add(request);
    return request.future;
  }
}

class RetryDirectory implements AgentDirectoryTransport {
  int calls = 0;
  @override
  Future<List<AgentDirectoryEntry>> loadDirectory() async {
    if (++calls == 1)
      throw const ApiException('private database error', statusCode: 503);
    return [agent];
  }
}

class MemoryConnectionStore implements AgentConnectionStore {
  String? value;
  @override
  Future<String?> read() async => value;
  @override
  Future<void> write(String value) async {
    this.value = value;
  }

  @override
  Future<void> clear() async {
    value = null;
  }
}

class RecoveringTransport implements AgentTransport {
  int turns = 0;
  final Completer<AgentTurnResult>? pending;
  RecoveringTransport({this.pending});
  @override
  Future<AgentSessionBinding> openSession(String id) async =>
      AgentSessionBinding(characterId: id, characterSessionId: 'session-1');
  @override
  Future<AgentTurnResult> sendTurn({
    required AgentSessionBinding binding,
    required String text,
    void Function(String delta)? onTextDelta,
  }) async {
    turns++;
    if (pending != null) return pending!.future;
    if (turns == 1) throw const ApiException('private vendor failure');
    const reply = 'Real Gateway reply';
    onTextDelta?.call(reply);
    return const AgentTurnResult(
      text: reply,
      agentRunId: 'run-2',
    );
  }

  @override
  Future<AgentTurnResult> sendMediaTurn({
    required AgentSessionBinding binding,
    required Uint8List bytes,
    required String mimeType,
    required String caption,
  }) async => const AgentTurnResult(text: 'Media reply');
  @override
  Future<AgentTurnResult> sendMediaSetTurn({
    required AgentSessionBinding binding,
    required List<AgentMediaInput> media,
    required String caption,
    void Function(int sent, int total)? onUploadProgress,
  }) async {
    final total = media.fold<int>(0, (sum, item) => sum + item.bytes.length);
    onUploadProgress?.call(total, total);
    return const AgentTurnResult(text: 'Media set reply');
  }

  @override
  void cancelTurn(String characterId) {}

  @override
  Future<void> closeSession(AgentSessionBinding binding) async {}
}

class RecordingAdapter implements HttpClientAdapter {
  RequestOptions? request;
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? stream,
    Future<void>? cancelFuture,
  ) async {
    request = options;
    return ResponseBody.fromString(
      jsonEncode({'reply': 'hello', 'agentRunId': 'run-1'}),
      200,
      headers: {
        Headers.contentTypeHeader: ['application/json'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets(
    'phone directory gives safe feedback and retry opens the roster',
    (tester) async {
      tester.view.physicalSize = const Size(320, 720);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final directory = RetryDirectory();
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            agentDirectoryTransportProvider.overrideWithValue(directory),
          ],
          child: MaterialApp(
            theme: buildMasanawaTheme(brightness: Brightness.light),
            home: const AgentListScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(
        find.text('We couldn’t connect right now. Please try again.'),
        findsOneWidget,
      );
      expect(find.textContaining('administrator'), findsNothing);
      expect(find.textContaining('database'), findsNothing);
      await tester.tap(find.text('Try again'));
      await tester.pumpAndSettle();
      expect(find.text('Amina'), findsOneWidget);
      expect(find.text('1 agent'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  test('feedback never echoes an unknown server or provider message', () {
    const error = ApiException(
      'postgres://secret SQL stacktrace GEMINI_API_KEY',
      statusCode: 500,
    );
    expect(
      AgentFeedback.fromError(error).message,
      'We couldn’t connect right now. Please try again.',
    );
    expect(
      AgentFeedback.fromError(
        const ApiException('hidden', statusCode: 401),
      ).recovery,
      AgentRecovery.signIn,
    );
    expect(
      AgentFeedback.fromError(
        const ApiException('hidden', statusCode: 403),
      ).message,
      'This agent isn’t available right now.',
    );
  });

  test(
    'Gateway settings reject credentials, paths, query strings and remote HTTP',
    () {
      for (final url in [
        'http://example.test',
        'https://user:pass@example.test',
        'https://example.test/api',
        'https://example.test?token=secret',
        'https://example.test#token',
      ]) {
        expect(() => normalizeAgentGatewayUrl(url), throwsFormatException);
      }
      expect(
        normalizeAgentGatewayUrl(' https://example.test/ '),
        'https://example.test',
      );
      expect(
        normalizeAgentGatewayUrl('http://127.0.0.1:3000'),
        'http://127.0.0.1:3000',
      );
    },
  );

  test(
    'failed connection verification preserves existing secure settings',
    () async {
      final store = MemoryConnectionStore();
      final c = ProviderContainer(
        overrides: [agentConnectionStoreProvider.overrideWithValue(store)],
      );
      addTearDown(c.dispose);
      final controller = c.read(agentConnectionProvider.notifier);
      await Future<void>.delayed(Duration.zero);
      await controller.connect(
        baseUrl: 'https://one.test',
        token: 'private-token',
        verify: (_, __) async => [agent],
      );
      final saved = store.value;
      await expectLater(
        controller.connect(
          baseUrl: 'https://two.test',
          token: 'wrong',
          verify: (_, __) async =>
              throw const ApiException('hidden', statusCode: 401),
        ),
        throwsA(isA<ApiException>()),
      );
      expect(c.read(agentConnectionProvider).baseUrl, 'https://one.test');
      expect(store.value, saved);
      expect(
        c.read(agentConnectionProvider).toString(),
        isNot(contains('private-token')),
      );
      final restored = ProviderContainer(
        overrides: [agentConnectionStoreProvider.overrideWithValue(store)],
      );
      addTearDown(restored.dispose);
      restored.read(agentConnectionProvider);
      await Future<void>.delayed(Duration.zero);
      expect(
        restored.read(agentConnectionProvider).baseUrl,
        'https://one.test',
      );
      expect(restored.read(agentConnectionProvider).token, 'private-token');
    },
  );

  test(
    'directory keeps roster on transient failure and clears it on 401',
    () async {
      final transport = FakeDirectory();
      final c = ProviderContainer(
        overrides: [
          agentDirectoryTransportProvider.overrideWithValue(transport),
        ],
      );
      addTearDown(c.dispose);
      c.read(agentDirectoryProvider);
      await Future<void>.delayed(Duration.zero);
      transport.requests[0].complete([agent]);
      await Future<void>.delayed(Duration.zero);
      final retry = c.read(agentDirectoryProvider.notifier).refresh();
      transport.requests[1].completeError(
        const ApiException('hidden', statusCode: 503),
      );
      await retry;
      expect(c.read(agentDirectoryProvider).agents, [agent]);
      final denied = c.read(agentDirectoryProvider.notifier).refresh();
      transport.requests[2].completeError(
        const ApiException('hidden', statusCode: 401),
      );
      await denied;
      expect(c.read(agentDirectoryProvider).agents, isEmpty);
      expect(c.read(agentDirectoryProvider).recovery, AgentRecovery.signIn);
    },
  );

  test('older refresh cannot overwrite a recovered directory', () async {
    final transport = FakeDirectory();
    final c = ProviderContainer(
      overrides: [agentDirectoryTransportProvider.overrideWithValue(transport)],
    );
    addTearDown(c.dispose);
    c.read(agentDirectoryProvider);
    await Future<void>.delayed(Duration.zero);
    final next = c.read(agentDirectoryProvider.notifier).refresh();
    transport.requests[1].complete([agent]);
    await next;
    transport.requests[0].completeError(const ApiException('old failure'));
    await Future<void>.delayed(Duration.zero);
    expect(c.read(agentDirectoryProvider).agents, [agent]);
    expect(c.read(agentDirectoryProvider).error, isNull);
  });

  test(
    'failed turn retries the real transport without duplicating user message',
    () async {
      final transport = RecoveringTransport();
      final c = ProviderContainer(
        overrides: [agentTransportProvider.overrideWithValue(transport)],
      );
      addTearDown(c.dispose);
      final controller = c.read(aiChatProvider.notifier);
      await Future<void>.delayed(Duration.zero);
      await controller.sendText('character-1', 'hello');
      final userId = c
          .read(aiChatProvider)
          .threads['character-1']!
          .messages
          .first
          .id;
      expect(transport.turns, 1);
      expect(
        c.read(aiChatProvider).threads['character-1']!.messages.last.text,
        'I couldn’t respond just now. Please try again.',
      );
      await controller.retryMessage('character-1', userId);
      final thread = c.read(aiChatProvider).threads['character-1']!;
      expect(transport.turns, 2);
      expect(thread.messages.where((m) => m.isUser), hasLength(1));
      expect(thread.messages.last.text, 'Real Gateway reply');
      expect(thread.characterSessionId, 'session-1');
      expect(thread.agentRunId, 'run-2');
      expect(c.read(aiChatProvider).sendingIn, isEmpty);
    },
  );

  test('clearing a thread prevents a late result from recreating it', () async {
    final pending = Completer<AgentTurnResult>();
    final transport = RecoveringTransport(pending: pending);
    final c = ProviderContainer(
      overrides: [agentTransportProvider.overrideWithValue(transport)],
    );
    addTearDown(c.dispose);
    final controller = c.read(aiChatProvider.notifier);
    await Future<void>.delayed(Duration.zero);
    final send = controller.sendText('character-1', 'hello');
    await Future<void>.delayed(Duration.zero);
    controller.clearThread('character-1');
    pending.complete(const AgentTurnResult(text: 'Late response'));
    await send;
    expect(c.read(aiChatProvider).threads, isEmpty);
    expect(c.read(aiChatProvider).sendingIn, isEmpty);
  });

  test(
    'chat transport keeps Alpha authorization and waits for server deadline',
    () async {
      final adapter = RecordingAdapter();
      final dio = Dio(BaseOptions(receiveTimeout: const Duration(seconds: 15)));
      dio.httpClientAdapter = adapter;
      final transport = MasanawaAgentTransport(
        dio: dio,
        baseUrl: 'https://gateway.test',
        readAccessToken: () => 'private-token',
      );
      await transport.sendTurn(
        binding: const AgentSessionBinding(
          characterId: 'character-1',
          characterSessionId: 'session-1',
        ),
        text: 'hello',
      );
      expect(
        adapter.request!.path,
        'https://gateway.test/v1/agent/sessions/session-1/turn',
      );
      expect(adapter.request!.headers['Authorization'], 'Bearer private-token');
      expect(adapter.request!.receiveTimeout, const Duration(seconds: 75));
      expect(adapter.request!.followRedirects, isFalse);
    },
  );
}
