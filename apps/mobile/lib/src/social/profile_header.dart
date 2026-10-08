/// Presentation-only projection of an authenticated public profile.
/// Missing/invalid profile metadata must never replace the signed-in identity
/// with a fabricated name or issue insecure image requests.
final class ProfileHeader {
  const ProfileHeader({
    required this.displayName,
    required this.initial,
    required this.avatarUrl,
  });

  final String displayName;
  final String initial;
  final String? avatarUrl;
}

ProfileHeader resolveProfileHeader({
  required String sessionName,
  String? publicDisplayName,
  String? publicAvatarUrl,
}) {
  final saved = publicDisplayName?.trim() ?? '';
  final fallback = sessionName.trim();
  final displayName = saved.isNotEmpty ? saved : fallback;
  final initial = displayName.isNotEmpty
      ? String.fromCharCode(displayName.runes.first).toUpperCase()
      : 'U';
  final url = publicAvatarUrl?.trim();
  final uri = url == null || url.isEmpty ? null : Uri.tryParse(url);
  // Server-side avatar ownership is still authoritative. Prevent loading
  // cleartext/non-network URLs or URLs with embedded credentials in the app.
  final avatarUrl = uri != null &&
          uri.scheme == 'https' &&
          uri.hasAuthority &&
          uri.host.isNotEmpty &&
          uri.userInfo.isEmpty
      ? uri.toString()
      : null;
  return ProfileHeader(
    displayName: displayName,
    initial: initial,
    avatarUrl: avatarUrl,
  );
}
