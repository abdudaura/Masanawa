import 'dart:async';
import 'dart:ui' show FontFeature;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../state/talk_direct_twin_state.dart';
import '../../state/talk_gift_state.dart';
import '../../state/talk_host_controls_state.dart';
import '../../state/talk_library_state.dart';
import '../../state/talk_live_state.dart';
import '../../state/talk_participation_state.dart';
import '../../state/talk_poll_state.dart';
import '../../state/talk_question_state.dart';
import '../../state/talk_replay_playback_state.dart';
import '../../state/talk_state.dart';
import '../../state/wallet_state.dart';
import '../../talks/talk_ai_seat.dart';
import '../../talks/talk_direct_twin.dart';
import '../../talks/talk_gift.dart';
import '../../talks/talk_host_controls.dart';
import '../../talks/talk_live.dart';
import '../../talks/talk_live_audio_session.dart';
import '../../talks/talk_participation.dart';
import '../../talks/talk_polls.dart';
import '../../talks/talk_replay_playback.dart';
import '../../talks/talk_share.dart';
import '../../talks/talk_models.dart';
import '../../theme/masanawa_theme.dart';
import 'add_ai_seat_sheet.dart';
import 'talk_direct_twin_sheet.dart';
import 'talk_gift_sheet.dart';
import 'talk_gift_stage_overlay.dart';
import 'talk_host_controls_sheets.dart';
import 'talk_more_sheet.dart';
import 'talk_participation_sheets.dart';
import 'talk_poll_sheet.dart';
import 'talk_question_sheet.dart';

final talkShareServiceProvider = Provider<TalkShareService>(
  (_) => const SystemTalkShareService(),
);

class TalkScreen extends ConsumerStatefulWidget {
  const TalkScreen({
    super.key,
    required this.talkId,
    this.initialTalk,
    this.isHost = false,
    this.onAddAi,
    this.onGift,
    this.onRaiseHand,
  });

  final String talkId;
  final TalkDiscoveryItem? initialTalk;
  final bool isHost;
  final VoidCallback? onAddAi;
  final VoidCallback? onGift;
  final VoidCallback? onRaiseHand;

  @override
  ConsumerState<TalkScreen> createState() => _TalkScreenState();
}

class _TalkScreenState extends ConsumerState<TalkScreen> {
  final _commentController = TextEditingController();
  bool _postingComment = false;
  bool _reacting = false;
  bool _handBusy = false;
  bool _endingTalk = false;
  bool _savingTalk = false;
  TalkGiftReceipt? _giftAcknowledgement;
  TalkGiftCatalogItem? _giftAcknowledgementItem;
  Timer? _giftAcknowledgementTimer;
  bool _pollBusy = false;
  TalkLiveAudioController? _liveAudio;
  StreamSubscription<TalkLiveAudioStatus>? _liveAudioSub;
  TalkLiveAudioStatus _liveAudioStatus = TalkLiveAudioStatus.idle;
  TalkLiveRole? _liveAudioRole;
  bool _liveAudioMuted = false;
  String? _liveAudioError;
  bool _liveAudioStartScheduled = false;
  TalkReplayPlaybackController? _replayPlayback;
  StreamSubscription<TalkReplayPlaybackSnapshot>? _replayPlaybackSub;
  TalkReplayPlaybackSnapshot _replaySnapshot =
      const TalkReplayPlaybackSnapshot();

  @override
  void initState() {
    super.initState();
    if (widget.initialTalk?.isLive == true) {
      _scheduleLiveAudioStart();
    }
  }

  @override
  void dispose() {
    _commentController.dispose();
    _giftAcknowledgementTimer?.cancel();
    unawaited(_liveAudioSub?.cancel());
    final liveAudio = _liveAudio;
    _liveAudio = null;
    if (liveAudio != null) unawaited(liveAudio.close());
    unawaited(_replayPlaybackSub?.cancel());
    final replayPlayback = _replayPlayback;
    _replayPlayback = null;
    if (replayPlayback != null) unawaited(replayPlayback.close());
    super.dispose();
  }

