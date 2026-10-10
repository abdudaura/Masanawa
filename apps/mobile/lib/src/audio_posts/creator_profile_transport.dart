import '../core/network/api_client.dart';
import 'audio_post_transport.dart';

/// Resolves public published audio by canonical human or Masana creator ID.
abstract class CreatorProfileTransport {
  Future<AudioPostPage> posts({
    required String authorId, required String authorKind, String? cursor,
  });
}

class GatewayCreatorProfileTransport implements CreatorProfileTransport {
  const GatewayCreatorProfileTransport(this.api);
  final ApiClient api;

  @override
  Future<AudioPostPage> posts({
    required String authorId, required String authorKind, String? cursor,
  }) async {
    if (!RegExp(r'^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$').hasMatch(authorId) ||
        (authorKind != 'human' && authorKind != 'masana')) {
      throw const FormatException('Invalid creator');
    }
    final response = await api.dio.get<dynamic>(
      '/v1/audio-posts/creators/' + Uri.encodeComponent(authorKind) +
        '/' + Uri.encodeComponent(authorId),
      queryParameters: {'limit': 20, if (cursor != null) 'cursor': cursor},
    );
    final body = response.data;
    if (body is! Map) throw const FormatException('Invalid creator feed');
    final json = body.cast<String, dynamic>();
    final items = json['items'];
    final next = json['nextCursor'];
    if (items is! List || (next != null && next is! String)) {
      throw const FormatException('Invalid creator feed page');
    }
    final parsed = items.map((item) {
      if (item is! Map) throw const FormatException('Invalid creator Talk');
      final post = AudioPost.fromJson(item.cast<String, dynamic>());
      if (post.authorId != authorId || post.authorKind != authorKind ||
          post.status != 'published') {
        throw const FormatException('Creator Talk does not match');
      }
      return post;
    }).toList(growable: false);
    return AudioPostPage(
      items: List.unmodifiable(parsed), nextCursor: next as String?,
    );
  }
}
