/// Maps an incoming navigation hint to an existing app route. The Gateway still
/// authorizes the conversation and every action; links never carry execution
/// authority.
///
/// Public Twin links deliberately resolve through `/twin/:publicId` first. That
/// route performs an authenticated, privacy-aware Gateway lookup before opening
/// the canonical Character conversation.
String? shellDeepLinkRoute(Uri uri) {
  if (uri.userInfo.isNotEmpty || uri.hasPort || uri.fragment.isNotEmpty ||
      uri.pathSegments.any((segment) => segment == '.' || segment == '..')) {
    return null;
  }

  if (uri.scheme == 'https') {
    if (uri.host.toLowerCase() != 'masanawa.com' ||
        uri.hasQuery ||
        uri.pathSegments.length != 2) {
      return null;
    }
    final kind = uri.pathSegments.first;
    final id = uri.pathSegments[1];
    if (kind == 'twin') {
      if (!_validPublicTwinId(id)) return null;
      return '/twin/${Uri.encodeComponent(id)}';
    }
    if (kind == 'messages') {
      if (!_validDmConversationId(id)) return null;
      return '/messages/${Uri.encodeComponent(id)}';
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
        'owner-session',
        'messages',
      }.contains(uri.host)) {
    return null;
  }

  if (uri.host == 'twin') {
    if (uri.pathSegments.length != 1 || uri.hasQuery) {
      return null;
    }
    final publicId = uri.pathSegments.single;
    if (!_validPublicTwinId(publicId)) return null;
    return '/twin/${Uri.encodeComponent(publicId)}';
  }

  if (uri.host == 'messages') {
    if (uri.pathSegments.length != 1 || uri.queryParameters.isNotEmpty) {
      return null;
    }
    final id = uri.pathSegments.single;
    if (!_validDmConversationId(id)) return null;
    // An opaque conversation ID is only a locator. Gateway authenticates
    // membership on every read; the deep link grants no access itself.
    return '/messages/${Uri.encodeComponent(id)}';
  }

  if (uri.host == 'talk') {
    if (uri.pathSegments.length != 1 || uri.hasQuery) {
      return null;
    }
    final talkId = uri.pathSegments.single;
    if (!_validTalkId(talkId)) return null;
    return '/talk/${Uri.encodeComponent(talkId)}';
  }

  if (uri.host == 'activity') {
    if (uri.pathSegments.isNotEmpty || uri.hasQuery) {
      return null;
    }
    return '/home?tab=activity';
  }

  if (uri.host == 'owner-session') {
    if (uri.pathSegments.length != 2 || uri.hasQuery) {
      return null;
    }
    final characterId = uri.pathSegments[0];
    final requestId = uri.pathSegments[1];
    if (!_validCharacterId(characterId) ||
        !RegExp(r'^[A-Za-z0-9_-]{8,256}$').hasMatch(requestId)) {
      return null;
    }
    return '/owner-session/' +
        Uri.encodeComponent(characterId) +
        '/' +
        Uri.encodeComponent(requestId);
  }

  String? characterId;
  if (uri.host == 'chat') {
    if (uri.pathSegments.length != 1 || uri.hasQuery) {
      return null;
    }
    characterId = uri.pathSegments.single;
  } else {
    // Reject unknown and repeated query keys instead of silently treating an
    // untrusted action URL as an ordinary AI chat navigation request.
    if (!uri.hasQuery) return '/chats';
    if (uri.queryParametersAll.length != 1 ||
        uri.queryParametersAll['characterId']?.length != 1) {
      return null;
    }
    characterId = uri.queryParametersAll['characterId']!.single;
  }

  if (!_validCharacterId(characterId)) return null;
  return '/chat/${Uri.encodeComponent(characterId)}';
}

bool _validCharacterId(String value) =>
    RegExp(r'^character_[A-Za-z0-9_-]+$').hasMatch(value);

bool _validPublicTwinId(String value) =>
    RegExp(r'^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$').hasMatch(value);

bool _validTalkId(String value) =>
    RegExp(r'^[A-Za-z0-9][A-Za-z0-9_-]{2,159}$').hasMatch(value);

bool _validDmConversationId(String value) =>
    RegExp(r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')
        .hasMatch(value);