  void _scheduleLiveAudioStart() {
    if (_liveAudio != null || _liveAudioStartScheduled) return;
    _liveAudioStartScheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _liveAudioStartScheduled = false;
      if (!mounted || _liveAudio != null) return;
      unawaited(_startLiveAudio());
    });
  }

  Future<void> _startLiveAudio() async {
    if (_liveAudio != null || !mounted) return;
    final controller = ref.read(talkLiveAudioFactoryProvider)(widget.talkId);
    _liveAudio = controller;
    _liveAudioStatus = controller.status;
    _liveAudioRole = controller.role;
    _liveAudioMuted = controller.muted;
    _liveAudioError = controller.errorMessage;
    _liveAudioSub = controller.states.listen((status) {
      if (!mounted || !identical(_liveAudio, controller)) return;
      setState(() {
        _liveAudioStatus = status;
        _liveAudioRole = controller.role;
        _liveAudioMuted = controller.muted;
        _liveAudioError = controller.errorMessage;
      });
    });

    try {
      await controller.start();
      if (!mounted || !identical(_liveAudio, controller)) return;
      setState(() {
        _liveAudioStatus = controller.status;
        _liveAudioRole = controller.role;
        _liveAudioMuted = controller.muted;
        _liveAudioError = controller.errorMessage;
      });
    } catch (_) {
      if (!mounted || !identical(_liveAudio, controller)) return;
      setState(() {
        _liveAudioStatus = TalkLiveAudioStatus.failed;
        _liveAudioError = 'Live audio is unavailable right now.';
      });
    }
  }

  Future<void> _retryLiveAudio() async {
    final previous = _liveAudio;
    _liveAudio = null;
    await _liveAudioSub?.cancel();
    _liveAudioSub = null;
    if (previous != null) await previous.close();
    if (!mounted) return;
    setState(() {
      _liveAudioStatus = TalkLiveAudioStatus.idle;
      _liveAudioRole = null;
      _liveAudioMuted = false;
      _liveAudioError = null;
    });
    await _startLiveAudio();
  }

  Future<void> _toggleLiveMute() async {
    final controller = _liveAudio;
    if (controller == null ||
        (controller.role != TalkLiveRole.host &&
            controller.role != TalkLiveRole.speaker)) {
      return;
    }
    await controller.setMuted(!controller.muted);
    if (!mounted || !identical(_liveAudio, controller)) return;
    setState(() {
      _liveAudioStatus = controller.status;
      _liveAudioMuted = controller.muted;
      _liveAudioError = controller.errorMessage;
    });
  }

  TalkReplayPlaybackController _ensureReplayPlayback() {
    final existing = _replayPlayback;
    if (existing != null) return existing;
    final controller = ref.read(talkReplayPlaybackFactoryProvider)(
      widget.talkId,
    );
    _replayPlayback = controller;
    _replaySnapshot = controller.snapshot;
    _replayPlaybackSub = controller.snapshots.listen((snapshot) {
      if (!mounted || !identical(_replayPlayback, controller)) return;
      setState(() => _replaySnapshot = snapshot);
    });
    return controller;
  }

  Future<void> _toggleReplayPlayback() async {
    final controller = _ensureReplayPlayback();
    await controller.toggle();
    if (!mounted || !identical(_replayPlayback, controller)) return;
    setState(() => _replaySnapshot = controller.snapshot);
  }

  Future<void> _retryReplayPlayback() async {
    final controller = _ensureReplayPlayback();
    await controller.retry();
    if (!mounted || !identical(_replayPlayback, controller)) return;
    setState(() => _replaySnapshot = controller.snapshot);
  }

  Future<void> _seekReplayPlayback(double fraction) async {
    final controller = _replayPlayback;
    if (controller == null) return;
    await controller.seekTo(fraction);
    if (!mounted || !identical(_replayPlayback, controller)) return;
    setState(() => _replaySnapshot = controller.snapshot);
  }

  Future<void> _openAiSeatSheet() async {
    final callback = widget.onAddAi;
    if (callback != null) {
      callback();
      return;
    }
    final request = await showAddAiSeatSheet(
      context,
      talkId: widget.talkId,
      isHost: widget.isHost,
    );
    if (!mounted || request == null) return;
    ref.invalidate(talkDetailProvider(widget.talkId));
    final message = switch (request.status) {
      TalkAiSeatRequestStatus.pendingHost =>
        request.message.isNotEmpty
            ? request.message
            : 'Seat sponsored. Waiting for the Host to accept it.',
      TalkAiSeatRequestStatus.admitted =>
        request.message.isNotEmpty ? request.message : 'AI added to the Talk.',
      TalkAiSeatRequestStatus.declined =>
        request.message.isNotEmpty
            ? request.message
            : 'The Seat request was declined.',
      TalkAiSeatRequestStatus.expired =>
        request.message.isNotEmpty
            ? request.message
            : 'The Seat request expired.',
      TalkAiSeatRequestStatus.unknown =>
        request.message.isNotEmpty
            ? request.message
            : 'Seat request submitted.',
    };
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _react() async {
    if (_reacting) return;
    final reaction = await showTalkReactionPicker(context);
    if (!mounted || reaction == null) return;
    setState(() => _reacting = true);
    try {
      await ref
          .read(talkParticipationTransportProvider)
          .react(talkId: widget.talkId, reaction: reaction);
      ref.invalidate(talkParticipationProvider(widget.talkId));
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(reaction + ' sent')));
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Couldn’t send your reaction.')),
      );
    } finally {
      if (mounted) setState(() => _reacting = false);
    }
  }

  Future<void> _leaveSeat() async {
    if (_handBusy || widget.isHost) return;
    setState(() => _handBusy = true);
    try {
      await ref
          .read(talkParticipationTransportProvider)
          .leaveSeat(widget.talkId);
      ref.invalidate(talkParticipationProvider(widget.talkId));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('You’re back in the Audience.')),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Couldn’t leave the Speaker seat.')),
      );
      return;
    } finally {
      if (mounted) setState(() => _handBusy = false);
    }
    // The seat change is complete even if reconnecting listener audio fails.
    try {
      await _retryLiveAudio();
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _liveAudioStatus = TalkLiveAudioStatus.failed;
        _liveAudioError = 'Live audio is unavailable right now.';
      });
    }
  }

  Future<void> _raiseHand(TalkHandStatus status) async {
    final callback = widget.onRaiseHand;
    if (callback != null) {
      callback();
      return;
    }
    if (_handBusy || widget.isHost) return;
    if (status == TalkHandStatus.accepted) {
      await _leaveSeat();
      return;
    }
    final raised = await showRaiseHandSheet(context, status: status);
    if (!mounted || raised == null) return;
    setState(() => _handBusy = true);
    try {
      final next = await ref
          .read(talkParticipationTransportProvider)
          .setHandRaised(talkId: widget.talkId, raised: raised);
      ref.invalidate(talkParticipationProvider(widget.talkId));
      if (!mounted) return;
      final message = switch (next.handStatus) {
        TalkHandStatus.raised => 'Hand raised. Waiting for the Host.',
        TalkHandStatus.accepted => 'The Host accepted you as a Speaker.',
        TalkHandStatus.declined => 'The Host declined the request.',
        TalkHandStatus.idle => 'Hand lowered.',
      };
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(message)));
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Couldn’t update your hand right now.')),
      );
    } finally {
      if (mounted) setState(() => _handBusy = false);
    }
  }

  Future<void> _createPoll() async {
    if (!widget.isHost || _pollBusy) return;
    final draft = await showCreateTalkPollSheet(context);
    if (!mounted || draft == null) return;
    setState(() => _pollBusy = true);
    try {
      await ref
          .read(talkPollTransportProvider)
          .create(
            talkId: widget.talkId,
            question: draft.question,
            options: draft.options,
          );
      ref.invalidate(talkPollProvider(widget.talkId));
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Couldn’t start the poll. Try again.')),
      );
    } finally {
      if (mounted) setState(() => _pollBusy = false);
    }
  }

  Future<void> _votePoll(String optionId) async {
    if (_pollBusy) return;
    final poll = ref.read(talkPollProvider(widget.talkId)).asData?.value;
    if (poll == null || !poll.isOpen) return;
    setState(() => _pollBusy = true);
    try {
      await ref
          .read(talkPollTransportProvider)
          .vote(talkId: widget.talkId, pollId: poll.pollId, optionId: optionId);
      ref.invalidate(talkPollProvider(widget.talkId));
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Couldn’t record your vote. Try again.')),
      );
    } finally {
      if (mounted) setState(() => _pollBusy = false);
    }
  }

  Future<void> _closePoll() async {
    if (!widget.isHost || _pollBusy) return;
    final poll = ref.read(talkPollProvider(widget.talkId)).asData?.value;
    if (poll == null || !poll.isOpen) return;
    setState(() => _pollBusy = true);
    try {
      await ref
          .read(talkPollTransportProvider)
          .close(talkId: widget.talkId, pollId: poll.pollId);
      ref.invalidate(talkPollProvider(widget.talkId));
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Couldn’t close the poll. Try again.')),
      );
    } finally {
      if (mounted) setState(() => _pollBusy = false);
    }
  }

  Future<void> _askQuestion() async {
    if (widget.isHost) return;
    final body = await showTalkQuestionSheet(context);
    if (!mounted || body == null) return;
    try {
      await ref
          .read(talkQuestionTransportProvider)
          .submit(talkId: widget.talkId, body: body);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Question sent to the Host.')),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Couldn’t send your question right now.')),
      );
    }
  }

  Future<void> _openHostQuestions() async {
    await showTalkHostQuestionsSheet(context, talkId: widget.talkId);
    if (!mounted) return;
    ref.invalidate(talkHostQuestionsProvider(widget.talkId));
  }

  Future<void> _openHostRequests() async {
    await showTalkHostRequestsSheet(context, talkId: widget.talkId);
    if (!mounted) return;
    ref.invalidate(talkHostControlsProvider(widget.talkId));
    ref.invalidate(talkDetailProvider(widget.talkId));
  }

  Future<void> _openHostManage() async {
    await showTalkHostManageSheet(context, talkId: widget.talkId);
    if (!mounted) return;
    ref.invalidate(talkHostControlsProvider(widget.talkId));
    ref.invalidate(talkDetailProvider(widget.talkId));
  }

  Future<void> _endTalk() async {
    if (_endingTalk || !widget.isHost) return;
    final confirmed = await confirmEndTalk(context);
    if (!mounted || !confirmed) return;
    setState(() => _endingTalk = true);
    try {
      await ref.read(talkHostControlsTransportProvider).endTalk(widget.talkId);
      ref.invalidate(talkDetailProvider(widget.talkId));
      ref.invalidate(talkFeedProvider(TalkFeedKind.explore));
      ref.invalidate(talkFeedProvider(TalkFeedKind.live));
      if (!mounted) return;
      final popped = await Navigator.of(context).maybePop();
      if (!popped && mounted) {
        if (context.canPop()) {
          context.pop();
        } else {
          context.go('/home?tab=talk');
        }
      }
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Couldn’t end the Talk right now.')),
      );
    } finally {
      if (mounted) setState(() => _endingTalk = false);
    }
  }

  void _acknowledgeSettledGift(
    TalkGiftReceipt receipt,
    TalkGiftCatalogItem item,
  ) {
    // Never show celebratory payment feedback until the server's completed
    // receipt matches the exact selected catalog item.
    if (receipt.talkId != widget.talkId ||
        receipt.catalogItemId != item.id ||
        receipt.amountCredits != item.amountCredits) {
      return;
    }
    _giftAcknowledgementTimer?.cancel();
    setState(() {
      _giftAcknowledgement = receipt;
      _giftAcknowledgementItem = item;
    });
    _giftAcknowledgementTimer = Timer(const Duration(milliseconds: 2200), () {
      if (!mounted) return;
      setState(() {
        _giftAcknowledgement = null;
        _giftAcknowledgementItem = null;
      });
    });
  }

  Future<void> _openGift(String hostName) async {
    final callback = widget.onGift;
    if (callback != null) {
      callback();
      return;
    }

    TalkGiftReceipt? receipt;
    TalkGiftCatalogItem? selected;
    final giftTransport = ref.read(talkGiftTransportProvider);
    final sent = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (context) => TalkGiftSheet(
        hostName: hostName,
        loadCatalog: () => giftTransport.loadCatalog(talkId: widget.talkId),
        onGift: (option) async {
          try {
            final completed = await giftTransport.sendGift(
              talkId: widget.talkId,
              amountCredits: option.amountCredits,
              catalogItemId: option.id,
            );
            receipt = completed;
            selected = option;
            ref.invalidate(walletProvider);
            return true;
          } catch (_) {
            return false;
          }
        },
      ),
    );

    if (!mounted || sent != true || receipt == null) return;
    final completed = receipt!;
    final item = selected;
    if (item != null) _acknowledgeSettledGift(completed, item);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          '${completed.amountCredits} Cr sent to ${completed.recipientName}.',
        ),
      ),
    );
  }

  Future<void> _openDirectTwin(List<DirectTwinSeat> seats) async {
    if (seats.isEmpty) return;
    await showDirectTwinSheet(
      context,
      talkId: widget.talkId,
      seats: seats,
      transport: ref.read(directTwinTransportProvider),
    );
    if (!mounted) return;
    ref.invalidate(myDirectTwinSeatsProvider(widget.talkId));
  }

  Future<void> _shareTalk(TalkDiscoveryItem talk) async {
    try {
      await ref
          .read(talkShareServiceProvider)
          .share(
            TalkSharePayload(
              talkId: talk.id,
              title: talk.title,
              hostName: talk.hostName,
            ),
          );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Couldn’t open sharing right now.')),
      );
    }
  }

  Future<void> _openMore(TalkDiscoveryItem talk) async {
    await showTalkMoreSheet(context, talk: talk, isHost: widget.isHost);
    if (!mounted) return;
    ref.invalidate(talkDetailProvider(widget.talkId));
    ref.invalidate(talkFeedProvider(TalkFeedKind.explore));
    ref.invalidate(talkFeedProvider(TalkFeedKind.live));
  }

  Future<void> _toggleSaved(bool isSaved) async {
    if (_savingTalk) return;
    setState(() => _savingTalk = true);
    try {
      final next = await ref
          .read(talkLibraryTransportProvider)
          .setSaved(talkId: widget.talkId, saved: !isSaved);
      ref.invalidate(talkSavedStateProvider(widget.talkId));
      ref.invalidate(savedTalksProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            next.saved ? 'Talk saved.' : 'Removed from Saved Talks.',
          ),
        ),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Couldn’t update Saved Talks right now.')),
      );
    } finally {
      if (mounted) setState(() => _savingTalk = false);
    }
  }

  Future<void> _postComment() async {
    final body = _commentController.text.trim();
    if (body.isEmpty || _postingComment) return;
    setState(() => _postingComment = true);
    try {
      await ref
          .read(talkTransportProvider)
          .addComment(talkId: widget.talkId, body: body);
      _commentController.clear();
      ref.invalidate(talkDetailProvider(widget.talkId));
      if (!mounted) return;
      FocusScope.of(context).unfocus();
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Couldn’t post your comment. Try again.')),
      );
    } finally {
      if (mounted) setState(() => _postingComment = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final detail = ref.watch(talkDetailProvider(widget.talkId));
    final isSaved = ref
        .watch(talkSavedStateProvider(widget.talkId))
        .maybeWhen(data: (value) => value.saved, orElse: () => false);
    final participation = ref
        .watch(talkParticipationProvider(widget.talkId))
        .maybeWhen(
          data: (value) => value,
          orElse: () => const TalkParticipationState(),
        );
    final hostControls = widget.isHost
        ? ref
              .watch(talkHostControlsProvider(widget.talkId))
              .maybeWhen(
                data: (value) => value,
                orElse: () => const TalkHostControlsView(),
              )
        : const TalkHostControlsView();
    final hostQuestionCount = widget.isHost
        ? ref
              .watch(talkHostQuestionsProvider(widget.talkId))
              .maybeWhen(data: (value) => value.length, orElse: () => 0)
        : 0;
    final poll = ref
        .watch(talkPollProvider(widget.talkId))
        .maybeWhen(data: (value) => value, orElse: () => null);
    final ownedTwinSeats = ref
        .watch(myDirectTwinSeatsProvider(widget.talkId))
        .maybeWhen(
          data: (value) => value,
          orElse: () => const <DirectTwinSeat>[],
        );
    final fallback = widget.initialTalk;
    final projectedTalk = detail.maybeWhen(
      data: (value) => value.talk,
      orElse: () => fallback,
    );
    if (projectedTalk?.isLive == true) {
      _scheduleLiveAudioStart();
    }

    return Stack(children: [detail.when(
      data: (value) => _TalkBody(
        talk: value.talk,
        comments: value.comments,
        controller: _commentController,
        postingComment: _postingComment,
        onPostComment: _postComment,
        isSaved: isSaved,
        savingTalk: _savingTalk,
        onToggleSaved: () => _toggleSaved(isSaved),
        onShare: () => _shareTalk(value.talk),
        onMore: () => _openMore(value.talk),
        onDirectTwin: value.talk.isLive && ownedTwinSeats.isNotEmpty
            ? () => _openDirectTwin(ownedTwinSeats)
            : null,
        isHost: widget.isHost,
        liveAudioStatus: _liveAudioStatus,
        liveAudioRole: _liveAudioRole,
        liveAudioMuted: _liveAudioMuted,
        liveAudioError: _liveAudioError,
        onRetryLiveAudio: _retryLiveAudio,
        onToggleLiveMute: _toggleLiveMute,
        replaySnapshot: _replaySnapshot,
        onToggleReplay: _toggleReplayPlayback,
        onRetryReplay: _retryReplayPlayback,
        onSeekReplay: _seekReplayPlayback,
        hostRequestCount: hostControls.requests.length,
        hostQuestionCount: hostQuestionCount,
        onHostQuestions: _openHostQuestions,
        onHostRequests: _openHostRequests,
        onHostManage: _openHostManage,
        onEndTalk: _endingTalk ? null : _endTalk,
        onReact: _react,
        reaction: participation.reaction,
        onAddAi: _openAiSeatSheet,
        onGift: widget.isHost ? null : () => _openGift(value.talk.hostName),
        onAskQuestion: value.talk.isLive && !widget.isHost
            ? _askQuestion
            : null,
        poll: value.talk.isLive ? poll : null,
        pollBusy: _pollBusy,
        onCreatePoll: widget.isHost && value.talk.isLive ? _createPoll : null,
        onVotePoll: !widget.isHost && value.talk.isLive ? _votePoll : null,
        onClosePoll: widget.isHost && value.talk.isLive ? _closePoll : null,
        handStatus: participation.handStatus,
        handBusy: _handBusy,
        onRaiseHand: widget.isHost
            ? null
            : () => _raiseHand(participation.handStatus),
      ),
      loading: () {
        if (fallback != null) {
          return _TalkBody(
            talk: fallback,
            comments: const [],
            loadingComments: true,
            controller: _commentController,
            postingComment: _postingComment,
            onPostComment: _postComment,
            isSaved: isSaved,
            savingTalk: _savingTalk,
            onToggleSaved: () => _toggleSaved(isSaved),
            onShare: () => _shareTalk(fallback),
            onMore: () => _openMore(fallback),
            onDirectTwin: fallback.isLive && ownedTwinSeats.isNotEmpty
                ? () => _openDirectTwin(ownedTwinSeats)
                : null,
            isHost: widget.isHost,
            liveAudioStatus: _liveAudioStatus,
            liveAudioRole: _liveAudioRole,
            liveAudioMuted: _liveAudioMuted,
            liveAudioError: _liveAudioError,
            onRetryLiveAudio: _retryLiveAudio,
            onToggleLiveMute: _toggleLiveMute,
            replaySnapshot: _replaySnapshot,
            onToggleReplay: _toggleReplayPlayback,
            onRetryReplay: _retryReplayPlayback,
            onSeekReplay: _seekReplayPlayback,
            hostRequestCount: hostControls.requests.length,
            onHostRequests: _openHostRequests,
            onHostManage: _openHostManage,
            onEndTalk: _endingTalk ? null : _endTalk,
            onReact: _react,
            reaction: participation.reaction,
            onAddAi: _openAiSeatSheet,
            onGift: widget.isHost ? null : () => _openGift(fallback.hostName),
            onAskQuestion: fallback.isLive && !widget.isHost
                ? _askQuestion
                : null,
            poll: fallback.isLive ? poll : null,
            pollBusy: _pollBusy,
            onCreatePoll: widget.isHost && fallback.isLive ? _createPoll : null,
            onVotePoll: !widget.isHost && fallback.isLive ? _votePoll : null,
            onClosePoll: widget.isHost && fallback.isLive ? _closePoll : null,
            handStatus: participation.handStatus,
            handBusy: _handBusy,
            onRaiseHand: widget.isHost
                ? null
                : () => _raiseHand(participation.handStatus),
          );
        }
        return Scaffold(
          appBar: AppBar(
            leading: IconButton(
              icon: const Icon(Icons.arrow_back),
              tooltip: 'Back to Talks',
              onPressed: () {
                if (context.canPop()) {
                  context.pop();
                } else {
                  context.go('/home?tab=talk');
                }
              },
            ),
          ),
          body: const Center(child: CircularProgressIndicator()),
        );
      },
      error: (_, __) {
        if (fallback != null) {
          return _TalkBody(
            talk: fallback,
            comments: const [],
            commentsUnavailable: true,
            controller: _commentController,
            postingComment: _postingComment,
            onPostComment: _postComment,
            isSaved: isSaved,
            savingTalk: _savingTalk,
            onToggleSaved: () => _toggleSaved(isSaved),
            onShare: () => _shareTalk(fallback),
            onMore: () => _openMore(fallback),
            onDirectTwin: fallback.isLive && ownedTwinSeats.isNotEmpty
                ? () => _openDirectTwin(ownedTwinSeats)
                : null,
            isHost: widget.isHost,
            liveAudioStatus: _liveAudioStatus,
            liveAudioRole: _liveAudioRole,
            liveAudioMuted: _liveAudioMuted,
            liveAudioError: _liveAudioError,
            onRetryLiveAudio: _retryLiveAudio,
            onToggleLiveMute: _toggleLiveMute,
            replaySnapshot: _replaySnapshot,
            onToggleReplay: _toggleReplayPlayback,
            onRetryReplay: _retryReplayPlayback,
            onSeekReplay: _seekReplayPlayback,
            hostRequestCount: hostControls.requests.length,
            onHostRequests: _openHostRequests,
            onHostManage: _openHostManage,
            onEndTalk: _endingTalk ? null : _endTalk,
            onReact: _react,
            reaction: participation.reaction,
            onAddAi: _openAiSeatSheet,
            onGift: widget.isHost ? null : () => _openGift(fallback.hostName),
            onAskQuestion: fallback.isLive && !widget.isHost
                ? _askQuestion
                : null,
            poll: fallback.isLive ? poll : null,
            pollBusy: _pollBusy,
            onCreatePoll: widget.isHost && fallback.isLive ? _createPoll : null,
            onVotePoll: !widget.isHost && fallback.isLive ? _votePoll : null,
            onClosePoll: widget.isHost && fallback.isLive ? _closePoll : null,
            handStatus: participation.handStatus,
            handBusy: _handBusy,
            onRaiseHand: widget.isHost
                ? null
                : () => _raiseHand(participation.handStatus),
          );
        }
        return Scaffold(
          appBar: AppBar(
            leading: IconButton(
              icon: const Icon(Icons.arrow_back),
              tooltip: 'Back to Talks',
              onPressed: () {
                if (context.canPop()) {
                  context.pop();
                } else {
                  context.go('/home?tab=talk');
                }
              },
            ),
          ),
          body: _TalkUnavailable(
            onRetry: () => ref.invalidate(talkDetailProvider(widget.talkId)),
          ),
        );
      },
    ),
      if (_giftAcknowledgement != null && _giftAcknowledgementItem != null)
        Positioned.fill(
          child: TalkGiftStageOverlay(
            receipt: _giftAcknowledgement!,
            item: _giftAcknowledgementItem!,
          ),
        ),
    ]);
  }
}

