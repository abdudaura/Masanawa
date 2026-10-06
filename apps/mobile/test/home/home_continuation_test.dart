import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/home/home_models.dart';
import 'package:masanawa/src/home/home_state.dart';
import 'package:masanawa/src/state/ai_chat_state.dart';

void main() {
  const snapshot = HomeSnapshot(
    assistants: [
      HomeAssistantCardModel(
        role: HomeAssistantRole.gwana,
        characterId: 'character-gwana',
        displayName: 'Gwana',
        description: 'Assistant',
      ),
      HomeAssistantCardModel(
        role: HomeAssistantRole.gwani,
        characterId: 'character-gwani',
        displayName: 'Gwani',
        description: 'Assistant',
      ),
    ],
    rooms: [],
  );

  AiChatMessage message(String id, String text, DateTime at) => AiChatMessage(
        id: id,
        isUser: false,
        text: text,
        createdAt: at,
      );

  test('projects recent assistant chats in recency order', () {
    final chat = AiChatState(
      threads: {
        'character-gwana': ChatThread(
          characterId: 'character-gwana',
          updatedAt: DateTime.utc(2026, 10, 6, 9),
          messages: [
            message('m1', 'Earlier reply', DateTime.utc(2026, 10, 6, 9)),
          ],
        ),
        'character-gwani': ChatThread(
          characterId: 'character-gwani',
          title: 'Business proposal',
          updatedAt: DateTime.utc(2026, 10, 6, 10),
          messages: [
            message('m2', 'Latest reply', DateTime.utc(2026, 10, 6, 10)),
          ],
        ),
      },
    );

    final result = homeAssistantChatContinuations(snapshot, chat);

    expect(result, hasLength(2));
    expect(result.first.characterId, 'character-gwani');
    expect(result.first.title, 'Business proposal');
    expect(result.first.subtitle, 'Latest reply');
    expect(result.last.title, 'Continue with Gwana');
  });

  test('ignores non-Home characters and archived or empty threads', () {
    final chat = AiChatState(
      threads: {
        'character-other': ChatThread(
          characterId: 'character-other',
          updatedAt: DateTime.utc(2026, 10, 6, 12),
          messages: [
            message('other', 'Should not show', DateTime.utc(2026, 10, 6, 12)),
          ],
        ),
        'character-gwana': ChatThread(
          characterId: 'character-gwana',
          archived: true,
          updatedAt: DateTime.utc(2026, 10, 6, 11),
          messages: [
            message('archived', 'Archived', DateTime.utc(2026, 10, 6, 11)),
          ],
        ),
        'character-gwani': ChatThread(
          characterId: 'character-gwani',
          updatedAt: DateTime.utc(2026, 10, 6, 10),
        ),
      },
    );

    expect(homeAssistantChatContinuations(snapshot, chat), isEmpty);
  });
  test('preserves server continuations before local assistant chats', () {
    final serverSnapshot = HomeSnapshot(
      assistants: snapshot.assistants,
      rooms: [],
      continuations: [
        HomeContinuationModel(
          id: 'story-radio:episode-1',
          title: 'Continue Night Stories',
          subtitle: 'Episode 2 · 05:12 remaining',
          kind: 'story-radio',
          roomId: 'room.story-radio',
        ),
        HomeContinuationModel(
          id: 'chat:character-gwani',
          title: 'Server conversation',
          subtitle: 'Keep this server projection',
          kind: 'conversation',
          characterId: 'character-gwani',
        ),
      ],
    );
    final chat = AiChatState(
      threads: {
        'character-gwani': ChatThread(
          characterId: 'character-gwani',
          updatedAt: DateTime.utc(2026, 10, 6, 10),
          messages: [
            message('m3', 'Local duplicate', DateTime.utc(2026, 10, 6, 10)),
          ],
        ),
        'character-gwana': ChatThread(
          characterId: 'character-gwana',
          updatedAt: DateTime.utc(2026, 10, 6, 9),
          messages: [
            message('m4', 'Local unique', DateTime.utc(2026, 10, 6, 9)),
          ],
        ),
      },
    );

    final result = mergeHomeContinuations(serverSnapshot, chat);

    expect(result, hasLength(3));
    expect(result[0].id, 'story-radio:episode-1');
    expect(result[0].kind, 'story-radio');
    expect(result[1].id, 'chat:character-gwani');
    expect(result[1].title, 'Server conversation');
    expect(result[2].id, 'chat:character-gwana');
  });

}
