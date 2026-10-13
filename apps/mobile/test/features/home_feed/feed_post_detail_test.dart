import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/features/home_feed/feed_api.dart';
import 'package:masanawa/src/features/home_feed/feed_post_detail_screen.dart';

final sample=FeedPost(id:'381026c2-9d56-47b1-b73d-1784e24e41e2',
  authorMasanaId:'masana_lecturer',authorName:'Gwana',kind:'text',
  body:'Study tips for today',mediaIds:const [],publishedAt:DateTime.utc(2026),
  likeCount:0,commentCount:1,liked:false,saved:false);
final root=FeedComment(id:'9b8c8884-7a31-49d9-aee5-521364b54aef',body:'A question',
  state:'visible',createdAt:DateTime.utc(2026));

void main(){
 testWidgets('C22 loads approved detail, oldest order and replies with parent id',(tester)async{
   String? reply;String order='newest';String? key;
   await tester.pumpWidget(MaterialApp(home:FeedPostDetailScreen(
     initialPost:sample,accountKey:'fan_one',
     loadPost:(id)async=>sample,
     loadThread:(id,sort)async{order=sort;return [root];},
     sendComment:(id,body,idempotency,parent)async{
       reply=parent;key=idempotency;
     })));
   await tester.pumpAndSettle();
   expect(find.text('Study tips for today'),findsOneWidget);
   expect(find.text('A question'),findsOneWidget);
   await tester.tap(find.text('Oldest'));
   await tester.pumpAndSettle();
   expect(order,'oldest');
   await tester.tap(find.text('Reply'));
   await tester.pumpAndSettle();
   await tester.enterText(find.byType(TextField),'Follow-up question');
   await tester.tap(find.byTooltip('Send'));
   await tester.pumpAndSettle();
   expect(reply,root.id);expect(key,startsWith('c22-'));
   expect(find.text('Publish'),findsNothing);
 });
 testWidgets('C22 does not show old account content when switching',(tester)async{
   final old=sample;
   final next=FeedPost(id:'4aa45213-95b9-45ad-9579-52924e07ce73',
     authorMasanaId:'masana_other',kind:'text',body:'New account post',
     mediaIds:const [],publishedAt:DateTime.utc(2026),likeCount:0,
     commentCount:0,liked:false,saved:false);
   Future<void> render(String account,FeedPost post)async{
     await tester.pumpWidget(MaterialApp(home:FeedPostDetailScreen(
       initialPost:post,accountKey:account,loadPost:(_)async=>post,
       loadThread:(_,__)async=>[],sendComment:(_,__,___,____)async{})));
     await tester.pumpAndSettle();
   }
   await render('first',old);
   expect(find.text('Study tips for today'),findsOneWidget);
   await render('second',next);
   expect(find.text('Study tips for today'),findsNothing);
   expect(find.text('New account post'),findsOneWidget);
 });
 testWidgets('C22 feature gate disables the post journey',(tester)async{
   await tester.pumpWidget(MaterialApp(home:FeedPostDetailScreen(
     initialPost:sample,accountKey:'fan',enabled:false,
     loadPost:(_)async=>throw StateError('never'),
     loadThread:(_,__)async=>[],sendComment:(_,__,___,____)async{})));
   expect(find.text('This feature is unavailable'),findsOneWidget);
 });
}