class _TalkBody extends StatelessWidget {
  const _TalkBody({
    required this.talk,
    required this.comments,
    required this.controller,
    required this.postingComment,
    required this.onPostComment,
    this.loadingComments = false,
    this.commentsUnavailable = false,
    this.isSaved = false,
    this.savingTalk = false,
    this.onToggleSaved,
    this.onShare,
    this.onMore,
    this.onDirectTwin,
    this.isHost = false,
    this.liveAudioStatus = TalkLiveAudioStatus.idle,
    this.liveAudioRole,
    this.liveAudioMuted = false,
    this.liveAudioError,
    this.onRetryLiveAudio,
    this.onToggleLiveMute,
    this.replaySnapshot = const TalkReplayPlaybackSnapshot(),
    this.onToggleReplay,
    this.onRetryReplay,
    this.onSeekReplay,
    this.hostRequestCount = 0,
    this.hostQuestionCount = 0,
    this.onHostQuestions,
    this.onHostRequests,
    this.onHostManage,
    this.onEndTalk,
    this.onReact,
    this.reaction,
    this.onAddAi,
    this.onGift,
    this.onAskQuestion,
    this.poll,
    this.pollBusy = false,
    this.onCreatePoll,
    this.onVotePoll,
    this.onClosePoll,
    this.handStatus = TalkHandStatus.idle,
    this.handBusy = false,
    this.onRaiseHand,
  });

