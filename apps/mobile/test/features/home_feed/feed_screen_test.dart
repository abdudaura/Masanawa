import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/features/home_feed/feed_api.dart';
import 'package:masanawa/src/features/home_feed/feed_screen.dart';
class StubFeed implements FeedApi {
  StubFeed(this.label);
  final String label;
  int calls=0, likes=0;
  Future<FeedPage> Function(String mode,String? cursor)? onList;
  Future<void> Function()? onLike;
  @override Future<FeedPage> list({required String mode,String? cursor})async{
    calls++;
    if(onList!=null)return onList!(mode,cursor);
    return FeedPage([FeedPost(id:'381026c2-9d56-47b1-b73d-1784e24e41e2',
      authorMasanaId:'masana_one',kind:'text',body:label,mediaIds:const [],
      publishedAt:DateTime.utc(2026),likeCount:0,commentCount:0,liked:false,saved:false)],null);
  }
  @override Future<void> like(String id,bool enabled) async {likes++;if(onLike!=null)await onLike!();}
  @override Future<void> save(String id,bool enabled) async {}
  @override Future<void> comment(String id,String body,String key) async {}
  @override Future<List<FeedComment>> comments(String id) async => [];
}
FeedPost update(String body)=>FeedPost(id:'381026c2-9d56-47b1-b73d-1784e24e41e2',
 authorMasanaId:'masana',kind:'text',body:body,mediaIds:const [],publishedAt:DateTime.utc(2026),
 likeCount:0,commentCount:0,liked:false,saved:false);
DioException denial(int status)=>DioException(requestOptions:RequestOptions(path:'/v1/feed'),
 type:DioExceptionType.badResponse,response:Response(requestOptions:RequestOptions(path:'/v1/feed'),statusCode:status));
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
   expect(find.text('Status is currently unavailable'),findsOneWidget);
 });
 testWidgets('Status discards an outstanding response on disable and reloads on enable',(tester)async{
  final pending=Completer<FeedPage>(),api=StubFeed('fresh');
  api.onList=(_,_)=>pending.future;
  Future<void> render(bool enabled)async{
   await tester.pumpWidget(MaterialApp(home:Scaffold(body:MasanaFeedScreen(api:api,accountKey:'fan',enabled:enabled))));
   await tester.pump();
  }
  await render(true);await render(false);
  pending.complete(FeedPage([update('must not survive disable')],null));await tester.pump();
  expect(find.text('must not survive disable'),findsNothing);
  api.onList=null;await render(true);await tester.pumpAndSettle();
  expect(find.text('fresh'),findsOneWidget);
 });
 testWidgets('Status account switch cancels old pagination lock and result',(tester)async{
  final more=Completer<FeedPage>(),one=StubFeed('one'),two=StubFeed('two');
  one.onList=(_,cursor)=>cursor==null?Future.value(FeedPage([update('one')],'next')):more.future;
  two.onList=(_,cursor)=>Future.value(FeedPage([update(cursor==null?'two':'two next')],cursor==null?'next':null));
  Future<void> render(StubFeed api,String key)async{
   await tester.pumpWidget(MaterialApp(home:Scaffold(body:MasanaFeedScreen(api:api,accountKey:key))));await tester.pumpAndSettle();
  }
  await render(one,'one');await tester.tap(find.text('Load more'));await tester.pump();
  await render(two,'two');await tester.tap(find.text('Load more'));await tester.pumpAndSettle();
  expect(two.calls,2);
  more.complete(FeedPage([update('old private page')],null));await tester.pumpAndSettle();
  expect(find.text('old private page'),findsNothing);
 });
 testWidgets('Status preserves offline content but clears it on revoked session',(tester)async{
  final api=StubFeed('cached');
  await tester.pumpWidget(MaterialApp(home:Scaffold(body:MasanaFeedScreen(api:api,accountKey:'fan'))));await tester.pumpAndSettle();
  api.onList=(_,_)=>Future.error(DioException(requestOptions:RequestOptions(path:'/v1/feed'),type:DioExceptionType.connectionError));
  await tester.drag(find.byType(ListView),const Offset(0,500));await tester.pumpAndSettle();
  expect(find.text('cached'),findsOneWidget);
  api.onList=(_,_)=>Future.error(denial(401));await tester.tap(find.text('Retry'));await tester.pumpAndSettle();
  expect(find.text('cached'),findsNothing);
 });
 testWidgets('Status failed reaction rolls back and re-enables retry',(tester)async{
  final pending=Completer<void>(),api=StubFeed('post');api.onLike=()=>pending.future;
  await tester.pumpWidget(MaterialApp(home:Scaffold(body:MasanaFeedScreen(api:api,accountKey:'fan'))));await tester.pumpAndSettle();
  await tester.tap(find.byIcon(Icons.favorite_border));await tester.pump();
  final button=tester.widget<TextButton>(find.ancestor(of:find.byIcon(Icons.favorite),matching:find.byType(TextButton)).first);
  expect(button.onPressed,isNull);
  pending.completeError(StateError('offline'));await tester.pumpAndSettle();
  expect(find.byIcon(Icons.favorite_border),findsOneWidget);
  api.onLike=null;await tester.tap(find.byIcon(Icons.favorite_border));await tester.pumpAndSettle();expect(api.likes,2);
 });
 testWidgets('Status pagination failure offers retry without discarding updates',(tester)async{
  final api=StubFeed('post');bool fail=true;
  api.onList=(_,cursor)=>cursor==null?Future.value(FeedPage([update('post')],'next')):
    fail?Future.error(StateError('offline')):Future.value(FeedPage([],null));
  await tester.pumpWidget(MaterialApp(home:Scaffold(body:MasanaFeedScreen(api:api,accountKey:'fan'))));await tester.pumpAndSettle();
  await tester.tap(find.text('Load more'));await tester.pumpAndSettle();
  expect(find.text('post'),findsOneWidget);expect(find.text('Could not load more updates'),findsOneWidget);
  fail=false;await tester.tap(find.text('Retry'));await tester.pumpAndSettle();
  expect(find.text('Could not load more updates'),findsNothing);expect(find.text('post'),findsOneWidget);
 });

 testWidgets('Status media action retains the authorized post and media pair',(tester)async{
  final api=StubFeed('image');
  final post=FeedPost(id:'381026c2-9d56-47b1-b73d-1784e24e41e2',authorMasanaId:'masana',
   kind:'image',body:'A Masana image',mediaIds:const ['media_abcdefgh'],publishedAt:DateTime.utc(2026),
   likeCount:0,commentCount:0,liked:false,saved:false);
  api.onList=(mode,cursor)=>Future.value(FeedPage([post],null));
  String? openedPost,openedMedia;
  await tester.pumpWidget(MaterialApp(home:Scaffold(body:MasanaFeedScreen(api:api,accountKey:'fan',
   onOpenMedia:(post,id){openedPost=post.id;openedMedia=id;}))));await tester.pumpAndSettle();
  await tester.tap(find.text('View image'));await tester.pumpAndSettle();
  expect(openedPost,post.id);expect(openedMedia,'media_abcdefgh');
 });

}

