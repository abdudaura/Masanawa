import 'video_embed_policy.dart';

/// Wire contract for a staff-approved, still-verified provider video.
class ExternalVideo {
  const ExternalVideo({
    required this.id, required this.title, required this.channelName,
    required this.provider, required this.sourceUrl,
  });
  final String id, title, channelName, provider;
  final Uri sourceUrl;

  factory ExternalVideo.fromJson(Map<String, dynamic> data) {
    final provider = data['provider'];
    final rawUrl = data['sourceUrl'];
    if (provider is! String || rawUrl is! String ||
        data['reviewState'] != 'approved' ||
        data['verifiedAt'] is! String ||
        (data['verifiedAt'] as String).isEmpty ||
        data['id'] is! String || (data['id'] as String).isEmpty ||
        data['title'] is! String || data['channelName'] is! String ||
        (data['channelName'] as String).trim().isEmpty) {
      throw const FormatException('Unverified video');
    }
    final url = Uri.tryParse(rawUrl);
    if (url == null) throw const FormatException('Invalid source');
    final embed = OfficialVideoEmbed.fromSource(provider, url);
    final expectedId = provider == 'facebook'
        ? embed.source.queryParameters['v']
        : embed.embed.pathSegments.last;
    if (data['providerVideoId'] != null &&
        data['providerVideoId'] != expectedId) {
      throw const FormatException('Mismatched provider video');
    }
    return ExternalVideo(
      id: data['id'] as String,
      title: data['title'] as String,
      channelName: data['channelName'] as String,
      provider: provider, sourceUrl: embed.source,
    );
  }
}


/// One verified server page; opaque cursors are never fabricated by the app.
class VideoCatalogPage {
  const VideoCatalogPage({required this.items, required this.nextCursor});
  final List<ExternalVideo> items;
  final String? nextCursor;

  factory VideoCatalogPage.fromJson(Map<String, dynamic> data) {
    final rawItems = data['items'];
    if (rawItems is! List) {
      throw const FormatException('Invalid video catalog');
    }
    final items = rawItems.map((entry) {
      if (entry is! Map) {
        throw const FormatException('Invalid video item');
      }
      return ExternalVideo.fromJson(Map<String, dynamic>.from(entry));
    }).toList(growable: false);
    final rawCursor = data['nextCursor'];
    if (rawCursor != null &&
        (rawCursor is! String || rawCursor.isEmpty ||
         items.isEmpty || rawCursor != items.last.id)) {
      throw const FormatException('Invalid video catalog cursor');
    }
    return VideoCatalogPage(
      items: items, nextCursor: rawCursor as String?,
    );
  }
}