  final TalkDiscoveryItem talk;
  final List<TalkComment> comments;
  final TextEditingController controller;
  final bool postingComment;
  final VoidCallback onPostComment;
  final bool loadingComments;
  final bool commentsUnavailable;
  final bool isSaved;
  final bool savingTalk;
  final VoidCallback? onToggleSaved;
  final VoidCallback? onShare;
  final VoidCallback? onMore;
  final VoidCallback? onDirectTwin;
  final bool isHost;
  final TalkLiveAudioStatus liveAudioStatus;
  final TalkLiveRole? liveAudioRole;
  final bool liveAudioMuted;
  final String? liveAudioError;
  final VoidCallback? onRetryLiveAudio;
  final VoidCallback? onToggleLiveMute;
  final TalkReplayPlaybackSnapshot replaySnapshot;
  final VoidCallback? onToggleReplay;
  final VoidCallback? onRetryReplay;
  final ValueChanged<double>? onSeekReplay;
  final int hostRequestCount;
  final int hostQuestionCount;
  final VoidCallback? onHostQuestions;
  final VoidCallback? onHostRequests;
  final VoidCallback? onHostManage;
  final VoidCallback? onEndTalk;
  final VoidCallback? onReact;
  final String? reaction;
  final VoidCallback? onAddAi;
  final VoidCallback? onGift;
  final VoidCallback? onAskQuestion;
  final TalkPoll? poll;
  final bool pollBusy;
  final VoidCallback? onCreatePoll;
  final ValueChanged<String>? onVotePoll;
  final VoidCallback? onClosePoll;
  final TalkHandStatus handStatus;
  final bool handBusy;
  final VoidCallback? onRaiseHand;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        if (context.canPop()) {
          context.pop();
        } else {
          context.go('/home?tab=talk');
        }
      },
      child: Scaffold(
        backgroundColor: u.surfaceBg,
        appBar: AppBar(
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            tooltip: 'Back to Talks',
            onPressed: () {
              if (context.canPop()) {
                context.pop();
              } else {
                context.go('/home?tab=talk');
              }
            },
          ),
          title: Text(
            talk.isLive ? 'Live Talk' : 'Talk Replay',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        actions: [
          IconButton(
            key: const ValueKey('talk-share'),
            tooltip: 'Share Talk',
            onPressed: onShare,
            icon: const Icon(Icons.share_outlined),
          ),
          if (onDirectTwin != null)
            IconButton(
              key: const ValueKey('talk-direct-twin'),
              tooltip: 'Direct Twin',
              onPressed: onDirectTwin,
              icon: const Icon(Icons.bolt_rounded),
            ),
          IconButton(
            key: const ValueKey('talk-more'),
            tooltip: 'More',
            onPressed: onMore,
            icon: const Icon(Icons.more_vert_rounded),
          ),
          IconButton(
            key: const ValueKey('talk-save-toggle'),
            tooltip: isSaved ? 'Remove from Saved' : 'Save Talk',
            onPressed: savingTalk ? null : onToggleSaved,
            icon: savingTalk
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Icon(
                    isSaved
                        ? Icons.bookmark_rounded
                        : Icons.bookmark_border_rounded,
                  ),
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: CustomScrollView(
              slivers: [
                SliverToBoxAdapter(
                  child: _TalkStage(
                    talk: talk,
                    isHost: isHost && talk.isLive,
                    liveAudioStatus: talk.isLive
                        ? liveAudioStatus
                        : TalkLiveAudioStatus.ended,
                    liveAudioRole: talk.isLive ? liveAudioRole : null,
                    liveAudioMuted: liveAudioMuted,
                    liveAudioError: liveAudioError,
                    onRetryLiveAudio: talk.isLive ? onRetryLiveAudio : null,
                    onToggleLiveMute: talk.isLive ? onToggleLiveMute : null,
                    replaySnapshot: replaySnapshot,
                    onToggleReplay: talk.isLive ? null : onToggleReplay,
                    onRetryReplay: talk.isLive ? null : onRetryReplay,
                    onSeekReplay: talk.isLive ? null : onSeekReplay,
                    hostRequestCount: talk.isLive ? hostRequestCount : 0,
                    hostQuestionCount: talk.isLive ? hostQuestionCount : 0,
                    onHostQuestions: talk.isLive ? onHostQuestions : null,
                    onHostRequests: onHostRequests,
                    onHostManage: onHostManage,
                    onEndTalk: onEndTalk,
                    onReact: onReact,
                    reaction: reaction,
                    onAddAi: onAddAi,
                    onGift: onGift,
                    onAskQuestion: onAskQuestion,
                    handStatus: handStatus,
                    handBusy: handBusy,
                    onRaiseHand: onRaiseHand,
                  ),
                ),
                if (talk.isLive && (poll != null || isHost))
                  SliverToBoxAdapter(
                    child: poll != null
                        ? TalkPollCard(
                            poll: poll!,
                            isHost: isHost,
                            busy: pollBusy,
                            onVote: onVotePoll,
                            onClose: onClosePoll,
                          )
                        : Padding(
                            padding: const EdgeInsets.fromLTRB(16, 12, 16, 2),
                            child: OutlinedButton.icon(
                              key: const ValueKey('talk-poll-start'),
                              onPressed: pollBusy ? null : onCreatePoll,
                              icon: const Icon(Icons.poll_outlined),
                              label: const Text('Start poll'),
                            ),
                          ),
                  ),
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
                    child: Row(
                      children: [
                        Text(
                          'Comments',
                          style: TextStyle(
                            color: u.textPrimary,
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          talk.commentCount > 0
                              ? talk.commentCount.toString()
                              : comments.length.toString(),
                          style: TextStyle(color: u.textMuted, fontSize: 14),
                        ),
                      ],
                    ),
                  ),
                ),
                if (loadingComments)
                  const SliverToBoxAdapter(
                    child: Padding(
                      padding: EdgeInsets.all(24),
                      child: Center(child: CircularProgressIndicator()),
                    ),
                  )
                else if (commentsUnavailable)
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                      child: Text(
                        'Comments couldn’t refresh right now.',
                        style: TextStyle(color: u.textMuted),
                      ),
                    ),
                  )
                else if (comments.isEmpty)
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                      child: Text(
                        'No comments yet. Join the conversation.',
                        style: TextStyle(color: u.textMuted),
                      ),
                    ),
                  )
                else
                  SliverList(
                    delegate: SliverChildBuilderDelegate((context, index) {
                      if (index.isOdd) {
                        return Divider(
                          height: 1,
                          indent: 64,
                          color: u.structuralBorder,
                        );
                      }
                      return _CommentTile(comment: comments[index ~/ 2]);
                    }, childCount: comments.length * 2 - 1),
                  ),
                const SliverToBoxAdapter(child: SizedBox(height: 18)),
              ],
            ),
          ),
          _CommentComposer(
            controller: controller,
            posting: postingComment,
            onSend: onPostComment,
          ),
        ],
      ),
    ),
  );
  }
}

