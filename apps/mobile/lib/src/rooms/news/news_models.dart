import 'dart:collection';

/// Read-only server projection for the News Room.
///
/// This model deliberately contains no acquisition, publishing, or model-generation
/// behavior. Current-news truth must be produced by admitted evidence/source tooling
/// and projected here by the shared integration owner.
class NewsRoomProjection {
  NewsRoomProjection({
    required this.categories,
    required this.items,
    this.featuredItemId,
    this.updatedAt,
  });

  factory NewsRoomProjection.fromJson(Map<String, dynamic> json) {
    final categories = _listOfMaps(json['categories'])
        .map(NewsCategory.fromJson)
        .where((category) => category.visible)
        .toList(growable: true)
      ..sort((a, b) => a.order.compareTo(b.order));
    final visibleCategoryIds = categories.map((e) => e.id).toSet();
    final items = _listOfMaps(json['items'])
        .map(NewsItem.fromJson)
        .where(
          (item) =>
              item.visible &&
              (item.categoryId == null ||
                  visibleCategoryIds.contains(item.categoryId)),
        )
        .toList(growable: false);

    final featured = _nullableString(json['featuredItemId']);
    if (featured != null && !items.any((item) => item.id == featured)) {
      throw const FormatException(
        'featuredItemId must reference a visible News item',
      );
    }

    return NewsRoomProjection(
      categories: UnmodifiableListView(categories),
      items: UnmodifiableListView(items),
      featuredItemId: featured,
      updatedAt: _nullableDateTime(json['updatedAt']),
    );
  }

  final List<NewsCategory> categories;
  final List<NewsItem> items;
  final String? featuredItemId;
  final DateTime? updatedAt;

  NewsItem? get featuredItem {
    final id = featuredItemId;
    if (id == null) return null;
    for (final item in items) {
      if (item.id == id) return item;
    }
    return null;
  }

  List<NewsItem> itemsForCategory(String? categoryId) {
    if (categoryId == null) return items;
    return items
        .where((item) => item.categoryId == categoryId)
        .toList(growable: false);
  }
}

class NewsCategory {
  const NewsCategory({
    required this.id,
    required this.label,
    required this.order,
    required this.visible,
  });

  factory NewsCategory.fromJson(Map<String, dynamic> json) {
    return NewsCategory(
      id: _requiredString(json['id'], 'category.id'),
      label: _requiredString(json['label'], 'category.label'),
      order: _nonNegativeInt(json['order'], 'category.order'),
      visible: json['visible'] is bool ? json['visible'] as bool : true,
    );
  }

  final String id;
  final String label;
  final int order;
  final bool visible;
}

class NewsItem {
  NewsItem({
    required this.id,
    required this.title,
    required this.summary,
    required this.body,
    required this.sources,
    required this.evidenceRefs,
    required this.publishedAt,
    required this.visible,
    required this.pinned,
    this.categoryId,
    this.imageUrl,
    this.audio,
  });

  factory NewsItem.fromJson(Map<String, dynamic> json) {
    final sources = _listOfMaps(json['sources'])
        .map(NewsSource.fromJson)
        .toList(growable: false);
    if (sources.isEmpty) {
      throw const FormatException(
        'News items must include at least one source; unsourced current news is not renderable',
      );
    }

    return NewsItem(
      id: _requiredString(json['id'], 'item.id'),
      title: _requiredString(json['title'], 'item.title'),
      summary: _requiredString(json['summary'], 'item.summary'),
      body: _requiredString(json['body'], 'item.body'),
      categoryId: _nullableString(json['categoryId']),
      imageUrl: _nullableHttpsUri(json['imageUrl'], 'item.imageUrl'),
      sources: UnmodifiableListView(sources),
      evidenceRefs: UnmodifiableListView(
        _listOfStrings(json['evidenceRefs'], 'item.evidenceRefs'),
      ),
      audio: json['audio'] is Map<String, dynamic>
          ? NewsAudioPresentation.fromJson(
              json['audio'] as Map<String, dynamic>,
            )
          : null,
      publishedAt: _requiredDateTime(json['publishedAt'], 'item.publishedAt'),
      visible: json['visible'] is bool ? json['visible'] as bool : true,
      pinned: json['pinned'] is bool ? json['pinned'] as bool : false,
    );
  }

