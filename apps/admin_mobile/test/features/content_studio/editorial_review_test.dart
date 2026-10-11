import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa_admin/src/features/content_studio/content_studio_page.dart';
import 'package:masanawa_admin/src/features/content_studio/review_queue_page.dart';

void main(){
 testWidgets('A05 saves a draft, never publishes directly', (tester) async{
  final dio=Dio(BaseOptions(baseUrl:'https://example.invalid'));
  final calls=<RequestOptions>[];
  dio.interceptors.add(InterceptorsWrapper(onRequest:(options,handler){
    calls.add(options);
    handler.resolve(Response<dynamic>(requestOptions:options,data:{'id':'post','state':'draft','revision':0},statusCode:200));
  }));
  await tester.pumpWidget(MaterialApp(home:Scaffold(body:ContentStudioPage(
    dio:dio,accessToken:()async=>'test-staff-session',canEdit:true,
    approvedMasana:()async=>[(id:'masana',name:'Teacher')]))));
  await tester.pumpAndSettle();
  await tester.enterText(find.byType(TextField).first,'An original teaching post');
  await tester.tap(find.text('Save draft'));
  await tester.pumpAndSettle();
  expect(calls.length,1);
  expect(calls.single.path,'/v1/admin/feed/drafts');
  expect(calls.single.headers['Idempotency-Key'],isNotNull);
  expect(calls.single.data['authorMasanaId'],'masana');
  expect(find.text('Draft saved for editorial review'),findsOneWidget);
 });
 testWidgets('A06 loads private review state and demands confirmation', (tester) async{
  final dio=Dio(BaseOptions(baseUrl:'https://example.invalid'));
  final calls=<RequestOptions>[];
  dio.interceptors.add(InterceptorsWrapper(onRequest:(options,handler){
    calls.add(options);
    if(options.method=='GET'){
      handler.resolve(Response<dynamic>(requestOptions:options,statusCode:200,data:[
        {'id':'9b8c8884-7a31-49d9-aee5-521364b54aef',
         'authorMasanaId':'masana','kind':'text','body':'Lesson',
         'state':'in_review','revision':2,'createdBy':'original_author'}
      ]));
    }else{
      handler.resolve(Response<dynamic>(requestOptions:options,statusCode:200,data:
        {'state':'published','revision':3}));
    }
  }));
  await tester.pumpWidget(MaterialApp(home:Scaffold(body:ReviewQueuePage(
    dio:dio,accessToken:()async=>'reviewer-session',canEdit:true,staffId:'reviewer'))));
  await tester.pumpAndSettle();
  expect(find.text('Lesson'),findsOneWidget);
  await tester.tap(find.text('Approve & publish'));await tester.pumpAndSettle();
  expect(find.text('Confirm'),findsOneWidget);
  expect(calls.where((c)=>c.method=='POST'),isEmpty);
  await tester.tap(find.text('Confirm'));await tester.pumpAndSettle();
  final sent=calls.singleWhere((c)=>c.method=='POST');
  expect(sent.path,contains('/transition'));
  expect(sent.data['action'],'approve');
  expect(sent.data['expectedRevision'],2);
 });
 testWidgets('A06 draft author can revise, preserving author and expected revision', (tester) async{
  final dio=Dio(BaseOptions(baseUrl:'https://example.invalid'));
  final calls=<RequestOptions>[];
  dio.interceptors.add(InterceptorsWrapper(onRequest:(options,handler){
    calls.add(options);
    if(options.method=='GET'){
      handler.resolve(Response<dynamic>(requestOptions:options,statusCode:200,data:[
        {'id':'9b8c8884-7a31-49d9-aee5-521364b54aef',
         'authorMasanaId':'masana','kind':'text','body':'Initial',
         'media':<String>[],'transcript':null,
         'state':'draft','revision':0,'createdBy':'editor_one'}
      ]));
    }else{
      handler.resolve(Response<dynamic>(requestOptions:options,statusCode:200,data:
       {'state':'draft','revision':1}));
    }
  }));
  await tester.pumpWidget(MaterialApp(home:Scaffold(body:ReviewQueuePage(
    dio:dio,accessToken:()async=>'staff-token',canEdit:true,staffId:'editor_one'))));
  await tester.pumpAndSettle();
  expect(find.text('Edit draft'),findsOneWidget);
  await tester.tap(find.text('Edit draft'));
  await tester.pumpAndSettle();
  await tester.enterText(find.byType(TextField).last,'Updated lesson');
  await tester.tap(find.text('Save revision'));
  await tester.pumpAndSettle();
  final request=calls.singleWhere((c)=>c.method=='PATCH');
  expect(request.path,contains('/draft'));
  expect(request.data['authorMasanaId'],'masana');
  expect(request.data['expectedRevision'],0);
  expect(request.data['body'],'Updated lesson');
 });
 testWidgets('A06 denies editor actions without role', (tester) async{
  final dio=Dio();final calls=<RequestOptions>[];
  dio.interceptors.add(InterceptorsWrapper(onRequest:(options,handler){calls.add(options);handler.next(options);}));
  await tester.pumpWidget(MaterialApp(home:Scaffold(body:ReviewQueuePage(
    dio:dio,accessToken:()async=>'token',canEdit:false,staffId:'reader'))));
  await tester.pumpAndSettle();
  expect(find.text('Content editor access required'),findsOneWidget);
  expect(calls,isEmpty);
 });
}
