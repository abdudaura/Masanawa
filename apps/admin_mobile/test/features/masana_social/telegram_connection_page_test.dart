import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa_admin/src/features/masana_social/telegram_connection_page.dart';

void main(){
 testWidgets('unauthorized staff cannot see Telegram account data',(tester)async{
  final dio=Dio(BaseOptions(baseUrl:'https://fake.local'));
  dio.interceptors.add(InterceptorsWrapper(onRequest:(req,handler)=>handler.reject(
   DioException(requestOptions:req,response:Response(statusCode:403,requestOptions:req),
    type:DioExceptionType.badResponse))));
  await tester.pumpWidget(MaterialApp(home:TelegramConnectionAdminPage(
   characterId:'masana_one',dio:dio)));
  await tester.pumpAndSettle();
  expect(find.textContaining('Staff permission denied'),findsOneWidget);
  expect(find.text('Pause'),findsNothing);
 });
}