  final String id;
  final String title;
  final String summary;
  final String body;
  final String? categoryId;
  final Uri? imageUrl;
  final List<NewsSource> sources;
  final List<String> evidenceRefs;
  final NewsAudioPresentation? audio;
  final DateTime publishedAt;
  final bool visible;
  final bool pinned;
}

class NewsSource {
  const NewsSource({
    required this.label,
    required this.url,
    this.publisher,
  });

  factory NewsSource.fromJson(Map<String, dynamic> json) {
    return NewsSource(
      label: _requiredString(json['label'], 'source.label'),
      url: _requiredHttpsUri(json['url'], 'source.url'),
      publisher: _nullableString(json['publisher']),
    );
  }

  final String label;
  final Uri url;
  final String? publisher;
}

class NewsAudioPresentation {
  const NewsAudioPresentation({
    required this.assetUrl,
    this.durationSeconds,
  });

  factory NewsAudioPresentation.fromJson(Map<String, dynamic> json) {
    final duration = json['durationSeconds'];
    if (duration != null && (duration is! int || duration <= 0)) {
      throw const FormatException(
        'audio.durationSeconds must be a positive integer',
      );
    }
    return NewsAudioPresentation(
      assetUrl: _requiredHttpsUri(json['assetUrl'], 'audio.assetUrl'),
      durationSeconds: duration as int?,
    );
  }

  final Uri assetUrl;
  final int? durationSeconds;
}

List<Map<String, dynamic>> _listOfMaps(Object? value) {
  if (value == null) return const [];
  if (value is! List) throw const FormatException('Expected a list');
  return value.map((entry) {
    if (entry is! Map<String, dynamic>) {
      throw const FormatException('Expected a list of objects');
    }
    return entry;
  }).toList(growable: false);
}

List<String> _listOfStrings(Object? value, String field) {
  if (value == null) return const [];
  if (value is! List) throw FormatException('$field must be a list');
  return value
      .map((entry) => _requiredString(entry, field))
      .toList(growable: false);
}

String _requiredString(Object? value, String field) {
  if (value is! String || value.trim().isEmpty) {
    throw FormatException('$field is required');
  }
  return value.trim();
}

String? _nullableString(Object? value) {
  if (value == null) return null;
  if (value is! String) throw const FormatException('Expected a string');
  final normalized = value.trim();
  return normalized.isEmpty ? null : normalized;
}

int _nonNegativeInt(Object? value, String field) {
  if (value is! int || value < 0) {
    throw FormatException('$field must be a non-negative integer');
  }
  return value;
}

DateTime _requiredDateTime(Object? value, String field) {
  final parsed = _nullableDateTime(value);
  if (parsed == null) throw FormatException('$field is required');
  return parsed;
}

DateTime? _nullableDateTime(Object? value) {
  if (value == null) return null;
  if (value is! String) throw const FormatException('Expected an ISO timestamp');
  return DateTime.tryParse(value);
}

Uri _requiredHttpsUri(Object? value, String field) {
  final uri = _nullableHttpsUri(value, field);
  if (uri == null) throw FormatException('$field is required');
  return uri;
}

Uri? _nullableHttpsUri(Object? value, String field) {
  if (value == null) return null;
  if (value is! String) throw FormatException('$field must be a URL');
  final uri = Uri.tryParse(value);
  if (uri == null || uri.scheme != 'https' || uri.host.isEmpty) {
    throw FormatException('$field must be an https URL');
  }
  return uri;
}
