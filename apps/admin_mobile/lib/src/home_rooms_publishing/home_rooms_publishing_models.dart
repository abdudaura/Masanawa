enum PublishingMutationKind {
  setNewsCategoryVisibility,
  setHomeRoomVisibility,
  reorderHomeRoom,
  pinNewsItem,
  updateAssistantPresentation,
}

class StoryRadioAdminItem {
  const StoryRadioAdminItem({
    required this.seriesId,
    required this.title,
    required this.published,
    required this.sortOrder,
  });

  final String seriesId;
  final String title;
  final bool published;
  final int sortOrder;

  factory StoryRadioAdminItem.fromJson(Map<String, dynamic> json) {
    final id = json['seriesId'];
    final title = json['title'];
    final published = json['published'];
    final sortOrder = json['sortOrder'];
    if (id is! String ||
        id.trim().isEmpty ||
        title is! String ||
        title.trim().isEmpty ||
        published is! bool ||
        sortOrder is! int ||
        sortOrder < 0) {
      throw const FormatException('Invalid Story Radio admin item');
    }
    return StoryRadioAdminItem(
      seriesId: id,
      title: title,
      published: published,
      sortOrder: sortOrder,
    );
  }
}

class NewsCategoryAdminItem {
  const NewsCategoryAdminItem({
    required this.categoryId,
    required this.label,
    required this.visible,
    required this.sortOrder,
    required this.pinnedItemId,
    required this.revision,
  });

  final String categoryId;
  final String label;
  final bool visible;
  final int sortOrder;
  final String? pinnedItemId;
  final int revision;

  factory NewsCategoryAdminItem.fromJson(Map<String, dynamic> json) {
    final id = json['categoryId'];
    final label = json['label'];
    final visible = json['visible'];
    final sortOrder = json['sortOrder'];
    final pinned = json['pinnedItemId'];
    final revision = json['revision'];
    if (id is! String ||
        id.trim().isEmpty ||
        label is! String ||
        label.trim().isEmpty ||
        visible is! bool ||
        sortOrder is! int ||
        sortOrder < 0 ||
        (pinned != null && pinned is! String) ||
        revision is! int ||
        revision < 1) {
      throw const FormatException('Invalid News category admin item');
    }
    return NewsCategoryAdminItem(
      categoryId: id,
      label: label,
      visible: visible,
      sortOrder: sortOrder,
      pinnedItemId: pinned as String?,
      revision: revision,
    );
  }
}

class HomeRoomAdminItem {
  const HomeRoomAdminItem({
    required this.roomKey,
    required this.label,
    required this.visible,
    required this.sortOrder,
    required this.revision,
  });

  final String roomKey;
  final String label;
  final bool visible;
  final int sortOrder;
  final int revision;

  factory HomeRoomAdminItem.fromJson(Map<String, dynamic> json) {
    final key = json['roomKey'];
    final label = json['label'];
    final visible = json['visible'];
    final sortOrder = json['sortOrder'];
    final revision = json['revision'];
    if (key is! String ||
        key.trim().isEmpty ||
        label is! String ||
        label.trim().isEmpty ||
        visible is! bool ||
        sortOrder is! int ||
        sortOrder < 0 ||
        revision is! int ||
        revision < 1) {
      throw const FormatException('Invalid Home Room admin item');
    }
    return HomeRoomAdminItem(
      roomKey: key,
      label: label,
      visible: visible,
      sortOrder: sortOrder,
      revision: revision,
    );
  }
}

class AssistantHomePresentation {
  const AssistantHomePresentation({
    required this.characterId,
    required this.displayName,
    required this.position,
    required this.visible,
    required this.revision,
  });

  final String characterId;
  final String displayName;
  final String position;
  final bool visible;
  final int revision;

  factory AssistantHomePresentation.fromJson(Map<String, dynamic> json) {
    final characterId = json['characterId'];
    final displayName = json['displayName'];
    final position = json['position'];
    final visible = json['visible'];
    final revision = json['revision'];
    if (characterId is! String ||
        characterId.trim().isEmpty ||
        displayName is! String ||
        displayName.trim().isEmpty ||
        (position != 'left' && position != 'right') ||
        visible is! bool ||
        revision is! int ||
        revision < 1) {
      throw const FormatException('Invalid assistant Home presentation');
    }
    return AssistantHomePresentation(
      characterId: characterId,
      displayName: displayName,
      position: position,
      visible: visible,
      revision: revision,
    );
  }
}

class HomeRoomsPublishingProjection {
  const HomeRoomsPublishingProjection({
    required this.storySeries,
    required this.newsCategories,
    required this.homeRooms,
    required this.assistants,
  });

