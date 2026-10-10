import 'package:dio/dio.dart';

class FeedPost {
  const FeedPost({required this.id, required this.authorMasanaId, required this.kind, this.authorName,
    required this.body, required this.mediaIds, required this.publishedAt,
    required this.likeCount, required this.commentCount, required this.liked, required this.saved});
  final String id,authorMasanaId,kind,body;
  final String? authorName;
  final List<String> mediaIds;
  final DateTime publishedAt;
  final int likeCount,commentCount;
  final bool liked,saved;
  factory FeedPost.fromJson(Map<String,dynamic> json) => FeedPost(
    id:json['id'] as String,authorMasanaId:json['authorMasanaId'] as String,
    kind:json['kind'] as String,authorName:json['authorName'] as String?,body:json['body'] as String,
    mediaIds:List<String>.from(json['media'] as List<dynamic>? ?? const []),
    publishedAt:DateTime.parse(json['publishedAt'] as String),
    likeCount:json['likeCount'] as int? ?? 0,
    commentCount:json['commentCount'] as int? ?? 0,
    liked:json['viewerLiked'] as bool? ?? false,saved:json['viewerSaved'] as bool? ?? false);
  FeedPost withAction({bool? liked,bool? saved})=>FeedPost(
    id:id,authorMasanaId:authorMasanaId,kind:kind,authorName:authorName,body:body,
    mediaIds:mediaIds,publishedAt:publishedAt,likeCount:likeCount+(liked==null||liked==this.liked?0:liked?1:-1),
    commentCount:commentCount,liked:liked??this.liked,saved:saved??this.saved);
}
class FeedPage {
  const FeedPage(this.items,this.nextCursor);
  final List<FeedPost> items;
  final String? nextCursor;
  factory FeedPage.fromJson(Map<String,dynamic> body)=>FeedPage(
    (body['items'] as List<dynamic>? ?? const []).map((p)=>FeedPost.fromJson(Map<String,dynamic>.from(p as Map))).toList(),
    body['nextCursor'] as String?);
}
class FeedComment {
  const FeedComment({required this.id,required this.body,required this.state,required this.createdAt});
  final String id,body,state;
  final DateTime createdAt;
  factory FeedComment.fromJson(Map<String,dynamic> json)=>FeedComment(
    id:json['id'] as String,body:json['body'] as String,state:json['state'] as String,
    createdAt:DateTime.parse(json['createdAt'] as String));
}
abstract class FeedApi {
  Future<FeedPage> list({required String mode,String? cursor});
  Future<void> like(String postId,bool enabled);
  Future<void> save(String postId,bool enabled);
  Future<void> comment(String postId,String body,String idempotencyKey);
  Future<List<FeedComment>> comments(String postId);
}
/// Uses the app's existing Dio (base URL, TLS policies) rather than a second network stack.
class DioFeedApi implements FeedApi {
  DioFeedApi(this._dio,this._getAccessToken);
  final Dio _dio;
  final Future<String?> Function() _getAccessToken;
  Future<Options> _options({String? key,bool authRequired=false}) async {
    final token=await _getAccessToken();
    if(authRequired&&(token==null||token.isEmpty))throw StateError('Sign in required');
    return Options(headers:{if(token!=null&&token.isNotEmpty)'Authorization':'Bearer $token',
      if(key!=null)'Idempotency-Key':key});
  }
  @override
  Future<FeedPage> list({required String mode,String? cursor}) async {
    final result=await _dio.get<Map<String,dynamic>>('/v1/feed',
      queryParameters:{'mode':mode,if(cursor!=null)'cursor':cursor},options:await _options());
    return FeedPage.fromJson(result.data??const {});
  }
  @override
  Future<void> like(String id,bool enabled) async {
    await _dio.put<void>('/v1/posts/${Uri.encodeComponent(id)}/like',
      data:{'enabled':enabled},options:await _options(authRequired:true));
  }
  @override
  Future<void> save(String id,bool enabled) async {
    await _dio.put<void>('/v1/posts/${Uri.encodeComponent(id)}/save',
      data:{'enabled':enabled},options:await _options(authRequired:true));
  }
  @override
  Future<void> comment(String id,String body,String key) async {
    await _dio.post<void>('/v1/posts/${Uri.encodeComponent(id)}/comments',
      data:{'body':body},options:await _options(key:key,authRequired:true));
  }
  @override
  Future<List<FeedComment>> comments(String id) async {
    final result=await _dio.get<List<dynamic>>('/v1/posts/${Uri.encodeComponent(id)}/comments',
      options:await _options());
    return (result.data??const []).map((v)=>FeedComment.fromJson(Map<String,dynamic>.from(v as Map))).toList();
  }

}
