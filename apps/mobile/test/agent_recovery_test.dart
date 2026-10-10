import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import 'package:masanawa/src/agents/agent_directory.dart';
import 'package:masanawa/src/agents/agent_directory_cache.dart';
import 'package:masanawa/src/agents/agent_feedback.dart';
import 'package:masanawa/src/agents/agent_session.dart';
import 'package:masanawa/src/agents/masanawa_transport.dart';
import 'package:masanawa/src/core/api/models.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/core/providers.dart';
import 'package:masanawa/src/state/agent_directory_state.dart';
import 'package:masanawa/src/state/ai_chat_state.dart';
import 'package:masanawa/src/state/session_state.dart';
import 'package:masanawa/src/screens/chat/masana_list_screen.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';

const _directoryUser = AuthUser(
  id: 'user-directory',
  name: 'Directory User',
  email: 'directory@example.com',
  locale: 'en-NG',
  status: 'ACTIVE',
  role: 'USER',
  isNewUser: false,
  createdAt: '2026-10-05T00:00:00Z',
);

const _directoryTokens = AuthTokens(
  accessToken: 'directory-access',
  refreshToken: 'directory-refresh',
  accessExpiresIn: 900,
  user: _directoryUser,
);

class _SignedInSessionController extends SessionController {
  @override
  SessionState build() =>
      const SessionSignedIn(_directoryUser, _directoryTokens);
}

class _SignedOutSessionController extends SessionController {
  @override
  SessionState build() => const SessionSignedOut();
}

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

  @override
  Future<void> setDefaultPlatformAgent(String characterId) async {}
}

class _NoopDirectoryCache implements AgentDirectoryCache {
  @override
  Future<List<AgentDirectoryEntry>?> read(String ownerId) async => null;

  @override
  Future<void> write(String ownerId, List<AgentDirectoryEntry> agents) async {}

  @override
  Future<void> clear() async {}
}

Future<void> _waitForDirectoryRequests(
  FakeDirectory transport,
  int count,
) async {
  for (
    var attempt = 0;
    attempt < 20 && transport.requests.length < count;
    attempt++
  ) {
    await Future<void>.delayed(Duration.zero);
  }
  expect(transport.requests, hasLength(count));
}

class RetryDirectory implements AgentDirectoryTransport {
  int calls = 0;
  @override
  Future<List<AgentDirectoryEntry>> loadDirectory() async {
    if (++calls == 1)
      throw const ApiException('private database error', statusCode: 503);
    return [agent];
  }

  @override
  Future<void> setDefaultPlatformAgent(String characterId) async {}
}

class RecoveringTransport implements AgentTransport {
  int turns = 0;
  int closedSessions = 0;
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
    Future<void> Function(Uint8List pcmChunk)? onAudioPcmChunk,
    String? requestId,
  }) async {
    turns++;
    if (pending != null) return pending!.future;
    if (turns == 1) throw const ApiException('private vendor failure');
    const reply = 'Real Gateway reply';
    onTextDelta?.call(reply);
    return const AgentTurnResult(text: reply, agentRunId: 'run-2');
  }

  @override
  Future<AgentTurnResult> sendMediaTurn({
    required AgentSessionBinding binding,
    required Uint8List bytes,
    required String mimeType,
    required String caption,
    void Function(int sent, int total)? onUploadProgress,
    String? requestId,
  }) async {
    onUploadProgress?.call(bytes.length, bytes.length);
    return const AgentTurnResult(text: 'Media reply');
  }

  @override
  Future<AgentTurnResult> sendMediaSetTurn({
    required AgentSessionBinding binding,
    required List<AgentMediaInput> media,
    required String caption,
    void Function(int sent, int total)? onUploadProgress,
    String? requestId,
  }) async {
    final total = media.fold<int>(0, (sum, item) => sum + item.bytes.length);
    onUploadProgress?.call(total, total);
    return const AgentTurnResult(text: 'Media set reply');
  }

  @override
  void cancelTurn(String characterId) {}

  @override
  Future<void> closeSession(AgentSessionBinding binding) async {
    closedSessions++;
  }
}

