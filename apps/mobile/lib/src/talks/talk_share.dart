import 'package:share_plus/share_plus.dart';

class TalkSharePayload {
  const TalkSharePayload({
    required this.talkId,
    required this.title,
    required this.hostName,
  });

  final String talkId;
  final String title;
  final String hostName;

  Uri get url => Uri.https('masanawa.com', '/talk/$talkId');

  String get text {
    final safeTitle = title.trim().isEmpty ? 'Masanawa Talk' : title.trim();
    final safeHost = hostName.trim().isEmpty ? 'Masanawa Host' : hostName.trim();
    return '$safeTitle\nHosted by $safeHost\n$url';
  }
}

abstract interface class TalkShareService {
  Future<void> share(TalkSharePayload payload);
}

class SystemTalkShareService implements TalkShareService {
  const SystemTalkShareService();

  @override
  Future<void> share(TalkSharePayload payload) async {
    await SharePlus.instance.share(
      ShareParams(
        text: payload.text,
        subject: payload.title.trim().isEmpty
            ? 'Masanawa Talk'
            : payload.title.trim(),
      ),
    );
  }
}
