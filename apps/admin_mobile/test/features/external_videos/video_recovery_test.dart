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
}
