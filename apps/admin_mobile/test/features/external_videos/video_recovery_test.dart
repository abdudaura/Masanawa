import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa_admin/src/features/external_videos/video_admin_api.dart';
import 'package:masanawa_admin/src/features/external_videos/video_curation_screen.dart';

void main() {
  testWidgets('hidden video reopens to pending, never silently publishes', (tester) async {
    final sent = <RequestOptions>[];
    var state = 'hidden';
    final dio = Dio(BaseOptions(baseUrl:'https://example.test'));
    dio.interceptors.add(InterceptorsWrapper(onRequest:(options,handler) {
      sent.add(options);
      if (options.method == 'PATCH') state = 'pending';
      final items = <Map<String,dynamic>>[
        {'id':'00000000-0000-4000-a000-000000000001','provider':'youtube',
         'title':'Sample class','channelName':'Tutor','reviewState':state},
      ];
      handler.resolve(Response(requestOptions:options,statusCode:200,
        data:options.method == 'GET' ? {'items':items} : <String,dynamic>{}));
    }));
    await tester.pumpWidget(MaterialApp(home: VideoCurationScreen(api:VideoAdminApi(dio))));
    await tester.pumpAndSettle();
    expect(find.byTooltip('Return to review'),findsOneWidget);
    await tester.tap(find.byTooltip('Return to review'));
    await tester.pumpAndSettle();
    expect(find.text('Return video to review?'),findsOneWidget);
    await tester.tap(find.text('Reopen'));
    await tester.pumpAndSettle();
    final patch = sent.lastWhere((x)=>x.method=='PATCH');
    expect(patch.data,{'state':'pending','verificationReference':null,'expectedState':'hidden'});
    expect(find.byTooltip('Verify and approve'),findsOneWidget);
  });
  testWidgets('all pages of reviews are reachable and account swaps discard prior pages', (tester) async {
    final requests = <RequestOptions>[];
    final first = List.generate(20, (i) => <String, dynamic>{
      'id': '00000000-0000-4000-a000-' + (i + 1).toString().padLeft(12,'0'),
      'provider':'youtube', 'title':'Lesson ' + i.toString(),
      'channelName':'Tutor', 'reviewState':'pending',
    });
    final second = <Map<String,dynamic>>[{
      'id':'00000000-0000-4000-a000-000000000021',
      'provider':'youtube', 'title':'Last lesson',
      'channelName':'Tutor', 'reviewState':'pending',
    }];
    final dio = Dio(BaseOptions(baseUrl:'https://example.test'));
    dio.interceptors.add(InterceptorsWrapper(onRequest:(options,handler) {
      requests.add(options);
      final isNext = options.queryParameters.containsKey('before');
      handler.resolve(Response(requestOptions:options,statusCode:200,
        data:{'items':isNext ? second : first,
          'nextCursor':isNext ? null : first.last['id']}));
    }));
    final api = VideoAdminApi(dio);
    await tester.pumpWidget(MaterialApp(home:VideoCurationScreen(api:api,accountKey:'staffA')));
    await tester.pumpAndSettle();
    expect(find.text('Load more'), findsOneWidget);
    await tester.ensureVisible(find.text('Load more'));
    await tester.tap(find.text('Load more'));
    await tester.pumpAndSettle();
    expect(find.text('Last lesson'), findsOneWidget);
    expect(requests.last.queryParameters['before'], first.last['id']);
    await tester.pumpWidget(MaterialApp(home:VideoCurationScreen(api:api,accountKey:'staffB')));
    await tester.pumpAndSettle();
    expect(find.text('Last lesson'), findsNothing);
    expect(requests.last.queryParameters.containsKey('before'), isFalse);
  });
}