class _TalkStage extends StatelessWidget {
  const _TalkStage({
    required this.talk,
    this.isHost = false,
    this.liveAudioStatus = TalkLiveAudioStatus.idle,
    this.liveAudioRole,
    this.liveAudioMuted = false,
    this.liveAudioError,
    this.onRetryLiveAudio,
    this.onToggleLiveMute,
    this.replaySnapshot = const TalkReplayPlaybackSnapshot(),
    this.onToggleReplay,
    this.onRetryReplay,
    this.onSeekReplay,
    this.hostRequestCount = 0,
    this.hostQuestionCount = 0,
    this.onHostQuestions,
    this.onHostRequests,
    this.onHostManage,
    this.onEndTalk,
    this.onReact,
    this.reaction,
    this.onAddAi,
    this.onGift,
    this.onAskQuestion,
    this.handStatus = TalkHandStatus.idle,
    this.handBusy = false,
    this.onRaiseHand,
  });

  final TalkDiscoveryItem talk;
  final bool isHost;
  final TalkLiveAudioStatus liveAudioStatus;
  final TalkLiveRole? liveAudioRole;
  final bool liveAudioMuted;
  final String? liveAudioError;
  final VoidCallback? onRetryLiveAudio;
  final VoidCallback? onToggleLiveMute;
  final TalkReplayPlaybackSnapshot replaySnapshot;
  final VoidCallback? onToggleReplay;
  final VoidCallback? onRetryReplay;
  final ValueChanged<double>? onSeekReplay;
  final int hostRequestCount;
  final int hostQuestionCount;
  final VoidCallback? onHostQuestions;
  final VoidCallback? onHostRequests;
  final VoidCallback? onHostManage;
  final VoidCallback? onEndTalk;
  final VoidCallback? onReact;
  final String? reaction;
  final VoidCallback? onAddAi;
  final VoidCallback? onGift;
  final VoidCallback? onAskQuestion;
  final TalkHandStatus handStatus;
  final bool handBusy;
  final VoidCallback? onRaiseHand;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Container(
      color: u.surfaceCard,
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (talk.isLive)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: u.emergency.withValues(alpha: .12),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    'LIVE',
                    style: TextStyle(
                      color: u.emergency,
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              if (talk.isLive) const SizedBox(width: 8),
              Icon(Icons.headphones_rounded, color: u.textMuted, size: 16),
              const SizedBox(width: 4),
              Text(
                talk.listenerCount.toString() + ' listening',
                style: TextStyle(color: u.textMuted, fontSize: 12.5),
              ),
              if (talk.isLive) ...[
                const Spacer(),
                _LiveAudioStatusChip(
                  status: liveAudioStatus,
                  role: liveAudioRole,
                  muted: liveAudioMuted,
                  error: liveAudioError,
                  onRetry: onRetryLiveAudio,
                ),
                if ((liveAudioRole == TalkLiveRole.host ||
                        liveAudioRole == TalkLiveRole.speaker) &&
                    liveAudioStatus != TalkLiveAudioStatus.connecting &&
                    liveAudioStatus != TalkLiveAudioStatus.ended &&
                    liveAudioStatus != TalkLiveAudioStatus.failed) ...[
                  const SizedBox(width: 4),
                  IconButton(
                    key: const ValueKey('talk-live-mic-toggle'),
                    tooltip: liveAudioMuted
                        ? 'Unmute microphone'
                        : 'Mute microphone',
                    visualDensity: VisualDensity.compact,
                    onPressed: onToggleLiveMute,
                    icon: Icon(
                      liveAudioMuted
                          ? Icons.mic_off_rounded
                          : Icons.mic_rounded,
                      color: liveAudioMuted ? u.textMuted : u.brandStrong,
                      size: 20,
                    ),
                  ),
                ],
              ],
            ],
          ),
          const SizedBox(height: 10),
          Text(
            talk.title,
            style: TextStyle(
              color: u.textPrimary,
              fontSize: 23,
              height: 1.08,
              fontWeight: FontWeight.w800,
            ),
          ),
          if (talk.summary.trim().isNotEmpty) ...[
            const SizedBox(height: 7),
            Text(
              talk.summary,
              style: TextStyle(color: u.textMuted, fontSize: 14, height: 1.35),
            ),
          ],
          if (!talk.isLive) ...[
            const SizedBox(height: 14),
            _ReplayPlaybackBar(
              snapshot: replaySnapshot,
              onToggle: onToggleReplay,
              onRetry: onRetryReplay,
              onSeek: onSeekReplay,
            ),
          ],
          const SizedBox(height: 16),
          if (talk.participants.isEmpty)
            _SimpleHost(hostName: talk.hostName)
          else
            Wrap(
              spacing: 12,
              runSpacing: 12,
              children: [
                for (final participant in talk.participants)
                  _Seat(participant: participant),
              ],
            ),
          const SizedBox(height: 16),
          if (isHost)
            Row(
              children: [
                Expanded(
                  child: _ActionButton(
                    icon: Icons.inbox_outlined,
                    label: hostRequestCount > 0
                        ? 'Requests ' + hostRequestCount.toString()
                        : 'Requests',
                    onTap: onHostRequests,
                  ),
                ),
                Expanded(
                  child: _ActionButton(
                    icon: Icons.question_answer_outlined,
                    label: hostQuestionCount > 0
                        ? 'Questions ' + hostQuestionCount.toString()
                        : 'Questions',
                    onTap: onHostQuestions,
                  ),
                ),
                Expanded(
                  child: _ActionButton(
                    icon: Icons.person_add_alt_1_rounded,
                    label: 'Add AI',
                    onTap: onAddAi,
                  ),
                ),
                Expanded(
                  child: _ActionButton(
                    icon: Icons.manage_accounts_outlined,
                    label: 'Manage',
                    onTap: onHostManage,
                  ),
                ),
                Expanded(
                  child: _ActionButton(
                    icon: Icons.stop_circle_outlined,
                    label: 'End',
                    onTap: onEndTalk,
                  ),
                ),
              ],
            )
          else
            Row(
              children: [
                Expanded(
                  child: _ActionButton(
                    icon: reaction == null
                        ? Icons.favorite_border_rounded
                        : Icons.favorite_rounded,
                    label: reaction ?? 'React',
                    onTap: onReact,
                  ),
                ),
                Expanded(
                  child: _ActionButton(
                    icon: handStatus == TalkHandStatus.raised
                        ? Icons.back_hand_rounded
                        : handStatus == TalkHandStatus.accepted
                        ? Icons.mic_rounded
                        : Icons.back_hand_outlined,
                    label: handBusy
                        ? 'Updating…'
                        : handStatus == TalkHandStatus.raised
                        ? 'Hand raised'
                        : handStatus == TalkHandStatus.accepted
                        ? 'Leave seat'
                        : 'Raise hand',
                    onTap: onRaiseHand,
                  ),
                ),
                Expanded(
                  child: _ActionButton(
                    icon: Icons.question_answer_outlined,
                    label: 'Ask',
                    onTap: onAskQuestion,
                  ),
                ),
                Expanded(
                  child: _ActionButton(
                    icon: Icons.person_add_alt_1_rounded,
                    label: 'Add AI',
                    onTap: onAddAi,
                  ),
                ),
                Expanded(
                  child: _ActionButton(
                    icon: Icons.card_giftcard_rounded,
                    label: 'Gift',
                    onTap: onGift,
                  ),
                ),
              ],
            ),
        ],
      ),
    );
  }
}

