import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/features/account/device_security_screen.dart';
import 'package:masanawa/src/features/account/device_security_client.dart';
class FakeTransport implements FanDevicesTransport {
  @override String ownerAccountId='fan-one';
  bool current=true,fail=false,needsStepUp=false;
  String? usedKey;
  @override bool get isCurrentAccount=>current;
  @override Future<List<FanDevice>> list()async {
    if(fail)throw StateError('offline');
    return [FanDevice(id:'4eadd05d-d474-4fd0-848f-8c5791db63f6',
      startedAt:DateTime.utc(2026),lastSeenAt:DateTime.utc(2026),expiresAt:DateTime.utc(2027),current:false),
      FanDevice(id:'2cf070d4-d951-48af-8e3b-7e5b1ddab248',
      startedAt:DateTime.utc(2026),lastSeenAt:DateTime.utc(2026),expiresAt:DateTime.utc(2027),current:true)];
  }
  @override Future<void> revoke(String id,String key)async{usedKey=key;if(fail)throw StateError('offline');
    if(needsStepUp)throw DioException(requestOptions:RequestOptions(path:'/v1/account/devices'),
      response:Response(requestOptions:RequestOptions(path:'/v1/account/devices'),statusCode:428));
  }
}
void main(){
  testWidgets('C09 only remote device offers sign out, with confirmation',(tester)async{
    final t=FakeTransport();
    await tester.pumpWidget(MaterialApp(home:DeviceSecurityScreen(transport:t)));
    await tester.pumpAndSettle();
    expect(find.text('This device'),findsOneWidget);
    expect(find.text('Sign out'),findsOneWidget);
    await tester.tap(find.text('Sign out'));await tester.pumpAndSettle();
    expect(find.text('Sign out this device?'),findsOneWidget);
    await tester.tap(find.widgetWithText(FilledButton,'Sign out'));await tester.pumpAndSettle();
    expect(t.usedKey,startsWith('c09_'));
  });
  testWidgets('C09 account switch hides previous session list immediately',(tester)async{
    final t=FakeTransport();
    await tester.pumpWidget(MaterialApp(home:DeviceSecurityScreen(transport:t)));
    await tester.pumpAndSettle();
    expect(find.text('This device'),findsOneWidget);
    t.current=false;
    await tester.pumpWidget(MaterialApp(home:DeviceSecurityScreen(transport:t)));
    await tester.pumpAndSettle();
    expect(find.text('This device'),findsNothing);
    expect(find.text('Sign in to manage devices'),findsOneWidget);
  });
  testWidgets('C09 stale session requires canonical one-time code and Gwani recovery',(tester)async{
    final t=FakeTransport()..needsStepUp=true;
    var verified=false,openedGwani=false;
    await tester.pumpWidget(MaterialApp(home:DeviceSecurityScreen(
      transport:t,onReauthenticate:()=>verified=true,
      onOpenRecovery:()=>openedGwani=true)));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Sign out'));await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton,'Sign out'));
    await tester.pumpAndSettle();
    expect(find.text('Verify with a one-time code'),findsOneWidget);
    await tester.tap(find.text('Verify with a one-time code'));
    expect(verified,isTrue);
    await tester.tap(find.text('Need account recovery? Ask Gwani'));
    expect(openedGwani,isTrue);
  });
}
