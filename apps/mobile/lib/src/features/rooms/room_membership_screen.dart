import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'room_membership_client.dart';

String membershipError(Object error) {
  if (error is StateError && error.message == 'account_changed') {
    return 'Your session changed. Sign in again.';
  }
  if (error is FormatException) return error.message;
  if (error is DioException) {
    switch (error.response?.statusCode) {
      case 401: return 'Sign in again to access this Room.';
      case 403: return 'Room membership or moderator permission required.';
      case 404: return 'This invitation is unavailable.';
      case 409: return 'This invitation was already used or membership has changed.';
      case 410: return 'Room invitations are unavailable or expired.';
      case 422: return 'The invitation or action is invalid.';
      case 429: return 'Too many active invitations. Revoke one before issuing another.';
    }
    if (error.type == DioExceptionType.connectionError ||
        error.type == DioExceptionType.connectionTimeout) {
      return 'Offline. Reconnect and retry.';
    }
  }
  return 'Could not complete the Room action. Try again.';
}

/// A customer pastes an invitation only inside its Room. Moderation controls
/// are loaded on explicit request and remain server-permission protected.
class RoomMembershipScreen extends StatefulWidget {
  const RoomMembershipScreen({
    super.key,
    required this.client,
    required this.roomId,
    this.onJoined,
  });
  final RoomMembershipClient client;
  final String roomId;
  final Future<void> Function()? onJoined;

  @override
  State<RoomMembershipScreen> createState() => _RoomMembershipScreenState();
}

class _RoomMembershipScreenState extends State<RoomMembershipScreen> {
  final _token = TextEditingController();
  bool _working = false, _loading = false, _managementOpen = false;
  Object? _managementError;
  String? _newToken;
  bool _accepted = false;
  int _version = 0;
  List<RoomInvite> _invites = const [];
  List<RoomMember> _members = const [];

  @override
  void dispose() {
    ++_version;
    _token.dispose();
    _newToken = null;
    super.dispose();
  }