class _ReplayPlaybackBar extends StatelessWidget {
  const _ReplayPlaybackBar({
    required this.snapshot,
    this.onToggle,
    this.onRetry,
    this.onSeek,
  });

  final TalkReplayPlaybackSnapshot snapshot;
  final VoidCallback? onToggle;
  final VoidCallback? onRetry;
  final ValueChanged<double>? onSeek;

  String _time(Duration value) {
    final totalSeconds = value.inSeconds < 0 ? 0 : value.inSeconds;
    final minutes = totalSeconds ~/ 60;
    final seconds = totalSeconds % 60;
    return '$minutes:${seconds.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final loading = snapshot.status == TalkReplayPlaybackStatus.loading;
    final failed = snapshot.status == TalkReplayPlaybackStatus.failed;
    final playing = snapshot.status == TalkReplayPlaybackStatus.playing;
    final durationKnown = snapshot.duration > Duration.zero;

    return Container(
      key: const ValueKey('talk-replay-player'),
      padding: const EdgeInsets.fromLTRB(10, 8, 12, 8),
      decoration: BoxDecoration(
        color: u.surfaceBg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: u.structuralBorder),
      ),
      child: failed
          ? Row(
              children: [
                Icon(Icons.error_outline_rounded, color: u.textMuted, size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    snapshot.errorMessage ?? 'Replay audio is unavailable.',
                    style: TextStyle(color: u.textMuted, fontSize: 12.5),
                  ),
                ),
                TextButton(
                  key: const ValueKey('talk-replay-retry'),
                  onPressed: onRetry,
                  child: const Text('Retry'),
                ),
              ],
            )
          : Row(
              children: [
                IconButton(
                  key: const ValueKey('talk-replay-toggle'),
                  tooltip: playing ? 'Pause replay' : 'Play replay',
                  onPressed: loading ? null : onToggle,
                  icon: loading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Icon(
                          playing
                              ? Icons.pause_rounded
                              : Icons.play_arrow_rounded,
                          color: u.brandStrong,
                        ),
                ),
                Expanded(
                  child: Slider(
                    key: const ValueKey('talk-replay-seek'),
                    value: durationKnown ? snapshot.progress : 0,
                    onChanged: durationKnown && onSeek != null ? onSeek : null,
                  ),
                ),
                const SizedBox(width: 4),
                Text(
                  '${_time(snapshot.position)} / ${_time(snapshot.duration)}',
                  style: TextStyle(
                    color: u.textMuted,
                    fontSize: 11.5,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
              ],
            ),
    );
  }
}

