import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/features/masana_social/social_links.dart';
void main(){
  final social=MasanaSocialLink(provider:'whatsapp',handle:'+2348012345678',
    publicUrl:'https://wa.me/2348012345678',mode:'profile_link_only',availability:'link_only');
  test('untrusted social URLs are never launched',(){
    expect(social.approvedUri,isNotNull);
    expect(MasanaSocialLink(provider:'whatsapp',handle:'bad',
      publicUrl:'https://wa.me.evil.test/2348012345678',mode:'profile_link_only',
      availability:'link_only').approvedUri,isNull);
  });
  testWidgets('visible link-only state and controlled launch', (tester) async{
    Uri? opened;
    await tester.pumpWidget(MaterialApp(home:Scaffold(body:MasanaSocialLinks(
      characterId:'masana-1',loadLinks:()async=>[social],
      openLink:(uri)async {opened=uri;return true;}
    ))));
    await tester.pumpAndSettle();
    expect(find.textContaining('no automated replies'),findsOneWidget);
    await tester.tap(find.byIcon(Icons.open_in_new));
    await tester.pump();
    expect(opened.toString(),'https://wa.me/2348012345678');
  });
  testWidgets('offline error offers real retry', (tester) async{
    var attempts=0;
    await tester.pumpWidget(MaterialApp(home:Scaffold(body:MasanaSocialLinks(
      characterId:'masana-1',loadLinks:()async {attempts++;if(attempts==1)throw StateError('offline');return [social];},
    ))));
    await tester.pumpAndSettle();
    expect(find.text('Retry'),findsOneWidget);
    await tester.tap(find.text('Retry'));await tester.pumpAndSettle();
    expect(find.textContaining('Link only'),findsOneWidget);
  });
}
