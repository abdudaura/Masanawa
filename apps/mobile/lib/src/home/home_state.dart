import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/providers.dart';
import '../state/ai_chat_state.dart';
import '../state/my_twin_state.dart';
import '../state/session_state.dart';
import 'home_models.dart';


List<HomeContinuationModel> homeAssistantChatContinuations(
  HomeSnapshot snapshot,
  AiChatState chat, {
  int limit = 3,
}) {
  final assistantIds = {
    for (final assistant in snapshot.assistants)
      assistant.characterId: assistant,
  };
  final continuations = <HomeContinuationModel>[];
  for (final thread in chat.chatList) {
    final assistant = assistantIds[thread.characterId];
    if (assistant == null || thread.messages.isEmpty) continue;
    final title = thread.title?.trim();
    final last = thread.messages.last;
    continuations.add(
      HomeContinuationModel(
        id: 'chat:' + thread.characterId,
        title: title == null || title.isEmpty
            ? 'Continue with ' + assistant.displayName
            : title,
        subtitle: last.text.trim().isEmpty
            ? 'Continue your conversation'
            : last.text.trim(),
        kind: 'conversation',
        characterId: thread.characterId,
      ),
    );
    if (continuations.length == limit) break;
  }
  return List.unmodifiable(continuations);
}

class HomeController extends AsyncNotifier<HomeSnapshot> {
  @override
  Future<HomeSnapshot> build() async {
    final signedIn = ref.watch(isSignedInProvider);
    ref.watch(apiClientProvider);
    ref.watch(myTwinProvider);
    final chat = ref.watch(aiChatProvider);
    if (!signedIn) {
      return const HomeSnapshot(assistants: [], rooms: []);
    }
    return _load(chat);
  }

  Future<HomeSnapshot> _load(AiChatState chat) async {
    final client = ref.read(apiClientProvider);
    final response = await client.dio.get<Map<String, dynamic>>('/home');
    final data = response.data;
    if (data == null) {
      throw StateError('Home projection is unavailable');
    }

    var snapshot = HomeSnapshot.fromJson(data);
    final twin = await ref.read(myTwinProvider.future);
    snapshot = snapshot.withTwin(
      HomeTwinCardModel(
        title: 'My Twin',
        subtitle: twin != null && twin.hasTwin
            ? 'Teach, manage and share your Twin'
            : 'Create your personal AI Twin',
        hasTwin: twin != null && twin.hasTwin,
        characterId: twin?.characterId,
        publicUrl: twin?.publicUrl,
      ),
    );

    final merged = <HomeContinuationModel>[];
    final seen = <String>{};
    for (final item in [
      ...snapshot.continuations,
      ...homeAssistantChatContinuations(snapshot, chat),
    ]) {
      if (seen.add(item.id)) merged.add(item);
      if (merged.length == 4) break;
    }
    return snapshot.withContinuations(List.unmodifiable(merged));
  }

  Future<void> refresh() async {
    if (!ref.read(isSignedInProvider)) return;
    state = const AsyncLoading();
    state = await AsyncValue.guard(() => _load(ref.read(aiChatProvider)));
  }
}

final homeProvider = AsyncNotifierProvider<HomeController, HomeSnapshot>(
  HomeController.new,
);
