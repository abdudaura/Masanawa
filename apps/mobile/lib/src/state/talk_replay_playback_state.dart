import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/providers.dart';
import 'session_state.dart';
import '../talks/talk_replay_audio_player.dart';
import '../talks/talk_replay_playback.dart';
import '../talks/talk_replay_playback_http_transport.dart';

final talkReplayPlaybackTransportProvider =
    Provider<TalkReplayPlaybackTransport>(
  (ref) => GatewayTalkReplayPlaybackTransport(
    api: ref.watch(apiClientProvider),
  ),
);

final talkReplayAudioPlayerFactoryProvider =
    Provider<TalkReplayAudioPlayer Function()>(
  (_) => JustAudioTalkReplayPlayer.new,
);

typedef TalkReplayPlaybackFactory =
    TalkReplayPlaybackController Function(String talkId);

final talkReplayPlaybackFactoryProvider =
    Provider<TalkReplayPlaybackFactory>((ref) {
  final transport = ref.watch(talkReplayPlaybackTransportProvider);
  final playerFactory = ref.watch(talkReplayAudioPlayerFactoryProvider);
  // The factory is invalidated on sign-out / account switch (but not on
  // refresh-token rotation for the same person). Close old media immediately,
  // without waiting for a navigation event or expiring S3 URL.
  final ownerId = ref.watch(sessionProvider.select((state) =>
      state is SessionSignedIn && state.user.isActive ? state.user.id : null));
  final sessions = <TalkReplayPlaybackSession>[];
  ref.onDispose(() {
    for (final session in sessions) {
      unawaited(session.close().catchError((Object _) {}));
    }
    sessions.clear();
  });
  return (talkId) {
    final session = TalkReplayPlaybackSession(
      talkId: talkId,
      transport: transport,
      player: playerFactory(),
      canAccess: () {
        final state = ref.read(sessionProvider);
        return ownerId != null &&
            state is SessionSignedIn &&
            state.user.isActive &&
            state.user.id == ownerId;
      },
    );
    sessions.add(session);
    return session;
  };
});

