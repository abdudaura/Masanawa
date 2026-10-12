import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/features/masana_social/telegram_connection_screen.dart';

void main(){
 test('Telegram public projection refuses nonofficial redirect/tracker links',(){
  expect(TelegramPublicConnection.fromJson({'provider':'telegram','handle':'@ok',
   'publicUrl':'https://t.me/verified','availability':'link_only'})?.name,'@ok');
  for(final url in ['https://t.me.evil.com/a','http://t.me/a','https://t.me/a?track=1']){
   expect(TelegramPublicConnection.fromJson({'provider':'telegram','handle':'@bad',
     'publicUrl':url,'availability':'link_only'}),isNull);
  }
 });
 testWidgets('offline consumer screen does not show old social data',(tester)async{
  final dio=Dio(BaseOptions(baseUrl:'https://invalid.example.test'));
  dio.interceptors.add(InterceptorsWrapper(onRequest:(options,handler)=>
    handler.reject(DioException(requestOptions:options,type:DioExceptionType.connectionError))));
  await tester.pumpWidget(MaterialApp(home:MasanaTelegramScreen(
    key:const ValueKey('masana_1'),characterId:'masana_1',dio:dio)));
  await tester.pumpAndSettle();
  expect(find.textContaining('Offline'),findsWidgets);
  expect(find.textContaining('verified Telegram account'),findsNothing);
 });
}
