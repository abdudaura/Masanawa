import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../agents/agent_directory.dart';
import '../core/providers.dart';
import '../state/agent_directory_state.dart';
import '../state/my_twin_state.dart';
import '../state/session_state.dart';
import 'home_models.dart';

class HomeController extends AsyncNotifier<HomeSnapshot> {
  @override
  Future<HomeSnapshot> build() async {
    final signedIn = ref.watch(isSignedInProvider);
    ref.watch(apiClientProvider);
    ref.watch(agentDirectoryProvider);
    ref.watch(myTwinProvider);
    if (!signedIn) {
      return const HomeSnapshot(assistants: [], rooms: []);
    }
    return _load();
  }

  Future<HomeSnapshot> _load() async {
    HomeSnapshot snapshot;
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.get<Map<String, dynamic>>('/home');
      final data = response.data;
      if (data == null) throw StateError('home_unavailable');
      snapshot = HomeSnapshot.fromJson(data);
    } catch (_) {
      // Home is a presentation surface, not a service authority. Keep the
      // essential shell usable from the cached/canonical Agent directory when
      // the optional /home projection is temporarily unavailable.
      var directory = ref.read(agentDirectoryProvider);
      if (directory.agents.isEmpty && !directory.loading) {
        await ref.read(agentDirectoryProvider.notifier).refresh();
        directory = ref.read(agentDirectoryProvider);
      }
      snapshot = HomeSnapshot(
        assistants: _assistants(directory.agents),
        rooms: _fallbackRooms,
      );
    }

    HomeTwinCardModel? twinCard;
    try {
      final twin = await ref.read(myTwinProvider.future);
      twinCard = HomeTwinCardModel(
        title: 'My Twin',
        subtitle: '',
        hasTwin: twin != null && twin.hasTwin,
        characterId: twin?.characterId,
        publicUrl: twin?.publicUrl,
      );
    } catch (_) {
      // A Twin projection failure must never blank the whole Home surface.
    }

    return HomeSnapshot(
      assistants: snapshot.assistants,
      rooms: snapshot.rooms.isEmpty ? _fallbackRooms : snapshot.rooms,
      myTwin: twinCard,
      // Conversation history intentionally lives under Activity.
      continuations: const [],
    );
  }

  List<HomeAssistantCardModel> _assistants(
    List<AgentDirectoryEntry> agents,
  ) {
    AgentDirectoryEntry? named(String name, String voice) {
      for (final agent in agents) {
        if (!agent.supportAgent) continue;
        if (agent.displayName.trim().toLowerCase() == name ||
            (agent.voiceName ?? '').trim().toLowerCase() == voice) {
          return agent;
        }
      }
      return null;
    }

    HomeAssistantCardModel? project(
      HomeAssistantRole role,
      String name,
      String voice,
    ) {
      final agent = named(name, voice);
      if (agent == null) return null;
      return HomeAssistantCardModel(
        role: role,
        characterId: agent.characterId,
        displayName: agent.displayName,
        description: agent.about,
        voiceLabel: agent.voiceName,
        avatarUrl: agent.avatarUrl,
        isAvailable: agent.presence != AgentPresence.offline,
      );
    }

    return [
      if (project(HomeAssistantRole.gwani, 'gwani', 'bodi') case final value?)
        value,
      if (project(HomeAssistantRole.gwana, 'gwana', 'sulafat') case final value?)
        value,
    ];
  }

  Future<void> refresh() async {
    if (!ref.read(isSignedInProvider)) return;
    state = const AsyncLoading();
    await ref.read(agentDirectoryProvider.notifier).refresh().catchError((_) {});
    state = await AsyncValue.guard(_load);
  }
}

const _fallbackRooms = <HomeRoomCardModel>[
  HomeRoomCardModel(
    roomId: 'room.internet-cafe',
    title: 'Internet Cafe',
    description: '',
    iconKey: 'internet_cafe',
  ),
  HomeRoomCardModel(
    roomId: 'room.study-center',
    title: 'Study',
    description: '',
    iconKey: 'study',
  ),
  HomeRoomCardModel(
    roomId: 'room.story-radio',
    title: 'Audio Stories',
    description: '',
    iconKey: 'story_radio',
    isAvailable: false,
  ),
  HomeRoomCardModel(
    roomId: 'room.news',
    title: 'News',
    description: '',
    iconKey: 'news',
    isAvailable: false,
  ),
  HomeRoomCardModel(
    roomId: 'room.work-business',
    title: 'Work & Business',
    description: '',
    iconKey: 'work',
    isAvailable: false,
  ),
  HomeRoomCardModel(
    roomId: 'room.research-answers',
    title: 'Research',
    description: '',
    iconKey: 'research',
    isAvailable: false,
  ),
];

final homeProvider = AsyncNotifierProvider<HomeController, HomeSnapshot>(
  HomeController.new,
);
