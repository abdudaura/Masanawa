import 'package:dio/dio.dart';
import 'feed_api.dart';
import '../videos/video_models.dart';

/// One saved-library entry. Content is always projected by the server for this fan.
class SavedEntry {
  const SavedEntry({required this.kind,required this.id,required this.savedAt,this.post,this.video});
  final String kind,id;
  final DateTime savedAt;
  final FeedPost? post;
  final ExternalVideo? video;

  factory SavedEntry.fromJson(Map<String,dynamic> json) {
    final kind=json['kind'];
    final id=json['id'];
    if ((kind!='post'&&kind!='video')||id is! String) {
      throw const FormatException('Invalid saved item');
    }
    final post=kind=='post'
        ? FeedPost.fromJson(Map<String,dynamic>.from(json['post'] as Map))
        : null;
    final video=kind=='video'
        ? ExternalVideo.fromJson(Map<String,dynamic>.from(json['video'] as Map))
        : null;
    return SavedEntry(kind:kind as String,id:id,savedAt:DateTime.parse(json['savedAt'] as String),
      post:post,video:video);
  }
}
class SavedPage {
  const SavedPage({required this.items,required this.nextCursor});
  final List<SavedEntry> items;
  final String? nextCursor;
  factory SavedPage.fromJson(Map<String,dynamic> data)=>SavedPage(
    items:(data['items'] as List<dynamic>? ?? const []).map(
      (x)=>SavedEntry.fromJson(Map<String,dynamic>.from(x as Map))).toList(),
    nextCursor:data['nextCursor'] as String?);
}

abstract class SavedLibraryApi {
  Future<SavedPage> list({String? cursor});
  Future<void> unsave(SavedEntry item);
  Future<void> saveVideo(String videoId,bool enabled);
}

/// Inject the app's existing authenticated Dio and token provider; no duplicate client.
class DioSavedLibraryApi implements SavedLibraryApi {
  DioSavedLibraryApi(this._dio,this._accessToken);
  final Dio _dio;
  final Future<String?> Function() _accessToken;
  Future<Options> _options() async {
    final token=await _accessToken();
    if(token==null||token.isEmpty)throw StateError('Sign in required');
    return Options(headers:{'Authorization':'Bearer '+token});
  }
  @override Future<SavedPage> list({String? cursor}) async {
    final result=await _dio.get<Map<String,dynamic>>('/v1/saved',
      queryParameters:{if(cursor!=null)'cursor':cursor},options:await _options());
    return SavedPage.fromJson(result.data??const {});
  }
  @override Future<void> unsave(SavedEntry item) async {
    final prefix=item.kind=='video'?'/v1/videos/':'/v1/posts/';
    await _dio.put<void>(prefix+Uri.encodeComponent(item.id)+'/save',
      data:{'enabled':false},options:await _options());
  }
  @override Future<void> saveVideo(String videoId,bool enabled) async {
    await _dio.put<void>('/v1/videos/'+Uri.encodeComponent(videoId)+'/save',
      data:{'enabled':enabled},options:await _options());
  }
}