  final List<StoryRadioAdminItem> storySeries;
  final List<NewsCategoryAdminItem> newsCategories;
  final List<HomeRoomAdminItem> homeRooms;
  final List<AssistantHomePresentation> assistants;

  factory HomeRoomsPublishingProjection.fromJson(Map<String, dynamic> json) {
    final story = json['storySeries'];
    final news = json['newsCategories'];
    final rooms = json['homeRooms'];
    final assistants = json['assistants'];
    if (story is! List ||
        news is! List ||
        rooms is! List ||
        assistants is! List) {
      throw const FormatException('Invalid Home/Rooms publishing projection');
    }
    final parsedStory = [
      for (final item in story)
        if (item is Map)
          StoryRadioAdminItem.fromJson(item.cast<String, dynamic>()),
    ];
    final parsedNews = [
      for (final item in news)
        if (item is Map)
          NewsCategoryAdminItem.fromJson(item.cast<String, dynamic>()),
    ];
    final parsedRooms = [
      for (final item in rooms)
        if (item is Map)
          HomeRoomAdminItem.fromJson(item.cast<String, dynamic>()),
    ];
    final parsedAssistants = [
      for (final item in assistants)
        if (item is Map)
          AssistantHomePresentation.fromJson(item.cast<String, dynamic>()),
    ];
    if (parsedStory.length != story.length ||
        parsedNews.length != news.length ||
        parsedRooms.length != rooms.length ||
        parsedAssistants.length != assistants.length) {
      throw const FormatException('Invalid publishing list entry');
    }
    return HomeRoomsPublishingProjection(
      storySeries: parsedStory,
      newsCategories: parsedNews,
      homeRooms: parsedRooms,
      assistants: parsedAssistants,
    );
  }
}

class PublishingMutationIntent {
  const PublishingMutationIntent({
    required this.kind,
    required this.targetId,
    required this.expectedRevision,
    this.visible,
    this.sortOrder,
    this.pinnedItemId,
    this.displayName,
    this.position,
  });

  final PublishingMutationKind kind;
  final String targetId;
  final int expectedRevision;
  final bool? visible;
  final int? sortOrder;
  final String? pinnedItemId;
  final String? displayName;
  final String? position;

  static String _target(String value) {
    final target = value.trim();
    if (target.isEmpty) throw ArgumentError('targetId must not be empty');
    return target;
  }

  static int _revision(int value) {
    if (value < 1) throw ArgumentError('expectedRevision must be positive');
    return value;
  }

  factory PublishingMutationIntent.setVisibility({
    required PublishingMutationKind kind,
    required String targetId,
    required bool visible,
    required int expectedRevision,
  }) {
    if (kind != PublishingMutationKind.setNewsCategoryVisibility &&
        kind != PublishingMutationKind.setHomeRoomVisibility) {
      throw ArgumentError('Invalid visibility mutation kind');
    }
    return PublishingMutationIntent(
      kind: kind,
      targetId: _target(targetId),
      visible: visible,
      expectedRevision: _revision(expectedRevision),
    );
  }

  factory PublishingMutationIntent.reorderRoom({
    required String roomKey,
    required int sortOrder,
    required int expectedRevision,
  }) {
    if (sortOrder < 0) throw ArgumentError('sortOrder must be non-negative');
    return PublishingMutationIntent(
      kind: PublishingMutationKind.reorderHomeRoom,
      targetId: _target(roomKey),
      sortOrder: sortOrder,
      expectedRevision: _revision(expectedRevision),
    );
  }

  factory PublishingMutationIntent.pinNews({
    required String categoryId,
    required String? itemId,
    required int expectedRevision,
  }) {
    final pinned = itemId?.trim();
    if (pinned != null && pinned.isEmpty) {
      throw ArgumentError('itemId must be null or non-empty');
    }
    return PublishingMutationIntent(
      kind: PublishingMutationKind.pinNewsItem,
      targetId: _target(categoryId),
      pinnedItemId: pinned,
      expectedRevision: _revision(expectedRevision),
    );
  }

  factory PublishingMutationIntent.updateAssistant({
    required String characterId,
    required String displayName,
    required String position,
    required bool visible,
    required int expectedRevision,
  }) {
    if (position != 'left' && position != 'right') {
      throw ArgumentError('Assistant position must be left or right');
    }
    final name = displayName.trim();
    if (name.isEmpty) throw ArgumentError('displayName must not be empty');
    return PublishingMutationIntent(
      kind: PublishingMutationKind.updateAssistantPresentation,
      targetId: _target(characterId),
      displayName: name,
      position: position,
      visible: visible,
      expectedRevision: _revision(expectedRevision),
    );
  }
}
