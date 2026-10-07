import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/providers.dart';
import '../social/talk_social_profiles.dart';
import '../social/talk_social_profiles_http_transport.dart';

final talkSocialProfileTransportProvider = Provider<TalkSocialProfileTransport>(
  (ref) => GatewayTalkSocialProfileTransport(api: ref.watch(apiClientProvider)),
);

final humanProfileProvider = FutureProvider.family<HumanProfile?, String>(
  (ref, handle) =>
      ref.watch(talkSocialProfileTransportProvider).loadHuman(handle),
);

final personaProfileProvider = FutureProvider.family<PersonaProfile?, String>(
  (ref, publicId) =>
      ref.watch(talkSocialProfileTransportProvider).loadPersona(publicId),
);
