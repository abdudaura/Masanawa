import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/features/home_feed/feed_api.dart';
import 'package:masanawa/src/features/home_feed/feed_screen.dart';
class StubFeed implements FeedApi {
  StubFeed(this.label);
  final String label;
  int calls=0, likes=0;
  @override Future<FeedPage> list({required String mode,String? cursor})async{
    calls++;
    return FeedPage([FeedPost(id:'381026c2-9d56-47b1-b73d-1784e24e41e2',
      authorMasanaId:'masana_one',kind:'text',body:label,mediaIds:const [],
      publishedAt:DateTime.utc(2026),likeCount:0,commentCount:0,liked:false,saved:false)],null);
  }
  @override Future<void> like(String id,bool enabled) async {likes++;}
  @override Future<void> save(String id,bool enabled) async {}
  @override Future<void> comment(String id,String body,String key) async {}
  @override Future<List<FeedComment>> comments(String id) async => [];
}
void main(){
 testWidgets('C21 renders Masana-only posts and reacts without a publish button',(tester)async{
   final api=StubFeed('Hello from Masana');
   await tester.pumpWidget(MaterialApp(home:Scaffold(body:MasanaFeedScreen(api:api,accountKey:'fan1'))));
   await tester.pumpAndSettle();
   expect(find.text('Hello from Masana'),findsOneWidget);
   expect(find.text('Publish'),findsNothing);
   await tester.tap(find.byIcon(Icons.favorite_border));
   await tester.pumpAndSettle();
   expect(api.likes,1);
 });
 testWidgets('C21 clears previous account projection on account switch',(tester)async{
   final one=StubFeed('Private account 1'),two=StubFeed('Account 2');
   Future<void> render(StubFeed api,String key)async{
    await tester.pumpWidget(MaterialApp(home:Scaffold(body:MasanaFeedScreen(api:api,accountKey:key))));
    await tester.pumpAndSettle();
   }
   await render(one,'one');
   expect(find.text('Private account 1'),findsOneWidget);
   await render(two,'two');
   expect(find.text('Private account 1'),findsNothing);
   expect(find.text('Account 2'),findsOneWidget);
 });
 testWidgets('C21 disabled flag has truthful unavailable state',(tester)async{
   await tester.pumpWidget(MaterialApp(home:Scaffold(body:MasanaFeedScreen(api:StubFeed('never'),
     accountKey:'fan',enabled:false))));
   expect(find.text('Feed is currently unavailable'),findsOneWidget);
 });
}
