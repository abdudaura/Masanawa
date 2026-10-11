import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/features/masana_social/social_links.dart';

const verified=MasanaSocialLink(provider:'telegram',handle:'@hello',
 publicUrl:'https://t.me/hello',mode:'profile_link_only',availability:'link_only');
void main(){
 test('approved social links only accept official HTTPS origins',(){
  expect(verified.approvedUri,Uri.parse('https://t.me/hello'));
  for(final link in ['https://t.me.evil.com/hello','http://t.me/hello',
    'https://t.me/hello?to=123','https://t.me/%2e%2e/secret']){
   expect(MasanaSocialLink(provider:'telegram',handle:'@bad',publicUrl:link,
    mode:'profile_link_only',availability:'link_only').approvedUri,isNull);
  }
  expect(MasanaSocialLink(provider:'whatsapp',handle:'bad',
   publicUrl:'https://wa.me/notdigits',mode:'profile_link_only',
   availability:'link_only').approvedUri,isNull);
 });
 testWidgets('renders verified link and follows account change without leaked old data',(tester)async{
  var character='masana_one';
  Widget screen()=>MaterialApp(home:Scaffold(body:MasanaSocialLinks(
   key:ValueKey(character),characterId:character,loadLinks:()async=>
    character=='masana_one'?[verified]:const <MasanaSocialLink>[])));
  await tester.pumpWidget(screen());await tester.pumpAndSettle();
  expect(find.text('TELEGRAM · @hello'),findsOneWidget);
  character='masana_two';await tester.pumpWidget(screen());await tester.pumpAndSettle();
  expect(find.text('TELEGRAM · @hello'),findsNothing);
  expect(find.textContaining('No verified social accounts'),findsOneWidget);
 });
}
