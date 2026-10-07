import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/providers.dart';
import '../talks/talk_live.dart';
import '../talks/talk_live_audio_session.dart';
import '../talks/talk_live_http_transport.dart';
import '../talks/talk_live_room.dart';

final talkLiveTransportProvider = Provider<TalkLiveTransport>(
  (ref) => GatewayTalkLiveTransport(api: ref.watch(apiClientProvider)),
);

final talkLiveRoomFactoryProvider = Provider<TalkLiveRoom Function()>(
  (_) => LiveKitTalkLiveRoom.new,
);

typedef TalkLiveAudioFactory = TalkLiveAudioController Function(String talkId);

final talkLiveAudioFactoryProvider = Provider<TalkLiveAudioFactory>(
  (ref) {
    final transport = ref.watch(talkLiveTransportProvider);
    final roomFactory = ref.watch(talkLiveRoomFactoryProvider);
    return (talkId) => TalkLiveAudioSession(
          talkId: talkId,
          transport: transport,
          room: roomFactory(),
        );
  },
);
