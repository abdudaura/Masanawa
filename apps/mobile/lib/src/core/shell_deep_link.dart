/// Maps a navigation hint to an existing route. The Gateway still authorizes
/// the conversation and every action; links never carry execution authority.
String? shellDeepLinkRoute(Uri uri) {
  if (uri.scheme != 'masanawa' || uri.userInfo.isNotEmpty || uri.hasPort ||
      !{'chat', 'work', 'approval', 'artifact'}.contains(uri.host)) {
    return null;
  }
  final String? characterId;
  if (uri.host == 'chat') {
    if (uri.pathSegments.length != 1) return null;
    characterId = uri.pathSegments.single;
  } else {
    characterId = uri.queryParameters['characterId'];
    if (characterId == null) return '/chats';
  }
  if (characterId == null ||
      !RegExp(r'^character_[A-Za-z0-9_-]+$').hasMatch(characterId)) {
    return null;
  }
  return '/chat/${Uri.encodeComponent(characterId)}';
}
