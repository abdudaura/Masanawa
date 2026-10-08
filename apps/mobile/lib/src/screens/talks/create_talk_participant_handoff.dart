import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/talk_state.dart';
import '../../talks/talk_ai_seat.dart';
import '../../talks/talk_create_action_store.dart';
import '../../talks/talk_models.dart';
import '../../talks/talk_share.dart';
import 'add_ai_seat_sheet.dart';

typedef PresentCreatedAiSeat = Future<TalkAiSeatRequest?> Function(
  BuildContext context, {
  required String talkId,
  required TalkAiPersonaKind kind,
});

/// Presents *pending choices*, not an automatically charged AI Seat. The
/// real Talk ID exists before share links or server-quoted seats are opened.
/// A durable, account-local queue lets the Host resume after app restart.
class TalkCreateParticipantHandoff extends ConsumerStatefulWidget {
  const TalkCreateParticipantHandoff({
    super.key,
    required this.talkId,
    this.initialTalk,
    required this.isHost,
    required this.child,
    this.presentAiSeat,
    this.shareTalk,
  });

  final String talkId;
  final TalkDiscoveryItem? initialTalk;
  final bool isHost;
  final Widget child;
  final PresentCreatedAiSeat? presentAiSeat;
  final Future<void> Function(TalkSharePayload payload)? shareTalk;

  @override
  ConsumerState<TalkCreateParticipantHandoff> createState() =>
      _TalkCreateParticipantHandoffState();
}

class _TalkCreateParticipantHandoffState
    extends ConsumerState<TalkCreateParticipantHandoff> {
  List<TalkCreateParticipantAction> _pending = const [];
  ScaffoldFeatureController<MaterialBanner, MaterialBannerClosedReason>? _banner;
  bool _working = false;
  int _loadVersion = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _restore());
  }

  @override
  void didUpdateWidget(covariant TalkCreateParticipantHandoff oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.talkId != widget.talkId || oldWidget.isHost != widget.isHost) {
      _loadVersion++;
      _banner?.close();
      _banner = null;
      _pending = const [];
      WidgetsBinding.instance.addPostFrameCallback((_) => _restore());
    }
  }

  @override
  void dispose() {
    _loadVersion++;
    _banner?.close();
    _banner = null;
    super.dispose();
  }

  void _message(String value) {
    if (!mounted) return;
    ScaffoldMessenger.maybeOf(context)?.showSnackBar(
      SnackBar(content: Text(value)),
    );
  }

  Future<void> _restore() async {
    if (!mounted || !widget.isHost) return;
    final version = ++_loadVersion;
    try {
      final actions = await ref.read(talkCreateActionStoreProvider).load(widget.talkId);
      if (!mounted || version != _loadVersion) return;
      setState(() => _pending = actions);
      WidgetsBinding.instance.addPostFrameCallback((_) => _offerNext());
    } catch (_) {
      if (!mounted || version != _loadVersion) return;
      _message('Couldn’t restore pending invitations. Use Share or Add AI in this Talk.');
    }
  }

  String _label(TalkCreateParticipantAction action) => switch (action) {
    TalkCreateParticipantAction.invitePerson => 'Invite a human speaker',
    TalkCreateParticipantAction.addExpert => 'Choose an Expert',
    TalkCreateParticipantAction.addTwin => 'Choose your Twin',
  };

  String _description(TalkCreateParticipantAction action) => switch (action) {
    TalkCreateParticipantAction.invitePerson =>
      'Share this Talk’s link. Invited people request a free human Seat.',
    TalkCreateParticipantAction.addExpert =>
      'See real available Experts and a fresh server-priced Seat quote. No charge yet.',
    TalkCreateParticipantAction.addTwin =>
      'Select an owned Twin and review its current Seat fee before confirming.',
  };

  void _offerNext() {
    if (!mounted || !widget.isHost || _pending.isEmpty ||
        _working || _banner != null) return;
    final messenger = ScaffoldMessenger.maybeOf(context);
    if (messenger == null) return;
    final action = _pending.first;
    _banner = messenger.showMaterialBanner(
      MaterialBanner(
        key: const ValueKey('create-talk-action-banner'),
        leading: const Icon(Icons.people_alt_outlined),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(_label(action),
                style: const TextStyle(fontWeight: FontWeight.w700)),
            Text(_description(action)),
          ],
        ),
        actions: [
          TextButton(
            key: const ValueKey('create-talk-action-skip'),
            onPressed: _working ? null : () => _complete(action),
            child: const Text('Skip'),
          ),
          FilledButton(
            key: const ValueKey('create-talk-action-continue'),
            onPressed: _working ? null : () => _continue(action),
            child: const Text('Continue'),
          ),
        ],
      ),
    );
  }

  Future<void> _complete(TalkCreateParticipantAction action) async {
    if (_working || _pending.isEmpty || _pending.first != action) return;
    _working = true;
    try {
      final remaining = _pending.skip(1).toList(growable: false);
      await ref.read(talkCreateActionStoreProvider).save(widget.talkId, remaining);
      if (!mounted) return;
      _banner?.close();
      _banner = null;
      setState(() => _pending = remaining);
      WidgetsBinding.instance.addPostFrameCallback((_) => _offerNext());
    } catch (_) {
      _message('Couldn’t save your choice. Please retry; no payment was started.');
    } finally {
      _working = false;
    }
  }

  Future<void> _continue(TalkCreateParticipantAction action) async {
    if (_working || _pending.isEmpty || _pending.first != action) return;
    _working = true;
    _banner?.close();
    _banner = null;
    try {
      switch (action) {
        case TalkCreateParticipantAction.invitePerson:
          final payload = TalkSharePayload(
            talkId: widget.talkId,
            title: widget.initialTalk?.title ?? 'Masanawa Talk',
            hostName: widget.initialTalk?.hostName ?? '',
          );
          await (widget.shareTalk ?? const SystemTalkShareService().share)(payload);
          if (!mounted) return;
          _message('Use Share in the Talk to invite more people.');
        case TalkCreateParticipantAction.addExpert:
        case TalkCreateParticipantAction.addTwin:
          final kind = action == TalkCreateParticipantAction.addExpert
              ? TalkAiPersonaKind.expert
              : TalkAiPersonaKind.twin;
          final request = await (widget.presentAiSeat ?? _showSeat)(
            context, talkId: widget.talkId, kind: kind,
          );
          if (!mounted) return;
          if (request != null) {
            ref.invalidate(talkDetailProvider(widget.talkId));
            _message(request.message.isNotEmpty
                ? request.message
                : request.status == TalkAiSeatRequestStatus.admitted
                    ? 'AI Seat admitted.'
                    : 'Seat request saved. Check the Talk for its status.');
          }
      }
      // Closing the actual quote picker without paying is a valid Skip, not
      // evidence of a paid or admitted Seat.
      await ref.read(talkCreateActionStoreProvider).save(
        widget.talkId,
        _pending.skip(1).toList(growable: false),
      );
      if (!mounted) return;
      setState(() => _pending = _pending.skip(1).toList(growable: false));
    } catch (_) {
      _message('Couldn’t complete that action. Try again from the Talk.');
    } finally {
      _working = false;
      if (mounted) {
        WidgetsBinding.instance.addPostFrameCallback((_) => _offerNext());
      }
    }
  }

  Future<TalkAiSeatRequest?> _showSeat(
    BuildContext context, {
    required String talkId,
    required TalkAiPersonaKind kind,
  }) => showAddAiSeatSheet(
    context,
    talkId: talkId,
    isHost: true,
    initialKind: kind,
  );

  @override
  Widget build(BuildContext context) => widget.child;
}
