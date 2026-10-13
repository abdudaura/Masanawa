import 'package:dio/dio.dart';

/// A freshly authorized, short-lived *read only* grant for original Masana media.
/// Neither object storage keys nor URLs are persisted to offline caches.
class FeedMediaGrant {
  const FeedMediaGrant({required this.mediaId,required this.kind,
    required this.url,required this.expiresAt,this.transcript});
  final String mediaId,kind;
  final Uri url;
  final DateTime expiresAt;
  final String? transcript;
  factory FeedMediaGrant.fromJson(Map<String,dynamic> j) {
    final url=Uri.tryParse(j['url'] as String? ?? '');
    final expires=DateTime.tryParse(j['expiresAt'] as String? ?? '');
    if(url==null||url.scheme!='https'||url.host.isEmpty||
        expires==null||!expires.isAfter(DateTime.now())||
        expires.difference(DateTime.now())>const Duration(minutes:5)||
        !['image','audio'].contains(j['kind'])||
        j['mediaId'] is! String) {
      throw const FormatException('Invalid signed media grant');
    }
    return FeedMediaGrant(mediaId:j['mediaId'] as String,kind:j['kind'] as String,
      url:url,expiresAt:expires,transcript:j['transcript'] as String?);
  }
}
abstract class FeedMediaApi {
  Future<FeedMediaGrant> getGrant(String postId,String mediaId);
}
class DioFeedMediaApi implements FeedMediaApi {
  DioFeedMediaApi(this._dio,this._getAccessToken);
  final Dio _dio;
  final Future<String?> Function() _getAccessToken;
  @override Future<FeedMediaGrant> getGrant(String postId,String mediaId) async {
    final token=await _getAccessToken();
    final response=await _dio.get<Map<String,dynamic>>(
      '/v1/posts/${Uri.encodeComponent(postId)}/media/${Uri.encodeComponent(mediaId)}',
      options:Options(headers:{if(token!=null&&token.isNotEmpty)
        'Authorization':'Bearer $token','Cache-Control':'no-store'}));
    return FeedMediaGrant.fromJson(response.data??const {});
  }
}