class GatewayContractAdapter implements HttpClientAdapter {
  final requests = <RequestOptions>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? stream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    final path = options.uri.path;
    final Map<String, dynamic> body = switch (path) {
      '/creator/skills' => {'skills': <Object>[]},
      '/creator/economy' || '/creator/float' => {
        'hasClone': false,
        'characterId': null,
        'customerCredits': 0,
        'agentFloatCredits': 0,
        'pendingEarningsCredits': 0,
        'availableEarningsCredits': 0,
      },
      '/creator/clone' => {
        'created': true,
        'characterId': 'character-clone',
        'characterVersionId': 'version-clone',
        'relationshipId': 'relationship-clone',
        'displayName': 'Clone',
      },
      _ => <String, dynamic>{},
    };
    return ResponseBody.fromString(
      jsonEncode(body),
      200,
      headers: {
        Headers.contentTypeHeader: ['application/json'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
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

class RotatingAuthAdapter implements HttpClientAdapter {
  final authorizations = <String?>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? stream,
    Future<void>? cancelFuture,
  ) async {
    final authorization = options.headers['Authorization'] as String?;
    authorizations.add(authorization);
    if (authorization == 'Bearer expired-token') {
      return ResponseBody.fromString(
        jsonEncode({'code': 'UNAUTHORIZED', 'message': 'expired'}),
        401,
        headers: {
          Headers.contentTypeHeader: ['application/json'],
        },
      );
    }
    return ResponseBody.fromString(
      jsonEncode({
        'agents': [
          {
            'characterId': 'character-1',
            'characterVersionId': 'version-1',
            'displayName': 'Amina',
            'roleLabel': 'Assistant',
            'about': '',
            'greeting': null,
            'presence': 'available',
            'activeWorkCount': 0,
            'supportAgent': true,
            'defaultPlatformAgent': true,
            'voiceProvider': 'gemini',
            'voiceName': 'Bodi',
          },
        ],
      }),
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
            agentDirectoryCacheProvider.overrideWithValue(
              _NoopDirectoryCache(),
            ),
            sessionProvider.overrideWith(_SignedInSessionController.new),
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
    'directory keeps roster on transient failure and clears it on 401',
    () async {
      final transport = FakeDirectory();
      final c = ProviderContainer(
        overrides: [
          agentDirectoryTransportProvider.overrideWithValue(transport),
          agentDirectoryCacheProvider.overrideWithValue(_NoopDirectoryCache()),
          sessionProvider.overrideWith(_SignedInSessionController.new),
        ],
      );
      addTearDown(c.dispose);
      c.read(agentDirectoryProvider);
      await _waitForDirectoryRequests(transport, 1);
      transport.requests[0].complete([agent]);
      await Future<void>.delayed(Duration.zero);
      final retry = c.read(agentDirectoryProvider.notifier).refresh();
      transport.requests[1].completeError(
        const ApiException('hidden', statusCode: 503),
      );
      await retry;
      // A transient failure keeps the account-scoped roster, but historical
      // online/working presence must not be presented as current availability.
      final cached = c.read(agentDirectoryProvider).agents;
      expect(cached, hasLength(1));
      expect(cached.single.characterId, agent.characterId);
      expect(cached.single.characterVersionId, agent.characterVersionId);
      expect(cached.single.displayName, agent.displayName);
      expect(cached.single.presence, AgentPresence.unknown);
      expect(cached.single.activeWorkCount, 0);
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
      overrides: [
        agentDirectoryTransportProvider.overrideWithValue(transport),
        sessionProvider.overrideWith(_SignedInSessionController.new),
      ],
    );
    addTearDown(c.dispose);
    c.read(agentDirectoryProvider);
    await _waitForDirectoryRequests(transport, 1);
    final next = c.read(agentDirectoryProvider.notifier).refresh();
    await _waitForDirectoryRequests(transport, 2);
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
        overrides: [
          agentTransportProvider.overrideWithValue(transport),
          sessionProvider.overrideWith(_SignedOutSessionController.new),
        ],
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
      overrides: [
        agentTransportProvider.overrideWithValue(transport),
        sessionProvider.overrideWith(_SignedOutSessionController.new),
      ],
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
    'clear all closes canonical CharacterSessions before dropping local state',
    () async {
      final transport = RecoveringTransport();
      final c = ProviderContainer(
        overrides: [
          agentTransportProvider.overrideWithValue(transport),
          sessionProvider.overrideWith(_SignedOutSessionController.new),
        ],
      );
      addTearDown(c.dispose);
      final controller = c.read(aiChatProvider.notifier);
      await Future<void>.delayed(Duration.zero);
      await controller.sendText('character-1', 'hello');
      expect(c.read(aiChatProvider).threads, isNotEmpty);

      await controller.clearAll();

      expect(transport.closedSessions, 1);
      expect(c.read(aiChatProvider).threads, isEmpty);
    },
  );

  test('hosted Gateway is the default local connection address', () {
    expect(kAgentBaseUrl, 'https://masanawa-gateway-production.up.railway.app');
  });

  test(
    'Agent transport refreshes an expired production session and retries once',
    () async {
      final adapter = RotatingAuthAdapter();
      final dio = Dio();
      dio.httpClientAdapter = adapter;
      var token = 'expired-token';
      var refreshes = 0;
      final transport = MasanawaAgentDirectoryTransport(
        dio: dio,
        baseUrl: 'https://gateway.test',
        readAccessToken: () => token,
        refreshAccessToken: () async {
          refreshes += 1;
          token = 'fresh-token';
          return token;
        },
      );

      final agents = await transport.loadDirectory();

      expect(refreshes, 1);
      expect(agents.single.displayName, 'Amina');
      expect(adapter.authorizations, [
        'Bearer expired-token',
        'Bearer fresh-token',
      ]);
    },
  );

  test(
    'creator transports use the canonical Gateway route namespace',
    () async {
      final adapter = GatewayContractAdapter();
      final dio = Dio();
      dio.httpClientAdapter = adapter;

      final skills = MasanawaCreatorSkillTransport(
        dio: dio,
        baseUrl: 'https://gateway.test',
        readAccessToken: () => 'private-token',
      );
      await skills.load();
      await skills.setEnabled('skill-version-1', true);

      final economy = MasanawaCreatorEconomyTransport(
        dio: dio,
        baseUrl: 'https://gateway.test',
        readAccessToken: () => 'private-token',
      );
      await economy.load();
      await economy.allocateFloat(10);

      final clone = MasanawaCreatorCloneTransport(
        dio: dio,
        baseUrl: 'https://gateway.test',
        readAccessToken: () => 'private-token',
      );
      await clone.create(
        displayName: 'Clone',
        biography: 'Helpful assistant',
        gender: 'male',
        age: 30,
        avatarBase64: 'aW1hZ2U=',
        avatarMimeType: 'image/png',
        personality: const ['Calm'],
        expertise: const ['General'],
      );

      expect(adapter.requests.map((request) => request.uri.path).toList(), [
        '/creator/skills',
        '/creator/skills',
        '/creator/economy',
        '/creator/float',
        '/creator/clone',
        '/agent/twin/profile',
      ]);
      for (final request in adapter.requests) {
        expect(request.headers['Authorization'], 'Bearer private-token');
        expect(request.uri.path, isNot(startsWith('/v1/creator/')));
      }
    },
  );

  test(
    'chat transport keeps production authorization and waits for server deadline',
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
        'https://gateway.test/agent/sessions/session-1/turn',
      );
      expect(adapter.request!.headers['Authorization'], 'Bearer private-token');
      expect(adapter.request!.receiveTimeout, const Duration(seconds: 75));
      expect(adapter.request!.followRedirects, isFalse);
    },
  );
}
