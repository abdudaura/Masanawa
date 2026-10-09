/// Maps an incoming navigation hint to an existing app route. The Gateway still
/// authorizes the conversation and every action; links never carry execution
/// authority.
///
/// Public Twin links deliberately resolve through `/twin/:publicId` first. That
/// route performs an authenticated, privacy-aware Gateway lookup before opening
/// the canonical Character conversation.
String? shellDeepLinkRoute(Uri uri) {
  // Repeated parameters are ambiguous: Dart's queryParameters collapses them.
  // Never let two different characterIds select an implementation-dependent
  // private destination.
  if (uri.toString().length > 2048 ||
      uri.queryParametersAll.values.any((values) => values.length != 1) ||
      uri.userInfo.isNotEmpty || uri.hasPort || uri.fragment.isNotEmpty) {
    return null;
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
      if (!_validPublicTwinId(id)) return null;
      return '/twin/${Uri.encodeComponent(id)}';
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
      }.contains(uri.host)) {
    return null;
  }

  if (uri.host == 'twin') {
    if (uri.pathSegments.length != 1 || uri.queryParameters.isNotEmpty) {
      return null;
    }
    final publicId = uri.pathSegments.single;
    if (!_validPublicTwinId(publicId)) return null;
    return '/twin/${Uri.encodeComponent(publicId)}';
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

  if (uri.host == 'owner-session') {
    if (uri.pathSegments.length != 2 || uri.queryParameters.isNotEmpty) {
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

  // Resource hints without exactly one opaque ID are not navigable. Do not
  // discard extra path segments and silently open a private conversation.
  if (uri.host != 'chat' &&
      (uri.pathSegments.length != 1 ||
          !_validResourceId(uri.pathSegments.single))) {
    return null;
  }

  String? characterId;
  if (uri.host == 'chat') {
    if (uri.pathSegments.length != 1 || uri.queryParameters.isNotEmpty) {
      return null;
    }
    characterId = uri.pathSegments.single;
  } else {
    characterId = uri.queryParameters['characterId'];
    if (characterId == null) {
      // A legacy no-character hint can open the old conversation fallback,
      // but unrelated query data is not permission to choose a destination.
      return uri.queryParameters.isEmpty ? '/chats' : null;
    }
    if (uri.queryParameters.length != 1) return null;
  }

  if (!_validCharacterId(characterId)) return null;
  return '/chat/${Uri.encodeComponent(characterId)}';
}

bool _validCharacterId(String value) =>
    value.length <= 256 &&
    RegExp(r'^character_[A-Za-z0-9_-]+$').hasMatch(value);

bool _validResourceId(String value) =>
    value.length <= 256 &&
    RegExp(r'^[A-Za-z0-9][A-Za-z0-9_-]*$').hasMatch(value);

bool _validPublicTwinId(String value) =>
    RegExp(r'^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$').hasMatch(value);

bool _validTalkId(String value) =>
    RegExp(r'^[A-Za-z0-9][A-Za-z0-9_-]{2,159}$').hasMatch(value);