  void _error(Object e) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(membershipError(e))));
  }

  Future<void> _redeem() async {
    if (_working) return;
    final code = _token.text.trim();
    if (!RegExp(r'^[A-Za-z0-9_-]{43}$').hasMatch(code)) {
      _error(const FormatException('Enter a valid 43-character invitation code.'));
      return;
    }
    final version = _version;
    setState(() => _working = true);
    try {
      await widget.client.accept(widget.roomId, code);
      if (!mounted || version != _version) return;
      _token.clear();
      setState(() => _accepted = true);
      await widget.onJoined?.call();
    } catch (e) {
      if (mounted && version == _version) _error(e);
    } finally {
      if (mounted && version == _version) setState(() => _working = false);
    }
  }

  Future<void> _loadManagement() async {
    if (_working || _loading) return;
    final version = ++_version;
    setState(() {
      _managementOpen = true;
      _loading = true;
      _managementError = null;
      _newToken = null;
      _members = const [];
      _invites = const [];
    });
    try {
      final invites = await widget.client.invites(widget.roomId);
      final members = await widget.client.members(widget.roomId);
      if (!mounted || version != _version) return;
      setState(() { _invites = invites; _members = members; });
    } catch (e) {
      if (mounted && version == _version) setState(() => _managementError = e);
    } finally {
      if (mounted && version == _version) setState(() => _loading = false);
    }
  }

  Future<void> _issue() async {
    if (_working) return;
    final version = _version;
    setState(() { _working = true; _newToken = null; });
    try {
      final token = await widget.client.issue(widget.roomId);
      if (!mounted || version != _version) return;
      setState(() => _newToken = token);
      // Do not refresh until the one-time token has been copied.
    } catch (e) {
      if (mounted && version == _version) _error(e);
    } finally {
      if (mounted && version == _version) setState(() => _working = false);
    }
  }

  Future<void> _copy() async {
    final code = _newToken;
    if (code == null) return;
    await Clipboard.setData(ClipboardData(text: code));
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Invitation code copied. Share privately.')));
    }
  }

  Future<bool> _confirm(String description) async {
    return await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Confirm Room action'),
        content: Text(description),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, true),
              child: const Text('Confirm')),
        ],
      ),
    ) ?? false;
  }

  Future<void> _revoke(RoomInvite invite) async {
    if (_working || !await _confirm('Revoke this invitation? It cannot be redeemed afterwards.')) return;
    setState(() => _working = true);
    try {
      await widget.client.revoke(widget.roomId, invite.inviteId);
      if (!mounted) return;
      setState(() { _working = false; _newToken = null; });
      await _loadManagement();
    } catch (e) {
      _error(e);
      if (mounted) setState(() => _working = false);
    }
  }

  Future<void> _moderate(RoomMember member) async {
    if (_working) return;
    final action = member.state == 'banned' ? 'unban' : 'ban';
    final description = action == 'ban'
        ? 'Ban this member from the Room?'
        : 'Unban this member? They must join again.';
    if (!await _confirm(description)) return;
    setState(() => _working = true);
    try {
      await widget.client.moderate(widget.roomId, member.userId, action);
      if (!mounted) return;
      setState(() => _working = false);
      await _loadManagement();
    } catch (e) {
      _error(e);
      if (mounted) setState(() => _working = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Room invitations'),
      backgroundColor: Colors.white, foregroundColor: Colors.black87),
    body: ListView(padding: const EdgeInsets.all(16), children: [
      const Text('Join with an invitation',
        style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
      const SizedBox(height: 8),
      TextField(
        key: const Key('room-invite-code'),
        controller: _token,
        obscureText: true,
        enableSuggestions: false,
        autocorrect: false,
        maxLength: 43,
        decoration: const InputDecoration(
          hintText: '43-character invitation code',
          border: OutlineInputBorder()),
        onSubmitted: (_) => _redeem(),
      ),
      FilledButton(
        key: const Key('room-redeem-invite'),
        onPressed: _working ? null : _redeem,
        child: Text(_working ? 'Working…' : 'Join with code'),
      ),
      if (_accepted) const Padding(padding: EdgeInsets.symmetric(vertical: 8),
        child: Text('Invitation accepted. You are a Room member.')),
      const Divider(height: 32),
      OutlinedButton.icon(
        key: const Key('room-open-management'),
        onPressed: _working || _loading ? null : _loadManagement,
        icon: const Icon(Icons.admin_panel_settings_outlined),
        label: const Text('Manage invitations and members'),
      ),
      if (_managementOpen) ...[
        const SizedBox(height: 12),
        if (_loading) const Center(child: CircularProgressIndicator())
        else if (_managementError != null) ...[
          Text(membershipError(_managementError!)),
          TextButton(onPressed: _loadManagement, child: const Text('Retry')),
        ] else ...[
          const Text('Only authorized Room moderators can manage members.'),
          const SizedBox(height: 8),
          FilledButton.tonal(
            key: const Key('room-issue-invite'),
            onPressed: _working ? null : _issue,
            child: const Text('Create one-time invitation'),
          ),
          if (_newToken != null) Card(child: ListTile(
            title: const Text('New invitation (shown once)'),
            subtitle: const Text('Copy this code before leaving. Never post it publicly.'),
            trailing: IconButton(
              tooltip: 'Copy invitation code',
              onPressed: _copy,
              icon: const Icon(Icons.copy_outlined)),
          )),
          const SizedBox(height: 12),
          Text('Invitations', style: Theme.of(context).textTheme.titleMedium),
          if (_invites.isEmpty) const Text('No invitations yet.'),
          for (final invite in _invites) ListTile(
            title: Text(invite.accepted ? 'Redeemed' : invite.revoked ? 'Revoked' : 'Invitation'),
            subtitle: Text('Expires ' + invite.expiresAt),
            trailing: invite.revoked || invite.accepted ? null : IconButton(
              tooltip: 'Revoke invitation', onPressed: _working ? null : () => _revoke(invite),
              icon: const Icon(Icons.block_outlined)),
          ),
          Text('Members', style: Theme.of(context).textTheme.titleMedium),
          if (_members.isEmpty) const Text('No members yet.'),
          for (final member in _members) ListTile(
            title: Text(member.userId),
            subtitle: Text(member.role + ' · ' + member.state),
            trailing: IconButton(
              tooltip: member.state == 'banned' ? 'Unban member' : 'Ban member',
              onPressed: _working ? null : () => _moderate(member),
              icon: Icon(member.state == 'banned'
                  ? Icons.person_add_alt_1_outlined : Icons.person_off_outlined)),
          ),
        ],
      ],
    ]),
  );
}
