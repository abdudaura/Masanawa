import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa_admin/src/features/masana_social/social_accounts_page.dart';
void main(){
 testWidgets('draft and verification lifecycle offers no bot pairing', (tester)async{
   final dio=Dio(BaseOptions(baseUrl:'https://example.test'));
   dio.interceptors.add(InterceptorsWrapper(onRequest:(options,handler){
     if(options.method=='GET'){return handler.resolve(Response(
       requestOptions:options,statusCode:200,data:{'identities':[
       {'identityId':'soc-1','provider':'whatsapp','handle':'+2348012345678',
       'publicUrl':'https://wa.me/2348012345678','publishState':'draft',
       'verifiedAt':null,'revision':1,'paused':false}
       ]}));}
     return handler.resolve(Response(requestOptions:options,statusCode:200,data:{}));
   }));
   await tester.pumpWidget(MaterialApp(home:MasanaSocialAccountsPage(
     api:MasanaSocialAdminApi(dio),characterId:'masana-gwani')));
   await tester.pumpAndSettle();
   expect(find.text('Verify'),findsOneWidget);
   expect(find.text('Publish'),findsNothing);
   expect(find.textContaining('no WhatsApp bot'),findsOneWidget);
   await tester.scrollUntilVisible(find.text('Save draft'),200);
   expect(find.text('Save draft'),findsOneWidget);
 });
}
