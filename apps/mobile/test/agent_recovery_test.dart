import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';
// Platform-interface fakes exercise persistence/connectivity without native plugins.
// ignore: depend_on_referenced_packages
import 'package:path_provider_platform_interface/path_provider_platform_interface.dart';
// ignore: depend_on_referenced_packages
import 'package:connectivity_plus_platform_interface/connectivity_plus_platform_interface.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import 'package:masanawa/src/agents/agent_directory.dart';
import 'package:masanawa/src/agents/agent_directory_cache.dart';
import 'package:masanawa/src/agents/agent_feedback.dart';
import 'package:masanawa/src/agents/agent_session.dart';
import 'package:masanawa/src/agents/agent_shell.dart';
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
  void signOutForTest() => state = const SessionSignedOut();
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
  final sentTexts = <String>[];
  final requestIds = <String?>[];
  int closedSessions = 0;
  final Completer<AgentTurnResult>? pending;
  void Function(AgentTurnReceipt)? acceptedCallback;
  RecoveringTransport({this.pending});
  @override
  Future<AgentSessionBinding> openSession(String id) async =>
      AgentSessionBinding(characterId: id, characterSessionId: 'session-1');
  @override
  Future<AgentTurnResult> sendTurn({
    required AgentSessionBinding binding,
    required String text,
    void Function(String delta)? onTextDelta,
    void Function(AgentTurnReceipt)? onAccepted,
    Future<void> Function(Uint8List pcmChunk)? onAudioPcmChunk,
    String? requestId,
  }) async {
    turns++;
    sentTexts.add(text);
    requestIds.add(requestId);
    acceptedCallback = onAccepted;
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

class AcceptedRecoveryTransport extends RecoveringTransport
    implements AgentShellTransport {
  AcceptedRecoveryTransport({
    required Completer<AgentTurnResult> pending,
    required this.status,
  }) : super(pending: pending);
  final AgentTurnStatus status;
  final statusRequests = <String>[];
  List<AgentHistoryMessage> history = [];
  final shellEvents = StreamController<AgentShellEvent>.broadcast();
  @override
  Future<AgentShellConfig> loadShellConfig(String characterId) async =>
      const AgentShellConfig(
        shellVersion: 1,
        minimumAppVersion: '0.0.0',
        recommendedAppVersion: '0.0.0',
        features: {},
      );
  @override
  Future<List<AgentHistoryMessage>> loadHistory(
    String characterId, {
    int limit = 100,
    String? before,
  }) async => history;
  @override
  Stream<AgentShellEvent> events(String characterId, {String? after}) =>
      shellEvents.stream;
  @override
  Future<AgentTurnStatus> turnStatus(
    String characterId,
    String requestId,
  ) async {
    statusRequests.add(requestId);
    return status;
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class OutboxPathProvider extends PathProviderPlatform {
  OutboxPathProvider(this.path);
  final String path;
  @override
  Future<String?> getApplicationDocumentsPath() async => path;
  @override
  Future<String?> getTemporaryPath() async => path;
}

class OutboxConnectivity extends ConnectivityPlatform {
  bool offline = false;
  final changes = StreamController<List<ConnectivityResult>>.broadcast();
  @override
  Future<List<ConnectivityResult>> checkConnectivity() async => [
    offline ? ConnectivityResult.none : ConnectivityResult.wifi,
  ];
  @override
  Stream<List<ConnectivityResult>> get onConnectivityChanged => changes.stream;
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

  late Directory fixtureDirectory;
  late PathProviderPlatform originalPaths;
  late ConnectivityPlatform originalConnectivity;
  late OutboxConnectivity fixtureConnectivity;
  setUp(() async {
    fixtureDirectory = await Directory.systemTemp.createTemp(
      'masanawa-agent-test-',
    );
    originalPaths = PathProviderPlatform.instance;
    originalConnectivity = ConnectivityPlatform.instance;
    PathProviderPlatform.instance = OutboxPathProvider(fixtureDirectory.path);
    fixtureConnectivity = OutboxConnectivity();
    ConnectivityPlatform.instance = fixtureConnectivity;
  });
  tearDown(() async {
    PathProviderPlatform.instance = originalPaths;
    ConnectivityPlatform.instance = originalConnectivity;
    await fixtureConnectivity.changes.close();
    await fixtureDirectory.delete(recursive: true);
  });

  test(
    'signed-out production transport cannot transmit an unpersisted message',
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
      await controller.sendText('character-1', 'hello');
      expect(transport.turns, 0);
      expect(
        c
            .read(aiChatProvider)
            .threads['character-1']!
            .messages
            .first
            .deliveryStatus,
        'failed',
      );
    },
  );

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
      expect(c.read(agentDirectoryProvider).agents.map((entry) => entry.characterId), [agent.characterId]);
      expect(c.read(agentDirectoryProvider).agents.single.displayName, agent.displayName);
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
          sessionProvider.overrideWith(_SignedInSessionController.new),
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

  test(
    'outgoing bubble exists synchronously and acceptance is not human read',
    () async {
      final pending = Completer<AgentTurnResult>();
      final transport = RecoveringTransport(pending: pending);
      final c = ProviderContainer(
        overrides: [
          agentTransportProvider.overrideWithValue(transport),
          sessionProvider.overrideWith(_SignedInSessionController.new),
        ],
      );
      addTearDown(c.dispose);
      final controller = c.read(aiChatProvider.notifier);
      await Future<void>.delayed(Duration.zero);
      final send = controller.sendText(
        'character-1',
        'hello',
        transportPrompt: 'stable prompt',
      );
      final outgoing = c
          .read(aiChatProvider)
          .threads['character-1']!
          .messages
          .single;
      expect(outgoing.isUser, isTrue);
      expect(outgoing.transportPrompt, 'stable prompt');
      for (var i = 0; i < 200 && transport.acceptedCallback == null; i++) {
        await Future<void>.delayed(const Duration(milliseconds: 10));
      }
      expect(transport.acceptedCallback, isNotNull);
      transport.acceptedCallback!(
        AgentTurnReceipt(requestId: outgoing.requestId!, state: 'pending'),
      );
      expect(
        c
            .read(aiChatProvider)
            .threads['character-1']!
            .messages
            .first
            .deliveryStatus,
        'accepted',
      );
      pending.complete(const AgentTurnResult(text: 'answer'));
      await send;
      final messages = c.read(aiChatProvider).threads['character-1']!.messages;
      expect(messages.where((m) => m.isUser), hasLength(1));
      expect(messages.last.replyToId, outgoing.id);
    },
  );

  for (final status in [
    const AgentTurnStatus(
      state: 'completed',
      reply: 'recovered answer',
      agentRunId: 'run-1',
    ),
    const AgentTurnStatus(state: 'pending'),
  ]) {
    test(
      'accepted interrupted turn reconciles ${status.state} without executing again',
      () async {
        final pending = Completer<AgentTurnResult>();
        final transport = AcceptedRecoveryTransport(
          pending: pending,
          status: status,
        );
        final c = ProviderContainer(
          overrides: [
            agentTransportProvider.overrideWithValue(transport),
            sessionProvider.overrideWith(_SignedInSessionController.new),
          ],
        );
        addTearDown(c.dispose);
        final controller = c.read(aiChatProvider.notifier);
        await Future<void>.delayed(Duration.zero);
        final send = controller.sendText('character-1', 'hello');
        for (var i = 0; i < 200 && transport.acceptedCallback == null; i++) {
          await Future<void>.delayed(const Duration(milliseconds: 10));
        }
        final outgoing = c
            .read(aiChatProvider)
            .threads['character-1']!
            .messages
            .first;
        transport.acceptedCallback!(
          AgentTurnReceipt(requestId: outgoing.requestId!, state: 'pending'),
        );
        pending.completeError(const ApiException('Stream ended unexpectedly'));
        await send;
        expect(transport.turns, 1);
        expect(transport.statusRequests, [outgoing.requestId]);
        final messages = c
            .read(aiChatProvider)
            .threads['character-1']!
            .messages;
        expect(
          messages.first.deliveryStatus,
          status.state == 'completed' ? 'delivered' : 'processing',
        );
        expect(messages.where((m) => m.isUser), hasLength(1));
        expect(c.read(aiChatProvider).sendingIn, isEmpty);
        if (status.state == 'completed') {
          expect(messages.last.text, 'recovered answer');
          expect(messages.last.replyToId, outgoing.id);
          expect(messages.last.requestId, outgoing.requestId);
        } else {
          expect(messages, hasLength(1));
        }
        await controller.retryMessage('character-1', outgoing.id);
        expect(transport.turns, 1);
      },
    );
  }

  test(
    'two simultaneous sends dispatch one visible outgoing message',
    () async {
      final pending = Completer<AgentTurnResult>();
      final transport = RecoveringTransport(pending: pending);
      final c = ProviderContainer(
        overrides: [
          agentTransportProvider.overrideWithValue(transport),
          sessionProvider.overrideWith(_SignedInSessionController.new),
        ],
      );
      addTearDown(c.dispose);
      final controller = c.read(aiChatProvider.notifier);
      await Future<void>.delayed(Duration.zero);
      final first = controller.sendText('character-1', 'first');
      final second = controller.sendText('character-1', 'second');
      for (var i = 0; i < 200 && transport.turns == 0; i++) {
        await Future<void>.delayed(const Duration(milliseconds: 10));
      }
      pending.complete(const AgentTurnResult(text: 'answer'));
      await Future.wait([first, second]);
      expect(transport.turns, 1);
      expect(
        c
            .read(aiChatProvider)
            .threads['character-1']!
            .messages
            .where((m) => m.isUser),
        hasLength(1),
      );
    },
  );

  test('cleared thread rejects late acceptance callbacks', () async {
    final pending = Completer<AgentTurnResult>();
    final transport = RecoveringTransport(pending: pending);
    final c = ProviderContainer(
      overrides: [
        agentTransportProvider.overrideWithValue(transport),
        sessionProvider.overrideWith(_SignedInSessionController.new),
      ],
    );
    addTearDown(c.dispose);
    final controller = c.read(aiChatProvider.notifier);
    await Future<void>.delayed(Duration.zero);
    final send = controller.sendText('character-1', 'hello');
    for (var i = 0; i < 200 && transport.acceptedCallback == null; i++) {
      await Future<void>.delayed(const Duration(milliseconds: 10));
    }
    final requestId = c
        .read(aiChatProvider)
        .threads['character-1']!
        .messages
        .first
        .requestId!;
    controller.clearThread('character-1');
    transport.acceptedCallback!(
      AgentTurnReceipt(requestId: requestId, state: 'pending'),
    );
    pending.complete(const AgentTurnResult(text: 'late'));
    await send;
    expect(c.read(aiChatProvider).threads, isEmpty);
  });

  test('history parses canonical reply source key', () {
    final message = AgentHistoryMessage.fromJson({
      'key': 'assistant:request-1',
      'direction': 'assistant',
      'requestId': 'request-1',
      'text': 'answer',
      'parts': [],
      'createdAt': '2026-01-01T00:00:00Z',
      'replyToKey': 'user:request-1',
    });
    expect(message.replyToKey, 'user:request-1');
  });

  test(
    'outbox preserves transport prompt and request across serialization',
    () {
      final message = AiChatMessage(
        id: 'local-1',
        isUser: true,
        text: 'visible',
        createdAt: DateTime.utc(2026),
        requestId: 'request-1',
        deliveryStatus: 'queued',
        transportPrompt: 'canonical prompt',
      );
      final restored = AiChatMessage.fromJson(message.toJson());
      expect(restored.requestId, message.requestId);
      expect(restored.transportPrompt, message.transportPrompt);
    },
  );

  group('durable outbox recovery', () {
    late Directory directory;
    late PathProviderPlatform previousPaths;
    late ConnectivityPlatform previousConnectivity;
    late OutboxConnectivity connectivity;
    setUp(() async {
      directory = await Directory.systemTemp.createTemp(
        'masanawa-outbox-test-',
      );
      previousPaths = PathProviderPlatform.instance;
      previousConnectivity = ConnectivityPlatform.instance;
      PathProviderPlatform.instance = OutboxPathProvider(directory.path);
      connectivity = OutboxConnectivity();
      ConnectivityPlatform.instance = connectivity;
    });
    tearDown(() async {
      PathProviderPlatform.instance = previousPaths;
      ConnectivityPlatform.instance = previousConnectivity;
      await connectivity.changes.close();
      await directory.delete(recursive: true);
    });

    test(
      'disk failure blocks initial send and retry network execution',
      () async {
        PathProviderPlatform.instance = OutboxPathProvider(
          '${directory.path}/missing/child',
        );
        final transport = RecoveringTransport();
        final c = ProviderContainer(
          overrides: [
            agentTransportProvider.overrideWithValue(transport),
            sessionProvider.overrideWith(_SignedInSessionController.new),
          ],
        );
        addTearDown(c.dispose);
        final controller = c.read(aiChatProvider.notifier);
        await Future<void>.delayed(Duration.zero);
        await controller.sendText('character-1', 'hello');
        final message = c
            .read(aiChatProvider)
            .threads['character-1']!
            .messages
            .first;
        expect(message.deliveryStatus, 'failed');
        expect(transport.turns, 0);
        await controller.retryMessage('character-1', message.id);
        expect(transport.turns, 0);
        expect(
          c
              .read(aiChatProvider)
              .threads['character-1']!
              .messages
              .first
              .deliveryStatus,
          'failed',
        );
      },
    );

    test(
      'restart before server claim recovers saved sending with same key and prompt',
      () async {
        final message = AiChatMessage(
          id: 'local-saved',
          isUser: true,
          text: 'visible',
          createdAt: DateTime.utc(2026),
          deliveryStatus: 'sending',
          requestId: 'request_0199f0d0-0000-7000-8000-000000000001',
          transportPrompt: 'stable prompt',
        );
        final owner = base64Url
            .encode(utf8.encode(_directoryUser.id))
            .replaceAll('=', '');
        await File(
          '${directory.path}/masanawa_threads_v2_$owner.json',
        ).writeAsString(
          jsonEncode([
            ChatThread(
              characterId: 'character-1',
              messages: [
                message,
                AiChatMessage(
                  id: 'stale-stream',
                  isUser: false,
                  text: 'partial',
                  createdAt: DateTime.utc(2026),
                  deliveryStatus: 'streaming',
                  requestId: message.requestId,
                ),
              ],
            ).toJson(),
          ]),
        );
        final pending = Completer<AgentTurnResult>();
        final transport = AcceptedRecoveryTransport(
          pending: pending,
          status: const AgentTurnStatus(state: 'missing'),
        );
        final c = ProviderContainer(
          overrides: [
            agentTransportProvider.overrideWithValue(transport),
            sessionProvider.overrideWith(_SignedInSessionController.new),
          ],
        );
        addTearDown(c.dispose);
        final controller = c.read(aiChatProvider.notifier);
        for (
          var i = 0;
          i < 200 && c.read(aiChatProvider).threads.isEmpty;
          i++
        ) {
          await Future<void>.delayed(const Duration(milliseconds: 10));
        }
        expect(
          c
              .read(aiChatProvider)
              .threads['character-1']!
              .messages
              .first
              .requestId,
          message.requestId,
        );
        await controller.syncFromServer('character-1');
        for (var i = 0; i < 200 && transport.turns == 0; i++) {
          await Future<void>.delayed(const Duration(milliseconds: 10));
        }
        expect(transport.turns, 1);
        expect(transport.requestIds, [message.requestId]);
        expect(transport.sentTexts, ['stable prompt']);
        pending.complete(const AgentTurnResult(text: 'answer'));
        for (
          var i = 0;
          i < 200 && c.read(aiChatProvider).sendingIn.isNotEmpty;
          i++
        ) {
          await Future<void>.delayed(const Duration(milliseconds: 10));
        }
        final recovered = c
            .read(aiChatProvider)
            .threads['character-1']!
            .messages;
        expect(recovered, hasLength(2));
        expect(recovered.last.text, 'answer');
        await transport.shellEvents.close();
      },
    );

    test(
      'restart reconciles a persisted streaming placeholder to the completed reply',
      () async {
        const requestId = 'request_0199f0d0-0000-7000-8000-000000000001';
        final user = AiChatMessage(
          id: 'saved-user',
          isUser: true,
          text: 'hello',
          createdAt: DateTime.utc(2026),
          deliveryStatus: 'accepted',
          requestId: requestId,
        );
        final assistant = AiChatMessage(
          id: 'saved-stream',
          isUser: false,
          text: 'partial',
          createdAt: DateTime.utc(2026, 1, 1, 0, 0, 1),
          deliveryStatus: 'streaming',
          requestId: requestId,
          replyToId: user.id,
        );
        final owner = base64Url
            .encode(utf8.encode(_directoryUser.id))
            .replaceAll('=', '');
        await File(
          '${directory.path}/masanawa_threads_v2_$owner.json',
        ).writeAsString(
          jsonEncode([
            ChatThread(
              characterId: 'character-1',
              messages: [user, assistant],
            ).toJson(),
          ]),
        );
        final transport = AcceptedRecoveryTransport(
          pending: Completer<AgentTurnResult>(),
          status: const AgentTurnStatus(
            state: 'completed',
            reply: 'complete answer',
            agentRunId: 'run-1',
          ),
        );
        final c = ProviderContainer(
          overrides: [
            agentTransportProvider.overrideWithValue(transport),
            sessionProvider.overrideWith(_SignedInSessionController.new),
          ],
        );
        addTearDown(c.dispose);
        final controller = c.read(aiChatProvider.notifier);
        for (
          var i = 0;
          i < 200 && c.read(aiChatProvider).threads.isEmpty;
          i++
        ) {
          await Future<void>.delayed(const Duration(milliseconds: 10));
        }
        await controller.syncFromServer('character-1');
        final messages = c
            .read(aiChatProvider)
            .threads['character-1']!
            .messages;
        expect(transport.turns, 0);
        expect(messages, hasLength(2));
        expect(messages.last.id, assistant.id);
        expect(messages.last.text, 'complete answer');
        expect(messages.last.deliveryStatus, 'delivered');
        expect(messages.last.replyToId, user.id);
        await transport.shellEvents.close();
      },
    );

    for (final cached in [false, true]) {
      test(
        'canonical out-of-order history preserves reply source with cached=$cached',
        () async {
          const requestId = 'request_0199f0d0-0000-7000-8000-000000000001';
          if (cached) {
            final user = AiChatMessage(
              id: 'cached-user',
              isUser: true,
              text: 'visible',
              createdAt: DateTime.utc(2026),
              deliveryStatus: 'accepted',
              requestId: requestId,
              transportPrompt: 'private instruction',
            );
            final assistant = AiChatMessage(
              id: 'cached-assistant',
              isUser: false,
              text: 'old',
              createdAt: DateTime.utc(2026, 1, 1, 0, 0, 1),
              requestId: requestId,
            );
            final owner = base64Url
                .encode(utf8.encode(_directoryUser.id))
                .replaceAll('=', '');
            await File(
              '${directory.path}/masanawa_threads_v2_$owner.json',
            ).writeAsString(
              jsonEncode([
                ChatThread(
                  characterId: 'character-1',
                  messages: [user, assistant],
                ).toJson(),
              ]),
            );
          }
          final transport = AcceptedRecoveryTransport(
            pending: Completer<AgentTurnResult>(),
            status: const AgentTurnStatus(state: 'completed', reply: 'answer'),
          );
          transport.history = [
            AgentHistoryMessage(
              key: 'assistant:$requestId',
              direction: 'assistant',
              requestId: requestId,
              text: 'answer',
              parts: [],
              createdAt: DateTime.utc(2026, 1, 1, 0, 0, 1),
              replyToKey: 'user:$requestId',
            ),
            AgentHistoryMessage(
              key: 'user:$requestId',
              direction: 'user',
              requestId: requestId,
              text: 'private instruction',
              parts: [],
              createdAt: DateTime.utc(2026),
            ),
          ];
          final c = ProviderContainer(
            overrides: [
              agentTransportProvider.overrideWithValue(transport),
              sessionProvider.overrideWith(_SignedInSessionController.new),
            ],
          );
          addTearDown(c.dispose);
          final controller = c.read(aiChatProvider.notifier);
          if (cached) {
            for (
              var i = 0;
              i < 200 && c.read(aiChatProvider).threads.isEmpty;
              i++
            ) {
              await Future<void>.delayed(const Duration(milliseconds: 10));
            }
          }
          await controller.syncFromServer('character-1');
          final messages = c
              .read(aiChatProvider)
              .threads['character-1']!
              .messages;
          expect(messages, hasLength(2));
          expect(messages.last.replyToId, messages.first.id);
          if (cached) {
            expect(messages.first.id, 'cached-user');
            expect(messages.last.id, 'cached-assistant');
            expect(messages.first.text, 'visible');
            expect(messages.first.transportPrompt, 'private instruction');
          }
          final restored = ChatThread.fromJson(
            c.read(aiChatProvider).threads['character-1']!.toJson(),
          );
          expect(restored.messages.last.replyToId, restored.messages.first.id);
          await controller.syncFromServer('character-1');
          expect(
            c
                .read(aiChatProvider)
                .threads['character-1']!
                .messages
                .last
                .replyToId,
            messages.first.id,
          );
          await transport.shellEvents.close();
        },
      );
    }

    test(
      'old history fallback matches request and rejects unrelated canonical reply key',
      () async {
        const requestId = 'request_0199f0d0-0000-7000-8000-000000000001';
        final transport = AcceptedRecoveryTransport(
          pending: Completer<AgentTurnResult>(),
          status: const AgentTurnStatus(state: 'completed', reply: 'answer'),
        );
        transport.history = [
          AgentHistoryMessage(
            key: 'assistant:$requestId',
            direction: 'assistant',
            requestId: requestId,
            text: 'answer',
            parts: [],
            createdAt: DateTime.utc(2026, 1, 1, 0, 0, 1),
          ),
          AgentHistoryMessage(
            key: 'user:$requestId',
            direction: 'user',
            requestId: requestId,
            text: 'question',
            parts: [],
            createdAt: DateTime.utc(2026),
          ),
        ];
        final c = ProviderContainer(
          overrides: [
            agentTransportProvider.overrideWithValue(transport),
            sessionProvider.overrideWith(_SignedInSessionController.new),
          ],
        );
        addTearDown(c.dispose);
        final controller = c.read(aiChatProvider.notifier);
        await controller.syncFromServer('character-1');
        var messages = c.read(aiChatProvider).threads['character-1']!.messages;
        expect(messages.last.replyToId, messages.first.id);
        transport.history[0] = AgentHistoryMessage(
          key: 'assistant:$requestId',
          direction: 'assistant',
          requestId: requestId,
          text: 'answer',
          parts: [],
          createdAt: DateTime.utc(2026, 1, 1, 0, 0, 1),
          replyToKey: 'user:unrelated-request',
        );
        await controller.syncFromServer('character-1');
        messages = c.read(aiChatProvider).threads['character-1']!.messages;
        expect(messages.last.replyToId, isNull);
        await transport.shellEvents.close();
      },
    );

    test(
      'account switch cannot replay second message from old queue snapshot',
      () async {
        connectivity.offline = true;
        final pending = Completer<AgentTurnResult>();
        final transport = RecoveringTransport(pending: pending);
        final c = ProviderContainer(
          overrides: [
            agentTransportProvider.overrideWithValue(transport),
            sessionProvider.overrideWith(_SignedInSessionController.new),
          ],
        );
        addTearDown(c.dispose);
        final controller = c.read(aiChatProvider.notifier);
        await Future<void>.delayed(Duration.zero);
        await controller.sendText('character-1', 'first');
        await controller.sendText('character-1', 'second');
        expect(
          c.read(aiChatProvider).threads['character-1']!.messages,
          hasLength(2),
        );
        connectivity.offline = false;
        controller.openThread('character-1');
        for (var i = 0; i < 200 && transport.turns == 0; i++) {
          await Future<void>.delayed(const Duration(milliseconds: 10));
        }
        expect(transport.turns, 1);
        (c.read(sessionProvider.notifier) as _SignedInSessionController).signOutForTest();
        expect(c.read(sessionProvider), isA<SessionSignedOut>());
        pending.complete(const AgentTurnResult(text: 'old answer'));
        for (var i = 0; i < 20; i++)
          await Future<void>.delayed(const Duration(milliseconds: 10));
        expect(transport.turns, 1);
        expect(c.read(aiChatProvider).threads, isEmpty);
      },
    );
  });

  test(
    'transport replacement releases old reservation and fences late callbacks',
    () async {
      final pending = Completer<AgentTurnResult>();
      final old = RecoveringTransport(pending: pending);
      final replacement = RecoveringTransport();
      final c = ProviderContainer(
        overrides: [
          agentTransportProvider.overrideWithValue(old),
          sessionProvider.overrideWith(_SignedInSessionController.new),
        ],
      );
      addTearDown(c.dispose);
      final controller = c.read(aiChatProvider.notifier);
      await Future<void>.delayed(Duration.zero);
      final send = controller.sendText('character-1', 'hello');
      for (var i = 0; i < 200 && old.acceptedCallback == null; i++)
        await Future<void>.delayed(const Duration(milliseconds: 10));
      final requestId = c
          .read(aiChatProvider)
          .threads['character-1']!
          .messages
          .first
          .requestId!;
      c.updateOverrides([
        agentTransportProvider.overrideWithValue(replacement),
        sessionProvider.overrideWith(_SignedInSessionController.new),
      ]);
      c.read(agentTransportProvider);
      expect(c.read(aiChatProvider).sendingIn, isEmpty);
      old.acceptedCallback!(
        AgentTurnReceipt(requestId: requestId, state: 'pending'),
      );
      pending.complete(const AgentTurnResult(text: 'late old result'));
      await send;
      expect(
        c
            .read(aiChatProvider)
            .threads['character-1']!
            .messages
            .first
            .deliveryStatus,
        isNot('accepted'),
      );
      await controller.sendText('character-1', 'new message');
      expect(replacement.turns, 1);
    },
  );

  test('clearing a thread prevents a late result from recreating it', () async {
    final pending = Completer<AgentTurnResult>();
    final transport = RecoveringTransport(pending: pending);
    final c = ProviderContainer(
      overrides: [
        agentTransportProvider.overrideWithValue(transport),
        sessionProvider.overrideWith(_SignedInSessionController.new),
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
          sessionProvider.overrideWith(_SignedInSessionController.new),
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
