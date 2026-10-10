enum ExternalVideoProvider { youtube, tiktok, facebook }
enum VideosLoadState { loading, ready, empty, error, offline }
class CuratedVideo {
  const CuratedVideo({required this.id, required this.title, required this.channelName,
    required this.provider, required this.sourceUrl, required this.embedUrl});
  final String id;
  final String title;
  final String channelName;
  final ExternalVideoProvider provider;
  final Uri sourceUrl;
  final Uri embedUrl;
  String get providerLabel => switch (provider) {
    ExternalVideoProvider.youtube => 'YouTube',
    ExternalVideoProvider.tiktok => 'TikTok',
    ExternalVideoProvider.facebook => 'Facebook',
  };
}
