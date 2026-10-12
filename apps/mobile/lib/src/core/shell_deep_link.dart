/// Maps an incoming navigation hint to an existing app route. The Gateway still
/// authorizes the conversation and every action; links never carry execution
/// authority.
///
/// Public Masana links resolve straight to the public profile route; the
/// retired Twin lookup route no longer exists.
String? shellDeepLinkRoute(Uri uri) {
  if (uri.userInfo.isNotEmpty || uri.hasPort || uri.fragment.isNotEmpty) {
    return null;
  }

  if (uri.scheme == 'masanawa' && uri.host == 'calls') {
    if (uri.queryParameters.isNotEmpty ||
        uri.pathSegments.length != 2 ||
        uri.pathSegments.first != 'incoming' ||
        !RegExp(
          r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
        ).hasMatch(uri.pathSegments[1])) {
      return null;
    }
    return '/calls/incoming/${uri.pathSegments[1]}';
  }

  if (uri.scheme == 'https') {
    if (uri.host.toLowerCase() != 'masanawa.com' ||
        uri.queryParameters.isNotEmpty ||
        uri.pathSegments.length != 2) {
      return null;
    }
    final kind = uri.pathSegments.first;
    final id = uri.pathSegments[1];
    if (kind == 'twin') {
      if (!_validPublicId(id)) return null;
      return '/persona/${Uri.encodeComponent(id)}';
    }
    if (kind == 'talk') {
      if (!_validTalkId(id)) return null;
      return '/talk/${Uri.encodeComponent(id)}';
    }
    return null;
  }

  if (uri.scheme != 'masanawa' ||
      !{
        'chat',
        'work',
        'approval',
        'artifact',
        'twin',
        'talk',
        'activity',
      }.contains(uri.host)) {
    return null;
  }

  if (uri.host == 'twin') {
    if (uri.pathSegments.length != 1 || uri.queryParameters.isNotEmpty) {
      return null;
    }
    final publicId = uri.pathSegments.single;
    if (!_validPublicId(publicId)) return null;
    return '/persona/${Uri.encodeComponent(publicId)}';
  }

  if (uri.host == 'talk') {
    if (uri.pathSegments.length != 1 || uri.queryParameters.isNotEmpty) {
      return null;
    }
    final talkId = uri.pathSegments.single;
    if (!_validTalkId(talkId)) return null;
    return '/talk/${Uri.encodeComponent(talkId)}';
  }

  if (uri.host == 'activity') {
    if (uri.pathSegments.isNotEmpty || uri.queryParameters.isNotEmpty) {
      return null;
    }
    return '/home?tab=activity';
  }

  String? characterId;
  if (uri.host == 'chat') {
    if (uri.pathSegments.length != 1 || uri.queryParameters.isNotEmpty) {
      return null;
    }
    characterId = uri.pathSegments.single;
  } else {
    characterId = uri.queryParameters['characterId'];
    if (characterId == null) return '/chats';
    if (uri.queryParameters.length != 1) return null;
  }

  if (!_validCharacterId(characterId)) return null;
  return '/chat/${Uri.encodeComponent(characterId)}';
}

bool _validCharacterId(String value) =>
    RegExp(r'^character_[A-Za-z0-9_-]+$').hasMatch(value);

bool _validPublicId(String value) =>
    RegExp(r'^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$').hasMatch(value);

bool _validTalkId(String value) =>
    RegExp(r'^[A-Za-z0-9][A-Za-z0-9_-]{2,159}$').hasMatch(value);

/// Incoming hints cannot replace a voice destination or another active call.
/// Conversation routes can own inline audio; the caller supplies imperative
/// group/modal ownership separately. Other destinations retain normal routing.
bool canOpenIncomingCallRoute({
  required String currentPath,
  required String targetPath,
  bool hasActiveCall = false,
}) {
  if (!targetPath.startsWith('/calls/incoming/')) return true;
  return !hasActiveCall &&
      !currentPath.startsWith('/calls/incoming/') &&
      !currentPath.startsWith('/chat/');
}
