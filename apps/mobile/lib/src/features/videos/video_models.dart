class ExternalVideo {
  const ExternalVideo({required this.id, required this.title, required this.channelName, required this.provider, required this.sourceUrl});
  final String id, title, channelName, provider;
  final Uri sourceUrl;
  factory ExternalVideo.fromJson(Map<String, dynamic> j) {
    final provider = j['provider'];
    final url = Uri.tryParse(j['sourceUrl'] is String ? j['sourceUrl'] as String : '');
    final host = url?.host.toLowerCase();
    final valid = url != null && url.scheme == 'https' && url.userInfo.isEmpty &&
      ((provider == 'youtube' && host == 'www.youtube.com') ||
       (provider == 'tiktok' && host == 'www.tiktok.com') ||
       (provider == 'facebook' && host == 'www.facebook.com'));
    if (!valid || j['reviewState'] != 'approved' || j['verifiedAt'] == null) throw const FormatException('Unverified video');
    return ExternalVideo(id: j['id'] as String, title: j['title'] as String,
      channelName: j['channelName'] as String, provider: provider as String, sourceUrl: url);
  }
}
