import 'package:share_plus/share_plus.dart';

/// Only a generic app invitation or a server-issued signed personal invite.
/// Never embed phonebook data, private conversations, rewards or tracking IDs.
class InviteShareLink {
  const InviteShareLink._(this.uri, this.personal);

  final Uri uri;
  final bool personal;

  static InviteShareLink generic() =>
      InviteShareLink._(Uri.https('masanawa.com', '/invite'), false);

  static InviteShareLink fromServer(String value) {
    final uri = Uri.tryParse(value);
    if (uri == null ||
        uri.scheme != 'https' ||
        uri.host != 'masanawa.com' ||
        uri.userInfo.isNotEmpty ||
        uri.hasPort ||
        uri.query.isNotEmpty ||
        uri.fragment.isNotEmpty ||
        uri.pathSegments.length != 2 ||
        uri.pathSegments.first != 'invite') {
      throw const FormatException('Invalid invitation URL');
    }
    final token = uri.pathSegments.last;
    if (token.length > 1024 ||
        !RegExp(r'^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+).hasMatch(token)) {
      throw const FormatException('Invalid invitation signature format');
    }
    return InviteShareLink._(uri, true);
  }

  String get message => personal
      ? 'Join me on Masanawa. You choose whether to connect after signing in.\n$uri'
      : 'Join Masanawa to explore public Talks and connect with people.\n$uri';
}

abstract interface class InviteLinkTransport {
  /// Server authenticates the issuer and checks C01 public-profile consent.
  Future<InviteShareLink> createPersonalLink();
}

abstract interface class InviteSystemShare {
  Future<void> send(InviteShareLink link);
}

class PlatformInviteShare implements InviteSystemShare {
  const PlatformInviteShare();

  @override
  Future<void> send(InviteShareLink link) async {
    // Deliberate OS share target choice: no background SMS or imported numbers.
    await SharePlus.instance.share(
      ShareParams(text: link.message, subject: 'Join Masanawa'),
    );
  }
}

class InviteShareSessionChanged implements Exception {
  const InviteShareSessionChanged();
}

/// In-memory only, one user gesture per operation. Discard late A-link on B
/// switch, sign-out or OTP recovery; never cache personalized URLs on device.
class InviteShareCoordinator {
  InviteShareCoordinator({
    required this.transport,
    required this.sharing,
    required this.currentSessionKey,
  });

  final InviteLinkTransport transport;
  final InviteSystemShare sharing;
  final String? Function() currentSessionKey;
  bool _busy = false;

  Future<void> shareGeneric() => sharing.send(InviteShareLink.generic());

  Future<void> sharePersonal() async {
    if (_busy) return;
    final before = currentSessionKey();
    if (before == null || before.isEmpty) {
      throw const InviteShareSessionChanged();
    }
    _busy = true;
    try {
      final link = await transport.createPersonalLink();
      if (currentSessionKey() != before) {
        throw const InviteShareSessionChanged();
      }
      await sharing.send(link);
    } finally {
      _busy = false;
    }
  }
}
).hasMatch(token)) {
      throw const FormatException('Invalid invitation signature format');
    }
    return InviteShareLink._(uri, true);
  }

  String get message => personal
      ? 'Join me on Masanawa. You choose whether to connect after signing in.\n$uri'
      : 'Join Masanawa to explore public Talks and connect with people.\n$uri';
}

abstract interface class InviteLinkTransport {
  /// Server authenticates the issuer and checks C01 public-profile consent.
  Future<InviteShareLink> createPersonalLink();
}

abstract interface class InviteSystemShare {
  Future<void> send(InviteShareLink link);
}

class PlatformInviteShare implements InviteSystemShare {
  const PlatformInviteShare();

  @override
  Future<void> send(InviteShareLink link) async {
    // Deliberate OS share target choice: no background SMS or imported numbers.
    await SharePlus.instance.share(
      ShareParams(text: link.message, subject: 'Join Masanawa'),
    );
  }
}

class InviteShareSessionChanged implements Exception {
  const InviteShareSessionChanged();
}

/// In-memory only, one user gesture per operation. Discard late A-link on B
/// switch, sign-out or OTP recovery; never cache personalized URLs on device.
class InviteShareCoordinator {
  InviteShareCoordinator({
    required this.transport,
    required this.sharing,
    required this.currentSessionKey,
  });

  final InviteLinkTransport transport;
  final InviteSystemShare sharing;
  final String? Function() currentSessionKey;
  bool _busy = false;

  Future<void> shareGeneric() => sharing.send(InviteShareLink.generic());

  Future<void> sharePersonal() async {
    if (_busy) return;
    final before = currentSessionKey();
    if (before == null || before.isEmpty) {
      throw const InviteShareSessionChanged();
    }
    _busy = true;
    try {
      final link = await transport.createPersonalLink();
      if (currentSessionKey() != before) {
        throw const InviteShareSessionChanged();
      }
      await sharing.send(link);
    } finally {
      _busy = false;
    }
  }
}
