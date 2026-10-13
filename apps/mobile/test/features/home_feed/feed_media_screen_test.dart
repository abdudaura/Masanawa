import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/features/home_feed/feed_media_api.dart';
import 'package:masanawa/src/features/home_feed/feed_media_screen.dart';
import 'package:masanawa/src/features/home_feed/feed_media_action.dart';
import 'package:masanawa/src/features/home_feed/feed_api.dart';

const post='381026c2-9d56-47b1-b73d-1784e24e41e2';
class MediaStub implements FeedMediaApi {
  MediaStub(this.response);
  final Future<FeedMediaGrant> Function(String,String) response;
  @override Future<FeedMediaGrant> getGrant(String p,String m)=>response(p,m);
}
FeedMediaGrant grant(String id)=>FeedMediaGrant(mediaId:id,kind:'image',
 url:Uri.parse('https://media.example.test/signed'),expiresAt:DateTime.now().add(const Duration(minutes:1)));
void main(){
 testWidgets('C21 C23 action carries both post scope and media ID',(t)async{
   final postValue=FeedPost(id:post,authorMasanaId:'masana',kind:'image',
     body:'Original',mediaIds:const ['media_abcdefgh'],publishedAt:DateTime.utc(2026),
     likeCount:0,commentCount:0,liked:false,saved:false);
   String? receivedPost,receivedMedia;
   await t.pumpWidget(MaterialApp(home:Scaffold(body:FeedMediaOpenAction(
     post:postValue,mediaId:'media_abcdefgh',onOpen:(p,m){
       receivedPost=p.id;receivedMedia=m;
     }))));
   await t.tap(find.text('View image'));
   expect(receivedPost,post);
   expect(receivedMedia,'media_abcdefgh');
 });

 testWidgets('C23 single post media cannot be rendered before server grant',(t)async{
   final pending=Completer<FeedMediaGrant>();
   await t.pumpWidget(MaterialApp(home:FeedMediaScreen(api:MediaStub((_,__)=>pending.future),
     accountKey:'a',postId:post,kind:'image',mediaIds:const ['media_abcdefgh'],
     mediaRenderer:(g)=>Text(g.mediaId))));
   await t.pump();
   expect(find.text('media_abcdefgh'),findsNothing);
   pending.complete(grant('media_abcdefgh'));
   await t.pumpAndSettle();
   expect(find.text('media_abcdefgh'),findsOneWidget);
 });
 testWidgets('C23 account switching rejects stale signed grant response',(t)async{
   final pending=Completer<FeedMediaGrant>();
   Future<void> draw(String account,FeedMediaApi api)async{
     await t.pumpWidget(MaterialApp(home:FeedMediaScreen(
       accountKey:account,api:api,postId:post,kind:'image',
       mediaIds:const ['media_abcdefgh'],mediaRenderer:(g)=>Text('approved for $account'))));
     await t.pump();
   }
   await draw('a',MediaStub((_,__)=>pending.future));
   await draw('b',MediaStub((_,__)async=>grant('media_abcdefgh')));
   pending.complete(grant('media_abcdefgh'));
   await t.pumpAndSettle();
   expect(find.text('approved for a'),findsNothing);
   expect(find.text('approved for b'),findsOneWidget);
 });
 testWidgets('C23 feature disabled and denial show honest state',(t)async{
   final api=MediaStub((_,__)async=>throw StateError('denied'));
   await t.pumpWidget(MaterialApp(home:FeedMediaScreen(
     accountKey:'a',api:api,postId:post,kind:'image',
     mediaIds:const ['media_abcdefgh'],enabled:false)));
   expect(find.text('Media is unavailable right now.'),findsOneWidget);
   await t.pumpWidget(MaterialApp(home:FeedMediaScreen(
     accountKey:'a',api:api,postId:post,kind:'image',mediaIds:const ['media_abcdefgh'])));
   await t.pumpAndSettle();
   expect(find.text('Could not open media.'),findsOneWidget);
   expect(find.text('Retry'),findsOneWidget);
 });
}
