import '../core/network/api_client.dart';

/// Distinct from legacy live Talk IDs and private voice-note media.
class AudioPost {
  const AudioPost({
    required this.postId,
    required this.authorId,
    required this.authorKind,
    required this.title,
    required this.durationMs,
    required this.status,
    required this.revision,
    required this.createdAt,
  });
  final String postId;
  final String authorId;
  final String authorKind;
  final String title;
  final int durationMs;
  final String status;
  final int revision;
  final DateTime createdAt;

  factory AudioPost.fromJson(Map<String, dynamic> json) {
    final id = json['postId'];
    final author = json['authorId'];
    final kind = json['authorKind'];
    final title = json['title'];
    final duration = json['durationMs'];
    final status = json['status'];
    final revision = json['revision'];
    final created = json['createdAt'];
    if (id is! String || id.isEmpty ||
        author is! String || author.isEmpty ||
        (kind != 'human' && kind != 'masana') ||
        title is! String ||
        duration is! num || !duration.isFinite || duration < 1000 ||
        duration > 180000 || duration.toInt() != duration ||
        (status != 'processing' && status != 'published' &&
         status != 'failed' && status != 'removed') ||
        revision is! num || revision.toInt() != revision ||
        created is! String) {
      throw const FormatException('Invalid audio-post response');
    }
    final date = DateTime.tryParse(created);
    if (date == null) throw const FormatException('Invalid post creation time');
    return AudioPost(
      postId: id, authorId: author, authorKind: kind, title: title,
      durationMs: duration.toInt(), status: status,
      revision: revision.toInt(), createdAt: date,
    );
  }
}
class AudioPostPage {
  const AudioPostPage({required this.items, required this.nextCursor});
  final List<AudioPost> items;
  final String? nextCursor;
}

abstract class AudioPostTransport {
  Future<AudioPostPage> discover({String? cursor});
  Future<List<AudioPost>> mine();
  Future<AudioPost> publish({
    required String requestId, required String assetId, required String title,
  });
  Future<void> react({required String postId, required String kind, required bool enabled});
}
class GatewayAudioPostTransport implements AudioPostTransport {
  GatewayAudioPostTransport(this.api);
  final ApiClient api;

  @override
  Future<AudioPostPage> discover({String? cursor}) async {
    final response = await api.dio.get<dynamic>(
      '/audio-posts', queryParameters: {'limit': 20, if (cursor != null) 'cursor': cursor});
    final raw = response.data;
    if (raw is! Map) throw const FormatException('Invalid feed');
    final data = raw.cast<String, dynamic>();
    final items = data['items'];
    final next = data['nextCursor'];
    if (items is! List || (next != null && next is! String)) {
      throw const FormatException('Invalid feed page');
    }
    return AudioPostPage(
      items: List.unmodifiable(items.map((value) {
        if (value is! Map) throw const FormatException('Invalid post');
        return AudioPost.fromJson(value.cast<String, dynamic>());
      })),
      nextCursor: next as String?,
    );
  }

  @override
  Future<List<AudioPost>> mine() async {
    final response = await api.dio.get<dynamic>('/audio-posts/mine');
    final data = response.data;
    if (data is! List) throw const FormatException('Invalid post history');
    return List.unmodifiable(data.map((item) {
      if (item is! Map) throw const FormatException('Invalid post');
      return AudioPost.fromJson(item.cast<String, dynamic>());
    }));
  }

  @override
  Future<AudioPost> publish({
    required String requestId, required String assetId, required String title,
  }) async {
    final response = await api.dio.post<dynamic>(
      '/audio-posts',
      data: {'requestId': requestId, 'assetId': assetId, 'title': title},
    );
    if (response.data is! Map) throw const FormatException('Invalid publish result');
    return AudioPost.fromJson((response.data as Map).cast<String, dynamic>());
  }

  @override
  Future<void> react({
    required String postId, required String kind, required bool enabled,
  }) async {
    await api.dio.put<dynamic>(
      '/audio-posts/${Uri.encodeComponent(postId)}/reaction',
      data: {'kind': kind, 'enabled': enabled},
    );
  }
}
