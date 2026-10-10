import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa_admin/src/features/content_studio/content_studio_page.dart';
void main(){
 testWidgets('staff without content editor role cannot access compose',(tester)async{
  final dio=Dio();
  await tester.pumpWidget(MaterialApp(home:ContentStudioPage(dio:dio,accessToken:()async=>'token',
    approvedMasana:()async=>[],canEdit:false)));
  expect(find.text('Content editor permission required'),findsOneWidget);
 });
 testWidgets('approved editor publishes original Masana text through injected gateway',(tester)async{
  final dio=Dio(BaseOptions(baseUrl:'https://example.invalid'));
  var calls=0;
  dio.interceptors.add(InterceptorsWrapper(onRequest:(options,handler){
    calls++;
    expect(options.path,'/v1/admin/feed/posts');
    expect(options.headers['Authorization'],'Bearer token');
    expect(options.headers['Idempotency-Key'],isNotNull);
    handler.resolve(Response(requestOptions:options,statusCode:200,data:<String,dynamic>{}));
  }));
  await tester.pumpWidget(MaterialApp(home:Scaffold(body:ContentStudioPage(
    dio:dio,accessToken:()async=>'token',approvedMasana:()async=>[(id:'masana_01',name:'Teacher')],
    canEdit:true))));
  await tester.pumpAndSettle();
  await tester.enterText(find.byType(TextField).first,'Hello fans');
  await tester.tap(find.text('Publish'));
  await tester.pumpAndSettle();
  expect(calls,1);
  expect(find.text('Published successfully'),findsOneWidget);
 });
}
