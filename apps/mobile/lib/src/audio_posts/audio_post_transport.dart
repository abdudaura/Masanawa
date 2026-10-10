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
class AudioPostComment {
  const AudioPostComment({
    required this.postId, required this.commentId,
    required this.authorAccountId, required this.body,
    required this.createdAt, required this.removed,
  });
  final String postId;
  final String commentId;
  final String authorAccountId;
  final String body;
  final DateTime createdAt;
  final bool removed;

  factory AudioPostComment.fromJson(Map<String, dynamic> json) {
    final id = json['commentId'];
    final post = json['postId'];
    final author = json['authorAccountId'];
    final body = json['body'];
    final removed = json['removed'];
    final stamp = json['createdAt'];
    if (id is! String || id.isEmpty || post is! String || post.isEmpty ||
        author is! String || author.isEmpty || body is! String ||
        removed is! bool || stamp is! String) {
      throw const FormatException('Invalid comment response');
    }
    final date = DateTime.tryParse(stamp);
    if (date == null) throw const FormatException('Invalid comment date');
    return AudioPostComment(postId: post, commentId: id,
      authorAccountId: author, body: body, createdAt: date, removed: removed);
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
  Future<List<AudioPost>> saved();
  Future<AudioPost> publish({
    required String requestId, required String assetId, required String title,
  });
  Future<void> react({required String postId, required String kind, required bool enabled});
  Future<List<AudioPostComment>> comments({required String postId});
  Future<AudioPostComment> comment({required String postId, required String requestId, required String body});
  Future<void> removeComment({required String postId, required String commentId});
  /// Remove only the currently authenticated user's own post. Idempotent.
  Future<AudioPost> removeMine({required String postId});
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
  Future<List<AudioPost>> saved() async {
    final response = await api.dio.get<dynamic>('/audio-posts/saved');
    final data = response.data;
    if (data is! List) throw const FormatException('Invalid saved Talks');
    return List.unmodifiable(data.map((item) {
      if (item is! Map) throw const FormatException('Invalid saved Talk');
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
  Future<AudioPost> removeMine({required String postId}) async {
    final response = await api.dio.delete<dynamic>(
      '/audio-posts/${Uri.encodeComponent(postId)}',
    );
    if (response.data is! Map) throw const FormatException('Invalid deletion receipt');
    final removed = AudioPost.fromJson((response.data as Map).cast<String, dynamic>());
    if (removed.postId != postId || removed.status != 'removed') {
      throw const FormatException('Post removal not confirmed');
    }
    return removed;
  }

  @override
  Future<List<AudioPostComment>> comments({required String postId}) async {
    final response = await api.dio.get<dynamic>(
      '/audio-posts/${Uri.encodeComponent(postId)}/comments');
    final data = response.data;
    if (data is! List) throw const FormatException('Invalid comments');
    return List.unmodifiable(data.map((item) {
      if (item is! Map) throw const FormatException('Invalid comment');
      final comment = AudioPostComment.fromJson(item.cast<String, dynamic>());
      if (comment.postId != postId || comment.removed) {
        throw const FormatException('Comment belongs to another Talk');
      }
      return comment;
    }));
  }
  @override
  Future<AudioPostComment> comment({
    required String postId, required String requestId, required String body,
  }) async {
    final response = await api.dio.post<dynamic>(
      '/audio-posts/${Uri.encodeComponent(postId)}/comments',
      data: {'requestId': requestId, 'body': body});
    if (response.data is! Map) throw const FormatException('Invalid comment result');
    final comment = AudioPostComment.fromJson((response.data as Map).cast<String, dynamic>());
    if (comment.postId != postId || comment.removed) {
      throw const FormatException('Comment submission not confirmed');
    }
    return comment;
  }
  @override
  Future<void> removeComment({required String postId, required String commentId}) async {
    final response = await api.dio.delete<dynamic>(
      '/audio-posts/${Uri.encodeComponent(postId)}/comments/${Uri.encodeComponent(commentId)}');
    if (response.data is! Map || response.data['removed'] != true) {
      throw const FormatException('Comment removal not confirmed');
    }
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
