import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/talk_state.dart';
import '../../state/session_state.dart';
import '../../talks/talk_ai_seat.dart';
import '../../talks/talk_create_action_store.dart';
import '../../talks/talk_models.dart';
import '../../talks/talk_share.dart';
import 'add_ai_seat_sheet.dart';

/// A route query such as ?host=1 is not authorization. Only the server's
/// canonical Host user ID compared to this authenticated account enables
/// persisted post-create actions to be offered.
abstract interface class TalkCreateHostGuard {
  Future<bool> isHost(String talkId);
}

class ServerTalkCreateHostGuard implements TalkCreateHostGuard {
  const ServerTalkCreateHostGuard({
    required this.transport,
    required this.viewerUserId,
  });

  final TalkTransport transport;
  final String viewerUserId;

  @override
  Future<bool> isHost(String talkId) async {
    if (viewerUserId.isEmpty) return false;
    final detail = await transport.loadTalk(talkId);
    return detail.talk.participants.any((person) =>
        person.isHost &&
        person.kind == TalkParticipantKind.human &&
        person.id == viewerUserId);
  }
}

final talkCreateHostGuardProvider = Provider<TalkCreateHostGuard>((ref) {
  final userId = ref.watch(sessionProvider.select(
    (session) => session is SessionSignedIn ? session.user.id : '',
  ));
  return ServerTalkCreateHostGuard(
    transport: ref.watch(talkTransportProvider),
    viewerUserId: userId,
  );
});

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
  bool _authorizedHost = false;
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
      _authorizedHost = false;
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
      final authorized = await ref.read(talkCreateHostGuardProvider)
          .isHost(widget.talkId);
      if (!mounted || version != _loadVersion || !authorized) return;
      final actions = await ref.read(talkCreateActionStoreProvider).load(widget.talkId);
      if (!mounted || version != _loadVersion) return;
      setState(() {
        _authorizedHost = true;
        _pending = actions;
      });
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
    if (!mounted || !widget.isHost || !_authorizedHost || _pending.isEmpty ||
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
    final talkId = widget.talkId;
    _working = true;
    try {
      final remaining = _pending.skip(1).toList(growable: false);
      await ref.read(talkCreateActionStoreProvider).save(talkId, remaining);
      if (!mounted || widget.talkId != talkId) return;
      _banner?.close();
      _banner = null;
      setState(() => _pending = remaining);
    } catch (_) {
      _message('Couldn’t save your choice. Please retry; no payment was started.');
    } finally {
      _working = false;
      if (mounted && widget.talkId == talkId) {
        WidgetsBinding.instance.addPostFrameCallback((_) => _offerNext());
      }
    }
  }

  Future<void> _continue(TalkCreateParticipantAction action) async {
    if (_working || _pending.isEmpty || _pending.first != action) return;
    final talkId = widget.talkId;
    final remaining = _pending.skip(1).toList(growable: false);
    _working = true;
    _banner?.close();
    _banner = null;
    var actionStarted = false;
    try {
      // Consume the handoff BEFORE a possible financial confirmation. A
      // cancelled picker, app kill or failed post-confirmation storage write
      // must never replay an AI Seat purchase as a new pending action.
      await ref.read(talkCreateActionStoreProvider).save(talkId, remaining);
      if (!mounted || widget.talkId != talkId) return;
      setState(() => _pending = remaining);
      actionStarted = true;
      switch (action) {
        case TalkCreateParticipantAction.invitePerson:
          final payload = TalkSharePayload(
            talkId: talkId,
            title: widget.initialTalk?.title ?? 'Masanawa Talk',
            hostName: widget.initialTalk?.hostName ?? '',
          );
          await (widget.shareTalk ?? const SystemTalkShareService().share)(payload);
          if (!mounted || widget.talkId != talkId) return;
          _message('Use Share in the Talk to invite more people.');
        case TalkCreateParticipantAction.addExpert:
        case TalkCreateParticipantAction.addTwin:
          final kind = action == TalkCreateParticipantAction.addExpert
              ? TalkAiPersonaKind.expert
              : TalkAiPersonaKind.twin;
          final request = await (widget.presentAiSeat ?? _showSeat)(
            context, talkId: talkId, kind: kind,
          );
          if (!mounted || widget.talkId != talkId) return;
          if (request != null) {
            ref.invalidate(talkDetailProvider(talkId));
            _message(request.message.isNotEmpty
                ? request.message
                : request.status == TalkAiSeatRequestStatus.admitted
                    ? 'AI Seat admitted.'
                    : 'Seat request saved. Check the Talk for its status.');
          }
      }
      // Dismissing the real quote picker without paying is a valid choice.
      // The Host can always open Add AI or Share again in the live Talk.
    } catch (_) {
      _message(actionStarted
          ? 'That action could not finish. Use Add AI or Share in this Talk to retry.'
          : 'Could not save your selection. No invitation or payment was started.');
    } finally {
      _working = false;
      if (mounted && widget.talkId == talkId) {
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
    onlyOwnedTwin: kind == TalkAiPersonaKind.twin,
  );

  @override
  Widget build(BuildContext context) => widget.child;
}
