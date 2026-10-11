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
  test('admin cursor is passed only as a query parameter', () async {
    final requests = <RequestOptions>[];
    final dio = Dio(BaseOptions(baseUrl:'https://example.test'));
    dio.interceptors.add(InterceptorsWrapper(onRequest:(options,handler) {
      requests.add(options);
      handler.resolve(Response(requestOptions:options,statusCode:200,data:{
        'items': <Map<String,dynamic>>[{
          'id':'00000000-0000-4000-a000-000000000001',
          'title':'Lesson', 'channelName':'Teacher',
          'provider':'youtube', 'reviewState':'pending',
        }],
        'nextCursor': options.queryParameters.containsKey('before') ? null :
          '00000000-0000-4000-a000-000000000001',
      }));
    }));
    final api = VideoAdminApi(dio);
    final first = await api.page();
    expect(first.items, hasLength(1));
    expect(first.nextCursor, isNotNull);
    final next = await api.page(before:first.nextCursor);
    expect(next.nextCursor, isNull);
    expect(requests.last.queryParameters, {'before':first.nextCursor});
    expect(requests.last.data, isNull);
  });
  test('malformed server cursor is rejected before another page is requested', () async {
    final dio = Dio(BaseOptions(baseUrl:'https://example.test'));
    dio.interceptors.add(InterceptorsWrapper(onRequest:(options,handler) {
      handler.resolve(Response(requestOptions:options,statusCode:200,
        data:{'items':<dynamic>[], 'nextCursor':'------------------------------------'}));
    }));
    await expectLater(VideoAdminApi(dio).page(), throwsFormatException);
  });
}
