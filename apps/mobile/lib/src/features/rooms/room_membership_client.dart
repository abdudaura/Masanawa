import 'package:dio/dio.dart';

/// Room admission is always authorized by the Gateway session. Never pass a
/// tenant, role or user ID from the customer UI.
class RoomMember {
  const RoomMember(this.userId, this.state, this.role);
  final String userId, state, role;
  factory RoomMember.fromJson(Map<String, dynamic> json) {
    final userId = json['userId'], state = json['state'], role = json['role'];
    if (userId is! String || userId.isEmpty ||
        !const ['active', 'left', 'banned'].contains(state) ||
        !const ['member', 'moderator'].contains(role)) {
      throw const FormatException('Invalid Room member');
    }
    return RoomMember(userId, state as String, role as String);
  }
}

class RoomInvite {
  const RoomInvite(this.inviteId, this.expiresAt, this.revoked, this.accepted);
  final String inviteId, expiresAt;
  final bool revoked, accepted;
  factory RoomInvite.fromJson(Map<String, dynamic> json) {
    final id = json['inviteId'], expiry = json['expiresAt'];
    if (id is! String || id.isEmpty || expiry is! String ||
        DateTime.tryParse(expiry) == null ||
        json['revoked'] is! bool || json['accepted'] is! bool) {
      throw const FormatException('Invalid Room invitation');
    }
    return RoomInvite(id, expiry, json['revoked'] as bool,
        json['accepted'] as bool);
  }
}

abstract class RoomMembershipClient {
  Future<List<RoomMember>> members(String roomId);
  Future<List<RoomInvite>> invites(String roomId);
  Future<String> issue(String roomId);
  Future<void> revoke(String roomId, String inviteId);
  Future<void> accept(String roomId, String token);
  Future<void> moderate(String roomId, String userId, String action);
}

class HttpRoomMembershipClient implements RoomMembershipClient {
  const HttpRoomMembershipClient(this.http);
  final Dio http;

  String _room(String roomId) =>
      '/v1/rooms/' + Uri.encodeComponent(roomId);

  Future<List<T>> _items<T>(String path, T Function(Map<String, dynamic>) parse) async {
    final response = await http.get<Map<String, dynamic>>(path);
    final raw = response.data?['items'];
    if (raw is! List) throw const FormatException('Invalid Room list');
    return raw.map((value) {
      if (value is! Map<String, dynamic>) {
        throw const FormatException('Invalid Room item');
      }
      return parse(value);
    }).toList(growable: false);
  }

  @override
  Future<List<RoomMember>> members(String roomId) =>
      _items(_room(roomId) + '/members', RoomMember.fromJson);

  @override
  Future<List<RoomInvite>> invites(String roomId) =>
      _items(_room(roomId) + '/invites', RoomInvite.fromJson);

  @override
  Future<String> issue(String roomId) async {
    final response = await http.post<Map<String, dynamic>>(_room(roomId) + '/invites');
    final token = response.data?['token'];
    if (token is! String || !RegExp(r'^[A-Za-z0-9_-]{43}$').hasMatch(token)) {
      throw const FormatException('Invalid invitation response');
    }
    return token;
  }

  @override
  Future<void> revoke(String roomId, String inviteId) async {
    await http.post<void>(_room(roomId) + '/invites/' +
        Uri.encodeComponent(inviteId) + '/revoke');
  }

  @override
  Future<void> accept(String roomId, String token) async {
    if (!RegExp(r'^[A-Za-z0-9_-]{43}$').hasMatch(token)) {
      throw const FormatException('Enter the 43-character invitation code');
    }
    // A secret is sent ONLY in a POST body: never a URL, navigation argument,
    // analytics event or log line.
    await http.post<void>(_room(roomId) + '/invites/accept',
        data: {'token': token}, options: Options(headers: {'Cache-Control': 'no-store'}));
  }

  @override
  Future<void> moderate(String roomId, String userId, String action) async {
    if (action != 'ban' && action != 'unban') {
      throw const FormatException('Invalid moderation action');
    }
    await http.post<void>(_room(roomId) + '/members/' +
        Uri.encodeComponent(userId) + '/moderate', data: {'action': action});
  }
}

/// A route can outlive the five-tab shell. Verify the account on both sides
/// of every asynchronous operation; never let an old response paint a new fan.
class AccountBoundRoomMembershipClient implements RoomMembershipClient {
  const AccountBoundRoomMembershipClient({
    required this.delegate,
    required this.ownerAccount,
    required this.currentAccount,
  });
  final RoomMembershipClient delegate;
  final String ownerAccount;
  final String? Function() currentAccount;

  void _check() {
    if (ownerAccount.isEmpty || currentAccount() != ownerAccount) {
      throw StateError('account_changed');
    }
  }

  Future<T> _guard<T>(Future<T> Function() run) async {
    _check();
    try {
      final result = await run();
      _check();
      return result;
    } catch (_) {
      _check();
      rethrow;
    }
  }

  @override
  Future<List<RoomMember>> members(String id) => _guard(() => delegate.members(id));
  @override
  Future<List<RoomInvite>> invites(String id) => _guard(() => delegate.invites(id));
  @override
  Future<String> issue(String id) => _guard(() => delegate.issue(id));
  @override
  Future<void> revoke(String id, String invite) =>
      _guard(() => delegate.revoke(id, invite));
  @override
  Future<void> accept(String id, String token) =>
      _guard(() => delegate.accept(id, token));
  @override
  Future<void> moderate(String id, String user, String action) =>
      _guard(() => delegate.moderate(id, user, action));
}
