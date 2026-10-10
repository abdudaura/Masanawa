import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa_admin/src/features/external_videos/video_admin_api.dart';
void main(){
  test('API never sends forged tenant or role',() async {
    final sent=<RequestOptions>[];
    final dio=Dio(BaseOptions(baseUrl:'https://example.test'));
    dio.interceptors.add(InterceptorsWrapper(onRequest:(options,handler) {
      sent.add(options);
      handler.resolve(Response(requestOptions:options,statusCode:200,data:{}));
    }));
    final api=VideoAdminApi(dio);
    await api.submit(' https://youtu.be/abcDE12_-34 ',' Maths ',' Teacher ');
    await api.review('a','approved','official-player-verification');
    expect((sent.first.data as Map).keys.toSet(),{'url','title','channelName'});
    expect((sent.last.data as Map).keys.toSet(),{'state','verificationReference'});
    expect((sent.last.data as Map)['verificationReference'],'official-player-verification');
  });
}