class _LiveAudioStatusChip extends StatelessWidget {
  const _LiveAudioStatusChip({
    required this.status,
    required this.role,
    required this.muted,
    required this.error,
    this.onRetry,
  });

  final TalkLiveAudioStatus status;
  final TalkLiveRole? role;
  final bool muted;
  final String? error;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final failed = status == TalkLiveAudioStatus.failed;
    final reconnecting = status == TalkLiveAudioStatus.reconnecting;
    final label = switch (status) {
      TalkLiveAudioStatus.idle => 'Audio',
      TalkLiveAudioStatus.connecting => 'Connecting…',
      TalkLiveAudioStatus.listening => 'Listening',
      TalkLiveAudioStatus.publishing => muted ? 'Muted' : 'On mic',
      TalkLiveAudioStatus.reconnecting => 'Reconnecting…',
      TalkLiveAudioStatus.ended => 'Ended',
      TalkLiveAudioStatus.failed => 'Audio unavailable',
    };

    return Tooltip(
      message: failed
          ? (error?.trim().isNotEmpty == true
                ? error!
                : 'Live audio is unavailable right now.')
          : label,
      child: InkWell(
        key: const ValueKey('talk-live-audio-status'),
        onTap: failed ? onRetry : null,
        borderRadius: BorderRadius.circular(999),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
          decoration: BoxDecoration(
            color: failed
                ? u.emergency.withValues(alpha: .10)
                : reconnecting
                ? u.surfaceMuted
                : u.brand.withValues(alpha: .10),
            borderRadius: BorderRadius.circular(999),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (status == TalkLiveAudioStatus.connecting)
                const SizedBox(
                  width: 11,
                  height: 11,
                  child: CircularProgressIndicator(strokeWidth: 1.5),
                )
              else
                Icon(
                  failed
                      ? Icons.wifi_off_rounded
                      : reconnecting
                      ? Icons.sync_rounded
                      : role == TalkLiveRole.host
                      ? Icons.graphic_eq_rounded
                      : Icons.headphones_rounded,
                  size: 13,
                  color: failed ? u.emergency : u.brandStrong,
                ),
              const SizedBox(width: 4),
              Text(
                label,
                style: TextStyle(
                  color: failed ? u.emergency : u.textPrimary,
                  fontSize: 10.5,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SimpleHost extends StatelessWidget {
  const _SimpleHost({required this.hostName});
  final String hostName;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Row(
      children: [
        CircleAvatar(
          radius: 24,
          backgroundColor: u.brandStrong,
          child: const Icon(Icons.person_rounded, color: Colors.white),
        ),
        const SizedBox(width: 10),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              hostName.isEmpty ? 'Host' : hostName,
              style: TextStyle(
                color: u.textPrimary,
                fontWeight: FontWeight.w700,
              ),
            ),
            Text('Host', style: TextStyle(color: u.brandStrong, fontSize: 12)),
          ],
        ),
      ],
    );
  }
}

class _Seat extends StatelessWidget {
  const _Seat({required this.participant});
  final TalkParticipantPreview participant;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final image = participant.avatarUrl?.trim();
    final label = participant.isHost
        ? 'Host'
        : switch (participant.kind) {
            TalkParticipantKind.human => 'Speaker',
            TalkParticipantKind.expert => 'Expert',
            TalkParticipantKind.twin => 'Twin',
          };

    return SizedBox(
      width: 78,
      child: Column(
        children: [
          CircleAvatar(
            radius: 28,
            backgroundColor: participant.kind == TalkParticipantKind.human
                ? u.brandStrong
                : u.surfaceMuted,
            backgroundImage: image != null && image.isNotEmpty
                ? NetworkImage(image)
                : null,
            child: image == null || image.isEmpty
                ? Icon(
                    participant.kind == TalkParticipantKind.human
                        ? Icons.person_rounded
                        : participant.kind == TalkParticipantKind.expert
                        ? Icons.verified_rounded
                        : Icons.auto_awesome_rounded,
                    color: participant.kind == TalkParticipantKind.human
                        ? Colors.white
                        : u.brandStrong,
                  )
                : null,
          ),
          const SizedBox(height: 5),
          Text(
            participant.name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: u.textPrimary,
              fontSize: 11.5,
              fontWeight: FontWeight.w600,
            ),
          ),
          Text(
            label,
            style: TextStyle(
              color: participant.isHost ? u.brandStrong : u.textMuted,
              fontSize: 10.5,
            ),
          ),
        ],
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({required this.icon, required this.label, this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 2),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: u.brandStrong, size: 22),
            const SizedBox(height: 3),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: u.textMuted, fontSize: 10.5),
            ),
          ],
        ),
      ),
    );
  }
}

