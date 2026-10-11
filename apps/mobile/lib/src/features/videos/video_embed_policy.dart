/// Exact official-player allowlist. Only canonical URLs returned by /v1/videos
/// may enter a WebView. Never accept embed HTML or arbitrary iframe URLs.
class OfficialVideoEmbed {
  const OfficialVideoEmbed._(this.source, this.embed);
  final Uri source;
  final Uri embed;

  static final _youtubeId = RegExp(r'^[A-Za-z0-9_-]{11}$');
  static final _facebookId = RegExp(r'^[0-9]{7,30}$');
  static final _tiktokId = RegExp(r'^[0-9]{12,25}$');
  static final _tiktokPath = RegExp(
    r'^/@[A-Za-z0-9._-]{2,32}/video/([0-9]{12,25})$',
  );

  static OfficialVideoEmbed fromSource(String provider, Uri url) {
    if (url.scheme != 'https' || url.hasPort || url.userInfo.isNotEmpty ||
        url.hasFragment || url.isScheme('file') || url.toString().length > 1000) {
      throw const FormatException('Invalid official video URL');
    }
    if (provider == 'youtube' && url.host == 'www.youtube.com' &&
        url.path == '/watch' && url.queryParameters.length == 1) {
      final id = url.queryParameters['v'];
      if (id != null && _youtubeId.hasMatch(id) &&
          url.toString() == 'https://www.youtube.com/watch?v=$id') {
        return OfficialVideoEmbed._(url, Uri.https('www.youtube.com', '/embed/$id',
          {'playsinline': '1'}));
      }
    }
    if (provider == 'tiktok' && url.host == 'www.tiktok.com' &&
        !url.hasQuery) {
      final match = _tiktokPath.firstMatch(url.path);
      final id = match?.group(1);
      if (id != null && _tiktokId.hasMatch(id) &&
          url.toString() == 'https://www.tiktok.com${url.path}') {
        return OfficialVideoEmbed._(url, Uri.https('www.tiktok.com',
          '/player/v1/$id', {'controls': '1'}));
      }
    }
    if (provider == 'facebook' && url.host == 'www.facebook.com' &&
        url.path == '/watch/' && url.queryParameters.length == 1) {
      final id = url.queryParameters['v'];
      if (id != null && _facebookId.hasMatch(id) &&
          url.toString() == 'https://www.facebook.com/watch/?v=$id') {
        return OfficialVideoEmbed._(url, Uri.https('www.facebook.com',
          '/plugins/video.php', {'href': url.toString(), 'show_text': 'false'}));
      }
    }
    throw const FormatException('Unsupported official video URL');
  }

  /// Hosted provider UI is never replaced by a scraped video source.
  String html({required String title}) {
    // Escaping here protects the attribute even if a future server adds metadata.
    final safeSrc = embed.toString().replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;');
    final safeTitle = title.replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;').replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
    return '''<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="strict-origin-when-cross-origin">
<style>html,body{margin:0;width:100%;height:100%;background:#000}
iframe{border:0;width:100%;height:100%}</style></head>
<body><iframe src="$safeSrc" title="$safeTitle"
allow="fullscreen; encrypted-media; picture-in-picture; accelerometer; gyroscope; autoplay"
allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></body></html>''';
  }
}
