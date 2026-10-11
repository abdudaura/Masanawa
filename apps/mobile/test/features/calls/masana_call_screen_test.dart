import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/features/calls/masana_call_api.dart';
import 'package:masanawa/src/features/calls/masana_call_screen.dart';

class FakeCallMedia implements MasanaCallMedia {
  int connections=0,disconnections=0;
  @override Future<void> connect(String url,String token) async {connections++;}
  @override Future<void> microphone(bool enabled) async {}
  @override Future<void> speaker(bool enabled) async {}
  @override Future<void> disconnect() async {disconnections++;}
}
class FakeCallsAdapter extends Interceptor {
  int starts=0,ends=0;
  @override
  void onRequest(RequestOptions options,RequestInterceptorHandler handler) {
    if(options.path=='/v1/calls') {
      starts++;
      handler.resolve(Response(requestOptions:options,statusCode:200,data:{
        'callId':'call_0199f0d0-0000-7000-8000-000000000003',
        'url':'wss://lk.example','token':'short-lived',
        'expiresAt':DateTime.now().add(const Duration(minutes:15)).toIso8601String(),
      }));
    } else if(options.path.endsWith('/end')) {
      ends++;
      handler.resolve(Response(requestOptions:options,statusCode:200,data:{}));
    } else {
      handler.resolve(Response(requestOptions:options,statusCode:200,data:{}));
    }
  }
}
void main() {
  testWidgets('microphone denial never dispatches a call',(tester) async {
    final adapter=FakeCallsAdapter(),dio=Dio()..interceptors.add(adapter);
    await tester.pumpWidget(MaterialApp(home:MasanaCallScreen(
      api:MasanaCallApi(dio),
      characterId:'character_0199f0d0-0000-7000-8000-000000000003',
      displayName:'Teacher',askMicrophone:()=>Future.value(false),
    )));
    await tester.pumpAndSettle();
    expect(find.textContaining('permission denied'),findsOneWidget);
    expect(adapter.starts,0);
    await tester.pumpWidget(const SizedBox());
  });
  testWidgets('authorized audio connects then hangs up with server receipt',(tester) async {
    final adapter=FakeCallsAdapter(),dio=Dio()..interceptors.add(adapter);
    final media=FakeCallMedia();
    await tester.pumpWidget(MaterialApp(home:MasanaCallScreen(
      api:MasanaCallApi(dio),
      characterId:'character_0199f0d0-0000-7000-8000-000000000003',
      displayName:'Teacher',askMicrophone:()=>Future.value(true),
      mediaFactory:()=>media,
    )));
    await tester.pump(const Duration(milliseconds:500));
    expect(find.textContaining('Connected'),findsOneWidget);
    await tester.tap(find.text('End call'));
    await tester.pump(const Duration(milliseconds:250));
    expect(adapter.starts,1);
    expect(adapter.ends,1);
    expect(media.connections,1);
    expect(media.disconnections,1);
    await tester.pumpWidget(const SizedBox());
  });
}
