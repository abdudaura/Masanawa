class TwinPublicLink {
  const TwinPublicLink({
    required this.publicId,
  });

  final String publicId;

  static TwinPublicLink? parse(Uri uri) {
    if (uri.scheme != 'https') return null;
    final segments = uri.pathSegments.where((part) => part.isNotEmpty).toList();
    if (segments.length != 1) return null;
    final publicId = segments.single.trim();
    if (!RegExp(r'^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$').hasMatch(publicId)) {
      return null;
    }
    return TwinPublicLink(publicId: publicId);
  }
}
