import '../core/network/api_client.dart';
import 'audio_post_transport.dart';

class CreatorFollowReceipt {
  const CreatorFollowReceipt({
    required this.authorId, required this.authorKind, required this.following,
  });
  final String authorId;
  final String authorKind;
  final bool following;

  factory CreatorFollowReceipt.fromJson(dynamic body) {
    if (body is! Map) throw const FormatException('Invalid follow response');
    final json = body.cast<String, dynamic>();
    if (json['authorId'] is! String || (json['authorId'] as String).isEmpty ||
        (json['authorKind'] != 'human' && json['authorKind'] != 'masana') ||
        json['following'] is! bool) {
      throw const FormatException('Invalid creator follow status');
    }
    return CreatorFollowReceipt(
      authorId: json['authorId'] as String,
      authorKind: json['authorKind'] as String,
      following: json['following'] as bool,
    );
  }
}

abstract class CreatorFollowingTransport {
  Future<CreatorFollowReceipt> status({required String postId});
  Future<CreatorFollowReceipt> set({
    required String postId, required bool enabled,
  });
  Future<AudioPostPage> following({String? cursor});
}

class GatewayCreatorFollowingTransport implements CreatorFollowingTransport {
  const GatewayCreatorFollowingTransport(this.api);
  final ApiClient api;

  @override
  Future<CreatorFollowReceipt> status({required String postId}) async {
    final response = await api.dio.get<dynamic>(
      '/v1/audio-posts/${Uri.encodeComponent(postId)}/follow',
    );
    return CreatorFollowReceipt.fromJson(response.data);
  }

  @override
  Future<CreatorFollowReceipt> set({
    required String postId, required bool enabled,
  }) async {
    final response = await api.dio.put<dynamic>(
      '/v1/audio-posts/${Uri.encodeComponent(postId)}/follow',
      data: {'enabled': enabled},
    );
    final receipt = CreatorFollowReceipt.fromJson(response.data);
    if (receipt.following != enabled) {
      throw const FormatException('Follow change not confirmed');
    }
    return receipt;
  }

  @override
  Future<AudioPostPage> following({String? cursor}) async {
    final response = await api.dio.get<dynamic>(
      '/v1/audio-posts/following',
      queryParameters: {'limit': 20, if (cursor != null) 'cursor': cursor},
    );
    final body = response.data;
    if (body is! Map) throw const FormatException('Invalid Following feed');
    final json = body.cast<String, dynamic>();
    final items = json['items'];
    final nextCursor = json['nextCursor'];
    if (items is! List || (nextCursor != null && nextCursor is! String)) {
      throw const FormatException('Invalid Following page');
    }
    return AudioPostPage(
      items: List.unmodifiable(items.map((item) {
        if (item is! Map) throw const FormatException('Invalid followed Talk');
        return AudioPost.fromJson(item.cast<String, dynamic>());
      })),
      nextCursor: nextCursor as String?,
    );
  }
}
