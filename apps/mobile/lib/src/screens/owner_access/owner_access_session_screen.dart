import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../owner_access/owner_access.dart';
import '../../owner_access/owner_access_state.dart';
import '../../state/session_state.dart';
import '../../theme/masanawa_theme.dart';

class OwnerAccessSessionScreen extends ConsumerStatefulWidget {
  const OwnerAccessSessionScreen({
    super.key,
    required this.characterId,
    required this.requestId,
  });

  final String characterId;
  final String requestId;

  @override
  ConsumerState<OwnerAccessSessionScreen> createState() =>
      _OwnerAccessSessionScreenState();
}

class _OwnerAccessSessionScreenState
    extends ConsumerState<OwnerAccessSessionScreen> {
  final _composer = TextEditingController();
  final _scroll = ScrollController();
  Timer? _heartbeatTimer;
  Timer? _messageTimer;
  OwnerAccessRequest? _request;
  OwnerAccessRoomStatus? _status;
  List<OwnerAccessRoomMessage> _messages = const [];
  String? _error;
  bool _loading = true;
  bool _sending = false;
  bool _completing = false;
  int _sequence = 0;

  OwnerAccessTransport get _transport =>
      ref.read(ownerAccessTransportProvider);

  String? get _userId {
    final session = ref.read(sessionProvider);
    return session is SessionSignedIn ? session.user.id : null;
  }

  bool get _isOwner =>
      _request != null && _request!.ownerUserId == _userId;

  bool get _active => _request?.state == OwnerAccessState.active;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(_open());
    });
  }

  Future<void> _open() async {
    await _refreshRequest();
    if (!mounted) return;
    if (_active) {
      await Future.wait<void>([
        _heartbeat(),
        _refreshMessages(),
      ]);
      _heartbeatTimer = Timer.periodic(
        const Duration(seconds: 15),
        (_) => unawaited(_heartbeat()),
      );
      _messageTimer = Timer.periodic(
        const Duration(seconds: 4),
        (_) => unawaited(_refreshMessages()),
      );
    } else {
      await _refreshMessages();
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _refreshRequest() async {
    try {
      final request = await _transport.read(
        characterId: widget.characterId,
        requestId: widget.requestId,
      );
      if (!mounted) return;
      setState(() {
        _request = request;
        _error = request == null ? 'This human session is unavailable.' : null;
      });
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Could not load this human session.');
      }
    }
  }

  Future<void> _heartbeat() async {
    if (!_active) return;
    try {
      final status = await _transport.heartbeat(
        characterId: widget.characterId,
        requestId: widget.requestId,
      );
      if (!mounted) return;
      setState(() {
        _status = status;
        _error = null;
      });
    } catch (_) {
      if (!mounted) return;
      await _refreshRequest();
    }
  }

  Future<void> _refreshMessages() async {
    final request = _request;
    if (request == null) return;
    if (request.modality != OwnerAccessModality.text) return;
    if (request.state != OwnerAccessState.active &&
        request.state != OwnerAccessState.completed &&
        request.state != OwnerAccessState.settled) {
      return;
    }
    try {
      final messages = await _transport.messages(
        characterId: widget.characterId,
        requestId: widget.requestId,
      );
      if (!mounted) return;
      final changed = messages.length != _messages.length ||
          (messages.isNotEmpty &&
              (_messages.isEmpty ||
                  messages.last.messageId != _messages.last.messageId));
      setState(() {
        _messages = messages;
        _error = null;
      });
      if (changed) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!_scroll.hasClients) return;
          _scroll.animateTo(
            _scroll.position.maxScrollExtent,
            duration: const Duration(milliseconds: 180),
            curve: Curves.easeOut,
          );
        });
      }
    } catch (_) {
      if (mounted && _messages.isEmpty) {
        setState(() => _error = 'Could not load session messages.');
      }
    }
  }

  Future<void> _send() async {
    final body = _composer.text.trim();
    if (body.isEmpty || !_active || _sending) return;
    setState(() => _sending = true);
    final messageId = 'human-' +
        DateTime.now().microsecondsSinceEpoch.toString() +
        '-' +
        (_sequence++).toString();
    try {
      final sent = await _transport.sendMessage(
        characterId: widget.characterId,
        requestId: widget.requestId,
        messageId: messageId,
        body: body,
      );
      if (!mounted) return;
      _composer.clear();
      setState(() {
        _messages = List.unmodifiable([..._messages, sent]);
        _error = null;
      });
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scroll.hasClients) {
          _scroll.animateTo(
            _scroll.position.maxScrollExtent,
            duration: const Duration(milliseconds: 180),
            curve: Curves.easeOut,
          );
        }
      });
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Message could not be sent. Try again.');
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _complete() async {
    final request = _request;
    if (request == null ||
        !_isOwner ||
        !_active ||
        _status?.attendanceVerified != true ||
        _completing) {
      return;
    }
    setState(() => _completing = true);
    try {
      final updated = await _transport.act(
        characterId: widget.characterId,
        requestId: widget.requestId,
        action: 'complete',
      );
      if (!mounted) return;
      setState(() => _request = updated);
      _heartbeatTimer?.cancel();
      _messageTimer?.cancel();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Human session completed.')),
      );
    } catch (_) {
      if (mounted) {
        setState(
          () => _error =
              'The session could not be completed. Keep both participants in the room and try again.',
        );
      }
    } finally {
      if (mounted) setState(() => _completing = false);
    }
  }

  @override
  void dispose() {
    _heartbeatTimer?.cancel();
    _messageTimer?.cancel();
    _composer.dispose();
    _scroll.dispose();
    super.dispose();
  }

  String _statusText() {
    final request = _request;
    if (request == null) return 'Private human session';
    if (request.state == OwnerAccessState.settled ||
        request.state == OwnerAccessState.completed) {
      return 'Completed · private human chat';
    }
    if (!_active) return 'Session is not active';
    if (_status?.attendanceVerified == true) {
      return 'Both participants verified';
    }
    final seconds = _status?.verifiedSeconds ?? 0;
    return seconds > 0
        ? 'Both people present · verifying attendance'
        : 'Waiting for both people to be present';
  }

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final userId = _userId;

    return Scaffold(
      backgroundColor: u.surfaceBg,
      appBar: AppBar(
        titleSpacing: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Human chat'),
                SizedBox(width: 6),
                Icon(Icons.verified_user_outlined, size: 17),
              ],
            ),
            Text(
              _statusText(),
              style: TextStyle(
                color: u.textMuted,
                fontSize: 11,
                fontWeight: FontWeight.w400,
              ),
            ),
          ],
        ),
        actions: [
          if (_isOwner && _active)
            TextButton(
              onPressed: _status?.attendanceVerified == true && !_completing
                  ? _complete
                  : null,
              child: _completing
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Complete'),
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                if (_error != null)
                  MaterialBanner(
                    content: Text(_error!),
                    actions: [
                      TextButton(
                        onPressed: () {
                          setState(() => _error = null);
                          unawaited(_refreshMessages());
                          unawaited(_heartbeat());
                        },
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                Container(
                  width: double.infinity,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  decoration: BoxDecoration(
                    color: u.surfaceCard,
                    border: Border(
                      bottom: BorderSide(color: u.structuralBorder),
                    ),
                  ),
                  child: Text(
                    'You are talking to the real person, not their AI Twin. '
                    'This private room is used only for this owner-access session.',
                    style: TextStyle(
                      color: u.textMuted,
                      fontSize: 12,
                      height: 1.35,
                    ),
                  ),
                ),
                Expanded(
                  child: _messages.isEmpty
                      ? Center(
                          child: Padding(
                            padding: const EdgeInsets.all(28),
                            child: Text(
                              _active
                                  ? 'Say hello when you are ready.'
                                  : 'No messages in this session.',
                              textAlign: TextAlign.center,
                              style: TextStyle(color: u.textMuted),
                            ),
                          ),
                        )
                      : ListView.builder(
                          controller: _scroll,
                          padding: const EdgeInsets.fromLTRB(12, 16, 12, 16),
                          itemCount: _messages.length,
                          itemBuilder: (context, index) {
                            final message = _messages[index];
                            final mine = message.senderUserId == userId;
                            return Align(
                              alignment: mine
                                  ? Alignment.centerRight
                                  : Alignment.centerLeft,
                              child: Container(
                                constraints:
                                    const BoxConstraints(maxWidth: 320),
                                margin: const EdgeInsets.only(bottom: 8),
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 13,
                                  vertical: 9,
                                ),
                                decoration: BoxDecoration(
                                  color: mine
                                      ? u.brand.withValues(alpha: .12)
                                      : u.surfaceCard,
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(
                                    color: mine
                                        ? u.brand.withValues(alpha: .20)
                                        : u.structuralBorder,
                                  ),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Align(
                                      alignment: Alignment.centerLeft,
                                      child: Text(
                                        message.body,
                                        style: TextStyle(
                                          color: u.textPrimary,
                                          height: 1.35,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      TimeOfDay.fromDateTime(message.sentAt)
                                          .format(context),
                                      style: TextStyle(
                                        color: u.textMuted,
                                        fontSize: 10,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                ),
                SafeArea(
                  top: false,
                  child: Container(
                    padding: const EdgeInsets.fromLTRB(10, 8, 8, 8),
                    decoration: BoxDecoration(
                      color: u.surfaceCard,
                      border: Border(
                        top: BorderSide(color: u.structuralBorder),
                      ),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _composer,
                            enabled: _active && !_sending,
                            minLines: 1,
                            maxLines: 5,
                            textCapitalization: TextCapitalization.sentences,
                            decoration: InputDecoration(
                              hintText: _active
                                  ? 'Message the real person'
                                  : 'Session closed',
                              isDense: true,
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(22),
                                borderSide:
                                    BorderSide(color: u.structuralBorder),
                              ),
                            ),
                            onSubmitted: (_) => _send(),
                          ),
                        ),
                        const SizedBox(width: 6),
                        IconButton.filled(
                          tooltip: 'Send',
                          onPressed: _active && !_sending ? _send : null,
                          icon: _sending
                              ? const SizedBox(
                                  width: 17,
                                  height: 17,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Icon(Icons.send_rounded),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
    );
  }
}
