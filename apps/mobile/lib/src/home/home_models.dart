enum HomeAssistantRole { gwana, gwani }

enum HomeAssistantAction { chat, talk, liveVoice }

enum HomeQuickService { data, airtime, electricity, tv, crypto }

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

  factory HomeAssistantCardModel.fromJson(Map<String, dynamic> json) {
    final role = switch (json['role']) {
      'gwana' => HomeAssistantRole.gwana,
      'gwani' => HomeAssistantRole.gwani,
      _ => throw const FormatException('Unknown Home assistant role'),
    };
    return HomeAssistantCardModel(
      role: role,
      characterId: json['characterId'] as String? ?? '',
      displayName: json['displayName'] as String? ?? '',
      description: json['description'] as String? ?? '',
      voiceLabel: json['voiceLabel'] as String?,
      avatarUrl: json['avatarUrl'] as String?,
      isAvailable: json['isAvailable'] != false,
    );
  }

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

  factory HomeRoomCardModel.fromJson(Map<String, dynamic> json) {
    return HomeRoomCardModel(
      roomId: json['roomId'] as String? ?? '',
      title: json['title'] as String? ?? '',
      description: json['description'] as String? ?? '',
      iconKey: json['iconKey'] as String? ?? '',
      continuationLabel: json['continuationLabel'] as String?,
      isAvailable: json['isAvailable'] != false,
    );
  }
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

  factory HomeContinuationModel.fromJson(Map<String, dynamic> json) {
    return HomeContinuationModel(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      subtitle: json['subtitle'] as String? ?? '',
      kind: json['kind'] as String? ?? '',
      roomId: json['roomId'] as String?,
      characterId: json['characterId'] as String?,
    );
  }
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

  factory HomeSnapshot.fromJson(Map<String, dynamic> json) {
    final rawAssistants = json['assistants'];
    final rawRooms = json['rooms'];
    final rawContinuations = json['continuations'];
    return HomeSnapshot(
      assistants: [
        for (final item in rawAssistants is List ? rawAssistants : const [])
          if (item is Map)
            HomeAssistantCardModel.fromJson(item.cast<String, dynamic>()),
      ],
      rooms: [
        for (final item in rawRooms is List ? rawRooms : const [])
          if (item is Map)
            HomeRoomCardModel.fromJson(item.cast<String, dynamic>()),
      ],
      continuations: [
        for (final item
            in rawContinuations is List ? rawContinuations : const [])
          if (item is Map)
            HomeContinuationModel.fromJson(item.cast<String, dynamic>()),
      ],
    );
  }

  HomeSnapshot withTwin(HomeTwinCardModel twin) => HomeSnapshot(
        assistants: assistants,
        rooms: rooms,
        myTwin: twin,
        continuations: continuations,
      );

  HomeSnapshot withContinuations(List<HomeContinuationModel> next) =>
      HomeSnapshot(
        assistants: assistants,
        rooms: rooms,
        myTwin: myTwin,
        continuations: List.unmodifiable(next),
      );

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
