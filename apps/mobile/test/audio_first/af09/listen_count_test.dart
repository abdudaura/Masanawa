import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/audio_posts/audio_post_playback.dart';
import 'package:masanawa/src/audio_posts/audio_post_transport.dart';
import 'package:masanawa/src/core/network/api_client.dart';

const _session = '123e4567-e89b-42d3-a456-426614174000';
AudioPost _post() => AudioPost(
  postId:'post-a', authorId:'creator-a', authorKind:'human',
  title:'Recorded audio', durationMs:12000, status:'published',
  revision:2, createdAt:DateTime.utc(2026,10,10),
);
class PositionOutput implements PublishedTalkAudioOutput, PublishedTalkProgressOutput {
  @override
  ValueChanged<Duration>? onPosition;
  @override
  Future<void> start(Uri uri) async {}
  @override
  Future<void> stop() async {}
  @override
  Future<void> dispose() async {}
  void tick(int positionMs) => onPosition?.call(Duration(milliseconds:positionMs));
}
void main() {
  test('ticket rejects invalid listen grant but allows legacy playback without counts', () {
    final old = PublishedTalkTicket.parse({
      'url':'https://media.example.com/asset?sig=redacted',
      'expiresAtMs':40000,
    },expectedHost:'media.example.com',nowMs:1000);
    expect(old.listenSessionId,isNull);
    expect(() => PublishedTalkTicket.parse({
      'url':'https://media.example.com/asset?sig=redacted',
      'expiresAtMs':40000,'listenSessionId':'spoofed',
    },expectedHost:'media.example.com',nowMs:1000),throwsFormatException);
  });

  test('only continuous native listened progress issues one real count receipt', () async {
    final output=PositionOutput(), calls=<String>[];
    var now=1000;
    final api=ApiClient(dio:Dio())..accessToken='session-a';
    final player=AudioPostPlaybackController(
      api:api,accountId:'account-a',isCurrentAccount:(_)=>true,
      expectedMediaHost:'media.example.com',output:output,nowMs:()=>now,
      ticketRequest:(_)async=>{
        'url':'https://media.example.com/audio?sig=private',
        'expiresAtMs':now+30000,'listenSessionId':_session,
      },
      listenRequest:(post,session,playedMs)async{
        calls.add('$post:$session:$playedMs');
        return {'counted':true,'listenCount':11};
      },
    );
    addTearDown(player.dispose);
    await player.play(_post());
    for(final ms in [0,1000,2000,3000,4000]) {
      now+=1000; output.tick(ms);
    }
    await Future<void>.delayed(Duration.zero);
    expect(calls.length,1);
    expect(calls.single,startsWith('post-a:$_session:'));
    expect(player.listenCountFor('post-a'),11);
    now+=2000;output.tick(6000);
    await Future<void>.delayed(Duration.zero);
    expect(calls.length,1);
  });

  test('seek jumps, revoked account and absent grant never issue listen receipts',() async {
    final output=PositionOutput(),calls=<int>[];
    var now=1000,account='account-a';
    final player=AudioPostPlaybackController(
      api:ApiClient(dio:Dio()),accountId:'account-a',
      isCurrentAccount:(id)=>id==account,
      expectedMediaHost:'media.example.com',output:output,nowMs:()=>now,
      ticketRequest:(_)async=>{
        'url':'https://media.example.com/audio?sig=private',
        'expiresAtMs':now+30000,'listenSessionId':_session,
      },
      listenRequest:(_,__,playedMs)async{
        calls.add(playedMs);return {'counted':true,'listenCount':1};
      },
    );
    addTearDown(player.dispose);
    await player.play(_post());
    now+=1000;output.tick(0);
    now+=1000;output.tick(11000); // Seek not continuous listening.
    await Future<void>.delayed(Duration.zero);
    expect(calls,isEmpty);
    account='account-b';
    now+=1000;output.tick(12000);
    await Future<void>.delayed(Duration.zero);
    expect(calls,isEmpty);
    expect(player.listenCountFor('post-a'),isNull);
  });

  test('uncertain listen HTTP retry preserves the same server session ID',() async {
    final output=PositionOutput(),requests=<String>[];
    var now=1000,attempt=0;
    final player=AudioPostPlaybackController(
      api:ApiClient(dio:Dio()),accountId:'a',isCurrentAccount:(_)=>true,
      expectedMediaHost:'media.example.com',output:output,nowMs:()=>now,
      ticketRequest:(_)async=>{
        'url':'https://media.example.com/audio?sig=private',
        'expiresAtMs':now+30000,'listenSessionId':_session,
      },
      listenRequest:(post,session,playedMs)async {
        requests.add(session);
        if(attempt++==0)throw StateError('outcome uncertain');
        return {'counted':false,'listenCount':5};
      },
    );
    addTearDown(player.dispose);
    await player.play(_post());
    for(final ms in [0,1000,2000,3000,4000]){now+=1000;output.tick(ms);}
    await Future<void>.delayed(Duration.zero);
    expect(requests,[_session]);
    now+=6000;output.tick(5000);
    await Future<void>.delayed(Duration.zero);
    expect(requests,[_session,_session]);
    expect(player.listenCountFor('post-a'),5);
  });
}
