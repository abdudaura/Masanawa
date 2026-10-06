enum HomeAssistantRole { gwana, gwani }

enum HomeAssistantAction { chat, voiceNote, liveVoice }

enum HomeQuickService { data, airtime, electricity, tv }

class HomeAssistantCardModel {
  const HomeAssistantCardModel({
    required this.role,
    required this.characterId,
    required this.displayName,
    required this.description,
    this.voiceLabel,
    this.avatarUrl,
    this.isAvailable = true,
  });

  final HomeAssistantRole role;
  final String characterId;
  final String displayName;
  final String description;
  final String? voiceLabel;
  final String? avatarUrl;
  final bool isAvailable;

  String get initials {
    final parts = displayName.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts.first.substring(0, 1) + parts.last.substring(0, 1))
        .toUpperCase();
  }
}

class HomeRoomCardModel {
  const HomeRoomCardModel({
    required this.roomId,
    required this.title,
    required this.description,
    required this.iconKey,
    this.continuationLabel,
    this.isAvailable = true,
  });

  final String roomId;
  final String title;
  final String description;
  final String iconKey;
  final String? continuationLabel;
  final bool isAvailable;
}

class HomeTwinCardModel {
  const HomeTwinCardModel({
    required this.title,
    required this.subtitle,
    required this.hasTwin,
    this.characterId,
    this.publicUrl,
  });

  final String title;
  final String subtitle;
  final bool hasTwin;
  final String? characterId;
  final String? publicUrl;
}

class HomeContinuationModel {
  const HomeContinuationModel({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.kind,
    this.roomId,
    this.characterId,
  });

  final String id;
  final String title;
  final String subtitle;
  final String kind;
  final String? roomId;
  final String? characterId;
}

class HomeSnapshot {
  const HomeSnapshot({
    required this.assistants,
    required this.rooms,
    this.myTwin,
    this.continuations = const [],
  });

  final List<HomeAssistantCardModel> assistants;
  final List<HomeRoomCardModel> rooms;
  final HomeTwinCardModel? myTwin;
  final List<HomeContinuationModel> continuations;

  HomeAssistantCardModel? assistantFor(HomeAssistantRole role) {
    for (final assistant in assistants) {
      if (assistant.role == role) return assistant;
    }
    return null;
  }

  bool get hasMeaningfulContent =>
      assistants.isNotEmpty ||
      rooms.isNotEmpty ||
      myTwin != null ||
      continuations.isNotEmpty;
}

enum HomeLoadStatus { loading, ready, error }

class HomeViewState {
  const HomeViewState._({
    required this.status,
    this.snapshot,
    this.errorMessage,
  });

  const HomeViewState.loading()
      : this._(status: HomeLoadStatus.loading);

  const HomeViewState.ready(HomeSnapshot snapshot)
      : this._(status: HomeLoadStatus.ready, snapshot: snapshot);

  const HomeViewState.error([String? message])
      : this._(
          status: HomeLoadStatus.error,
          errorMessage: message,
        );

  final HomeLoadStatus status;
  final HomeSnapshot? snapshot;
  final String? errorMessage;
}
