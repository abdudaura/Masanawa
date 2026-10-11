import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/chat/chat_format.dart';
import 'package:masanawa/src/agents/agent_session.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/core/providers.dart';
import 'package:masanawa/src/state/ai_chat_state.dart';
import 'package:masanawa/src/state/session_state.dart';

class _FailingClient extends ApiClient {
  _FailingClient()
    : super(dio: Dio(BaseOptions(baseUrl: 'https://example.test')));

  @override
  Future<String> aiChat(String message, {String? masana}) async {
    throw const ApiException('offline');
  }
}

class _SignedOutSessionController extends SessionController {
  @override
  SessionState build() => const SessionSignedOut();
}

ProviderContainer _container() {
  final client = _FailingClient();
  return ProviderContainer(overrides: [
    apiClientProvider.overrideWithValue(client),
    agentTransportProvider.overrideWithValue(PreviewAgentTransport(
      sendPreview: (message, characterId) => client.aiChat(message, masana: characterId),
    )),
    sessionProvider.overrideWith(_SignedOutSessionController.new),
  ]);
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const secureStorage = MethodChannel(
    'plugins.it_nomads.com/flutter_secure_storage',
  );

  setUp(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(secureStorage, (call) async {
      switch (call.method) {
        case 'read':
          return null;
        case 'write':
        case 'delete':
        case 'deleteAll':
          return null;
        case 'containsKey':
          return false;
        case 'readAll':
          return <String, String>{};
      }
      return null;
    });
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(secureStorage, null);
  });
  test('chat threads are keyed by arbitrary Character IDs', () async {
    final container = _container();
    addTearDown(container.dispose);
    final notifier = container.read(aiChatProvider.notifier);
    await Future<void>.delayed(Duration.zero);

    await notifier.sendText('character-any-admin-configures', 'hello there');
    final thread = container
        .read(aiChatProvider)
        .threads['character-any-admin-configures']!;
    expect(thread.characterId, 'character-any-admin-configures');
    expect(thread.messages, hasLength(2));
    expect(thread.messages.first.text, 'hello there');
  });

  test('server-configured greeting is seeded once', () async {
    final container = _container();
    addTearDown(container.dispose);
    final notifier = container.read(aiChatProvider.notifier);
    await Future<void>.delayed(Duration.zero);

    notifier.seedGreeting('character-1', 'Hello from the configured agent');
    notifier.seedGreeting('character-1', 'This should not replace it');
    final thread = container.read(aiChatProvider).threads['character-1']!;
    expect(thread.messages, hasLength(1));
    expect(thread.messages.single.text, 'Hello from the configured agent');
  });

  test('runtime failure gives an honest local status reply', () async {
    final container = _container();
    addTearDown(container.dispose);
    final notifier = container.read(aiChatProvider.notifier);
    await Future<void>.delayed(Duration.zero);

    await notifier.sendText('character-2', 'hello');
    final thread = container.read(aiChatProvider).threads['character-2']!;
    expect(thread.messages, hasLength(2));
    expect(thread.messages.last.isUser, isFalse);
    expect(
      thread.messages.last.text,
      'I couldn’t respond just now. Please try again.',
    );
    expect(container.read(aiChatProvider).sendingIn, isEmpty);
  });

  test('closed-thread replies raise unread and opening clears it', () async {
    final container = _container();
    addTearDown(container.dispose);
    final notifier = container.read(aiChatProvider.notifier);
    await Future<void>.delayed(Duration.zero);

    await notifier.sendText('character-3', 'status?');
    expect(container.read(aiChatProvider).threads['character-3']!.unread, 1);

    notifier.openThread('character-3');
    expect(container.read(aiChatProvider).threads['character-3']!.unread, 0);
    expect(container.read(aiChatProvider).openThreadId, 'character-3');
  });

  test('chatList works with any configured Character IDs', () async {
    final container = _container();
    addTearDown(container.dispose);
    final notifier = container.read(aiChatProvider.notifier);
    await Future<void>.delayed(Duration.zero);

    expect(container.read(aiChatProvider).chatList, isEmpty);
    await notifier.sendText('character-a', 'one');
    await notifier.sendText('character-b', 'two');
    final ids = container
        .read(aiChatProvider)
        .chatList
        .map((t) => t.characterId)
        .toSet();
    expect(ids, {'character-a', 'character-b'});

    notifier.clearThread('character-b');
    expect(container.read(aiChatProvider).chatList.map((t) => t.characterId), [
      'character-a',
    ]);
  });

  test('formatChatTime labels today, yesterday and older days', () {
    final now = DateTime.now();
    expect(formatChatTime(now), formatClock(now));
    expect(formatChatTime(now.subtract(const Duration(days: 1))), 'Yesterday');
    final old = DateTime(2026, 5, 12, 9, 30);
    expect(formatChatTime(old), '12/5/26');
  });
}
