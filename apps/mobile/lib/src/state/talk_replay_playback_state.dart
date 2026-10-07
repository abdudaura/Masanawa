import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/providers.dart';
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
  return (talkId) => TalkReplayPlaybackSession(
        talkId: talkId,
        transport: transport,
        player: playerFactory(),
      );
});
