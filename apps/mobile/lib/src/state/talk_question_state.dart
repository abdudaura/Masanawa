import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/providers.dart';
import '../talks/talk_questions.dart';
import '../talks/talk_questions_http_transport.dart';

final talkQuestionTransportProvider = Provider<TalkQuestionTransport>(
  (ref) => GatewayTalkQuestionTransport(api: ref.watch(apiClientProvider)),
);

final talkHostQuestionsProvider =
    FutureProvider.family<List<TalkQuestion>, String>(
  (ref, talkId) =>
      ref.watch(talkQuestionTransportProvider).loadHostQueue(talkId),
);
