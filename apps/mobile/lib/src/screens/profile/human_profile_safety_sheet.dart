import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/session_state.dart';
import '../../talks/talk_safety.dart';
import '../../social/human_profile_safety_transport.dart';

/// Every switch commits a desired state to the authenticated Gateway and then
/// reads it back; no success is displayed on an uncertain network response.
class HumanProfileSafetySheet extends ConsumerStatefulWidget {
  const HumanProfileSafetySheet({
    super.key,
    required this.handle,
    required this.displayName,
  });
  final String handle;
  final String displayName;

  @override
  ConsumerState<HumanProfileSafetySheet> createState() =>
      _HumanProfileSafetySheetState();
}

class _HumanProfileSafetySheetState extends ConsumerState<HumanProfileSafetySheet> {
  String? _ownerId;
  TalkSafetyPreference? _preference;
  bool _busy = false;
  bool _uncertain = false;
  String? _status;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _refresh();
    });
  }

  bool _matchesOwner() {
    final session = ref.read(sessionProvider);
    return session is SessionSignedIn &&
        _ownerId != null && session.user.id == _ownerId;
  }

  Future<void> _refresh() async {
    if (_busy) return;
    final session = ref.read(sessionProvider);
    if (session is! SessionSignedIn) {
      setState(() => _status = 'Sign in to update your preferences.');
      return;
    }
    if (_ownerId != null && _ownerId != session.user.id) {
      setState(() =>
          _status = 'Your account changed. Close and reopen these controls.');
      return;
    }
    _ownerId = session.user.id;
    setState(() {
      _busy = true;
      _status = null;
    });
    try {
      final actual = await ref.read(humanProfileSafetyTransportProvider)
          .load(widget.handle);
      if (!mounted || !_matchesOwner()) return;
      setState(() {
        _preference = actual;
        _uncertain = false;
      });
    } catch (_) {
      if (!mounted || !_matchesOwner()) return;
      setState(() {
        _uncertain = true;
        _status = 'Could not load current preferences. Check your connection and refresh.';
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _save({required bool blocked, required bool muted}) async {
    if (_busy || _uncertain || _preference == null || !_matchesOwner()) return;
    setState(() {
      _busy = true;
      _status = null;
    });
    try {
      final transport = ref.read(humanProfileSafetyTransportProvider);
      await transport.update(
        handle: widget.handle,
        blocked: blocked,
        muted: muted,
      );
      final actual = await transport.load(widget.handle);
      if (!mounted || !_matchesOwner()) return;
      setState(() {
        _preference = actual;
        _uncertain = actual.blocked != blocked || actual.muted != muted;
        _status = _uncertain
            ? 'Another update changed your preference. Refresh before editing.'
            : 'Privacy preference saved.';
      });
    } catch (_) {
      if (!mounted || !_matchesOwner()) return;
      setState(() {
        _uncertain = true;
        _status = 'The update may have applied. Refresh to confirm its server state.';
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    final signedIn = session is SessionSignedIn;
    final currentUserId = signedIn ? session.user.id : null;
    final changed = _ownerId != null && currentUserId != _ownerId;
    final editable = signedIn && !changed &&
        _ownerId != null && !_busy && !_uncertain && _preference != null;

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          16, 14, 16, 18 + MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Privacy · ' + widget.displayName,
              maxLines: 2, overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            const Text('Blocking hides this person’s Talks and prevents '
              'supported Talk interactions. Muting hides their Talks from your '
              'feed. These choices are private to your signed-in account.'),
            if (!signedIn || changed) ...[
              const SizedBox(height: 12),
              const Text('Sign in or close and reopen after switching accounts.'),
            ],
            if (_busy) ...[
              const SizedBox(height: 12),
              const Center(child: CircularProgressIndicator()),
            ],
            if (_preference != null) ...[
              const SizedBox(height: 12),
              SwitchListTile(
                key: const ValueKey('human-safety-block'),
                title: const Text('Block person'),
                subtitle: const Text('Hide Talks and stop supported interactions'),
                value: _preference!.blocked,
                onChanged: editable
                    ? (value) => _save(
                        blocked: value, muted: _preference!.muted,
                      )
                    : null,
              ),
              SwitchListTile(
                key: const ValueKey('human-safety-mute'),
                title: const Text('Mute person'),
                subtitle: const Text('Hide their public Talks from your feed'),
                value: _preference!.muted,
                onChanged: editable
                    ? (value) => _save(
                        blocked: _preference!.blocked, muted: value,
                      )
                    : null,
              ),
            ],
            if (_status != null) ...[
              const SizedBox(height: 12),
              Text(_status!, key: const ValueKey('human-safety-status')),
            ],
            const SizedBox(height: 12),
            OutlinedButton.icon(
              key: const ValueKey('human-safety-refresh'),
              onPressed: _busy || !signedIn || changed ? null : _refresh,
              icon: const Icon(Icons.refresh),
              label: Text(_uncertain ? 'Refresh to verify' : 'Refresh'),
            ),
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Close'),
            ),
          ],
        ),
      ),
    );
  }
}
