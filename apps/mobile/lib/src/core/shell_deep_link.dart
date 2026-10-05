/// Maps an incoming navigation hint to an existing app route. The Gateway still
/// authorizes the conversation and every action; links never carry execution
/// authority.
///
/// Public Twin links deliberately resolve through `/twin/:publicId` first. That
/// route performs an authenticated, privacy-aware Gateway lookup before opening
/// the canonical Character conversation.
String? shellDeepLinkRoute(Uri uri) {
  if (uri.userInfo.isNotEmpty || uri.hasPort) return null;

  if (uri.scheme == 'https' && uri.host.toLowerCase() == 'masanawa.com') {
    if (uri.pathSegments.length != 2 || uri.pathSegments.first != 'twin') {
      return null;
    }
    final publicId = uri.pathSegments[1];
    if (!_validPublicTwinId(publicId)) return null;
    return '/twin/${Uri.encodeComponent(publicId)}';
  }

  if (uri.scheme != 'masanawa' ||
      !{'chat', 'work', 'approval', 'artifact', 'twin', 'activity'}
          .contains(uri.host)) {
    return null;
  }

  if (uri.host == 'twin') {
    if (uri.pathSegments.length != 1) return null;
    final publicId = uri.pathSegments.single;
    if (!_validPublicTwinId(publicId)) return null;
    return '/twin/${Uri.encodeComponent(publicId)}';
  }

  if (uri.host == 'activity') {
    if (uri.pathSegments.isNotEmpty || uri.queryParameters.isNotEmpty) {
      return null;
    }
    return '/home?tab=activity';
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

bool _validPublicTwinId(String value) =>
    RegExp(r'^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$').hasMatch(value);
