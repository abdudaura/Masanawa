import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/chat/masana.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/core/providers.dart';
import 'package:masanawa/src/state/ai_chat_state.dart';

/// ApiClient whose AI endpoint always fails — the controller must fall back
/// to the honest on-device reply instead of hanging on "sending".
class _FailingClient extends ApiClient {
  _FailingClient()
      : super(dio: Dio(BaseOptions(baseUrl: 'https://example.test')));

  @override
  Future<String> aiChat(String message, {String? masana}) async {
    throw const ApiException('offline');
  }
}

ProviderContainer _container() => ProviderContainer(
      overrides: [apiClientProvider.overrideWithValue(_FailingClient())],
    );

void main() {
  test('there are five Masana agents with unique ids', () {
    expect(kMasanaAgents, hasLength(5));
    final ids = kMasanaAgents.map((a) => a.id).toSet();
    expect(ids, hasLength(5));
    expect(masanaById('nope').id, 'masanawa');
  });

  test('ensureGreeting seeds the Masana hello once', () async {
    final container = _container();
    addTearDown(container.dispose);
    final notifier = container.read(aiChatProvider.notifier);
    await Future<void>.delayed(Duration.zero);

    notifier.ensureGreeting('labari');
    notifier.ensureGreeting('labari');
    final thread = container.read(aiChatProvider).threads['labari']!;
    expect(thread.messages, hasLength(1));
    expect(thread.messages.single.isUser, isFalse);
    expect(thread.messages.single.text, contains('Labari'));
  });

  test('sendText appends the user message plus a fallback reply', () async {
    final container = _container();
    addTearDown(container.dispose);
    final notifier = container.read(aiChatProvider.notifier);
    await Future<void>.delayed(Duration.zero);

    await notifier.sendText('masanawa', 'hello there');
    final thread = container.read(aiChatProvider).threads['masanawa']!;
    expect(thread.messages, hasLength(2));
    expect(thread.messages[0].isUser, isTrue);
    expect(thread.messages[0].text, 'hello there');
    expect(thread.messages[1].isUser, isFalse);
    expect(container.read(aiChatProvider).sendingIn, isEmpty);
  });

  test('replies to a closed thread raise unread; opening clears it',
      () async {
    final container = _container();
    addTearDown(container.dispose);
    final notifier = container.read(aiChatProvider.notifier);
    await Future<void>.delayed(Duration.zero);

    await notifier.sendText('hakuri', 'my rights?');
    expect(
        container.read(aiChatProvider).threads['hakuri']!.unread, 1);

    notifier.openThread('hakuri');
    expect(container.read(aiChatProvider).threads['hakuri']!.unread, 0);
    expect(container.read(aiChatProvider).openThreadId, 'hakuri');

    notifier.closeThread();
    expect(container.read(aiChatProvider).openThreadId, isNull);
  });

  test('chatList only shows threads with messages, newest first', () async {
    final container = _container();
    addTearDown(container.dispose);
    final notifier = container.read(aiChatProvider.notifier);
    await Future<void>.delayed(Duration.zero);

    expect(container.read(aiChatProvider).chatList, isEmpty);
    await notifier.sendText('lafiya', 'one');
    await notifier.sendText('labari', 'two');
    final list = container.read(aiChatProvider).chatList;
    expect(list.map((t) => t.masanaId), ['labari', 'lafiya']);

    notifier.clearThread('labari');
    expect(
        container.read(aiChatProvider).chatList.map((t) => t.masanaId),
        ['lafiya']);
  });

  test('formatChatTime labels today, yesterday and older days', () {
    final now = DateTime.now();
    expect(formatChatTime(now), formatClock(now));
    expect(
        formatChatTime(now.subtract(const Duration(days: 1))), 'Yesterday');
    final old = DateTime(2026, 5, 12, 9, 30);
    expect(formatChatTime(old), '12/5/26');
  });
}