class _CommentTile extends StatelessWidget {
  const _CommentTile({required this.comment});
  final TalkComment comment;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final image = comment.authorAvatarUrl?.trim();
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 11, 12, 11),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: u.surfaceMuted,
            backgroundImage: image != null && image.isNotEmpty
                ? NetworkImage(image)
                : null,
            child: image == null || image.isEmpty
                ? Icon(Icons.person_rounded, color: u.textMuted, size: 18)
                : null,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  comment.authorName,
                  style: TextStyle(
                    color: u.textPrimary,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  comment.body,
                  style: TextStyle(
                    color: u.textPrimary,
                    fontSize: 13.5,
                    height: 1.3,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            children: [
              Icon(Icons.favorite_border_rounded, color: u.textMuted, size: 18),
              if (comment.likeCount > 0)
                Text(
                  comment.likeCount.toString(),
                  style: TextStyle(color: u.textMuted, fontSize: 10),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _CommentComposer extends StatelessWidget {
  const _CommentComposer({
    required this.controller,
    required this.posting,
    required this.onSend,
  });

  final TextEditingController controller;
  final bool posting;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return SafeArea(
      top: false,
      child: Container(
        decoration: BoxDecoration(
          color: u.surfaceCard,
          border: Border(top: BorderSide(color: u.structuralBorder)),
        ),
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 9),
        child: Row(
          children: [
            CircleAvatar(
              radius: 17,
              backgroundColor: u.surfaceMuted,
              child: Icon(Icons.person_rounded, size: 17, color: u.textMuted),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: TextField(
                controller: controller,
                minLines: 1,
                maxLines: 3,
                textInputAction: TextInputAction.newline,
                decoration: const InputDecoration(
                  hintText: 'Share your thoughts…',
                  isDense: true,
                ),
              ),
            ),
            const SizedBox(width: 8),
            IconButton.filled(
              tooltip: 'Post comment',
              onPressed: posting ? null : onSend,
              icon: posting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.arrow_upward_rounded),
            ),
          ],
        ),
      ),
    );
  }
}

class _TalkUnavailable extends StatelessWidget {
  const _TalkUnavailable({required this.onRetry});
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.podcasts_rounded, color: u.textMuted, size: 44),
            const SizedBox(height: 12),
            Text(
              'This Talk is unavailable right now.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: u.textPrimary,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 14),
            FilledButton(onPressed: onRetry, child: const Text('Try again')),
          ],
        ),
      ),
    );
  }
}
