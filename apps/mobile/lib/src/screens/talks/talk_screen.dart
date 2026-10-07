import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/talk_gift_state.dart';
import '../../state/talk_host_controls_state.dart';
import '../../state/talk_library_state.dart';
import '../../state/talk_live_state.dart';
import '../../state/talk_participation_state.dart';
import '../../state/talk_state.dart';
import '../../state/wallet_state.dart';
import '../../talks/talk_ai_seat.dart';
import '../../talks/talk_gift.dart';
import '../../talks/talk_host_controls.dart';
import '../../talks/talk_live.dart';
import '../../talks/talk_live_audio_session.dart';
import '../../talks/talk_participation.dart';
import '../../talks/talk_models.dart';
import '../../theme/masanawa_theme.dart';
import 'add_ai_seat_sheet.dart';
import 'talk_gift_sheet.dart';
import 'talk_host_controls_sheets.dart';
import 'talk_participation_sheets.dart';

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
  TalkLiveAudioController? _liveAudio;
  StreamSubscription<TalkLiveAudioStatus>? _liveAudioSub;
  TalkLiveAudioStatus _liveAudioStatus = TalkLiveAudioStatus.idle;
  TalkLiveRole? _liveAudioRole;
  bool _liveAudioMuted = false;
  String? _liveAudioError;
  bool _liveAudioStartScheduled = false;

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
    unawaited(_liveAudioSub?.cancel());
    final liveAudio = _liveAudio;
    _liveAudio = null;
    if (liveAudio != null) unawaited(liveAudio.close());
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
    final controller =
        ref.read(talkLiveAudioFactoryProvider)(widget.talkId);
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
    if (controller == null || controller.role != TalkLiveRole.host) return;
    await controller.setMuted(!controller.muted);
    if (!mounted || !identical(_liveAudio, controller)) return;
    setState(() {
      _liveAudioStatus = controller.status;
      _liveAudioMuted = controller.muted;
      _liveAudioError = controller.errorMessage;
    });
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
        request.message.isNotEmpty
            ? request.message
            : 'AI added to the Talk.',
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
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  Future<void> _react() async {
    if (_reacting) return;
    final reaction = await showTalkReactionPicker(context);
    if (!mounted || reaction == null) return;
    setState(() => _reacting = true);
    try {
      await ref.read(talkParticipationTransportProvider).react(
            talkId: widget.talkId,
            reaction: reaction,
          );
      ref.invalidate(talkParticipationProvider(widget.talkId));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(reaction + ' sent')),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Couldn’t send your reaction.')),
      );
    } finally {
      if (mounted) setState(() => _reacting = false);
    }
  }

  Future<void> _raiseHand(TalkHandStatus status) async {
    final callback = widget.onRaiseHand;
    if (callback != null) {
      callback();
      return;
    }
    if (_handBusy || widget.isHost) return;
    final raised = await showRaiseHandSheet(context, status: status);
    if (!mounted || raised == null) return;
    setState(() => _handBusy = true);
    try {
      final next =
          await ref.read(talkParticipationTransportProvider).setHandRaised(
                talkId: widget.talkId,
                raised: raised,
              );
      ref.invalidate(talkParticipationProvider(widget.talkId));
      if (!mounted) return;
      final message = switch (next.handStatus) {
        TalkHandStatus.raised => 'Hand raised. Waiting for the Host.',
        TalkHandStatus.accepted => 'The Host accepted you as a Speaker.',
        TalkHandStatus.declined => 'The Host declined the request.',
        TalkHandStatus.idle => 'Hand lowered.',
      };
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message)),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Couldn’t update your hand right now.')),
      );
    } finally {
      if (mounted) setState(() => _handBusy = false);
    }
  }

  Future<void> _openHostRequests() async {
    await showTalkHostRequestsSheet(
      context,
      talkId: widget.talkId,
    );
    if (!mounted) return;
    ref.invalidate(talkHostControlsProvider(widget.talkId));
    ref.invalidate(talkDetailProvider(widget.talkId));
  }

  Future<void> _openHostManage() async {
    await showTalkHostManageSheet(
      context,
      talkId: widget.talkId,
    );
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
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Talk ended.')),
        );
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

  Future<void> _openGift(String hostName) async {
    final callback = widget.onGift;
    if (callback != null) {
      callback();
      return;
    }

    TalkGiftReceipt? receipt;
    final sent = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (context) => TalkGiftSheet(
        hostName: hostName,
        onGift: (amountCredits) async {
          try {
            receipt = await ref.read(talkGiftTransportProvider).sendGift(
                  talkId: widget.talkId,
                  amountCredits: amountCredits,
                );
            ref.invalidate(walletProvider);
            return true;
          } catch (_) {
            return false;
          }
        },
      ),
    );

    if (!mounted || sent != true || receipt == null) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          receipt!.amountCredits.toString() +
              ' Cr sent to ' +
              receipt!.recipientName +
              '.',
        ),
      ),
    );
  }

  Future<void> _toggleSaved(bool isSaved) async {
    if (_savingTalk) return;
    setState(() => _savingTalk = true);
    try {
      final next = await ref.read(talkLibraryTransportProvider).setSaved(
            talkId: widget.talkId,
            saved: !isSaved,
          );
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
      await ref.read(talkTransportProvider).addComment(
            talkId: widget.talkId,
            body: body,
          );
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
    final isSaved = ref.watch(talkSavedStateProvider(widget.talkId)).maybeWhen(
          data: (value) => value.saved,
          orElse: () => false,
        );
    final participation =
        ref.watch(talkParticipationProvider(widget.talkId)).maybeWhen(
              data: (value) => value,
              orElse: () => const TalkParticipationState(),
            );
    final hostControls = widget.isHost
        ? ref.watch(talkHostControlsProvider(widget.talkId)).maybeWhen(
              data: (value) => value,
              orElse: () => const TalkHostControlsView(),
            )
        : const TalkHostControlsView();
    final fallback = widget.initialTalk;
    final projectedTalk = detail.maybeWhen(
      data: (value) => value.talk,
      orElse: () => fallback,
    );
    if (projectedTalk?.isLive == true) {
      _scheduleLiveAudioStart();
    }

    return detail.when(
      data: (value) => _TalkBody(
        talk: value.talk,
        comments: value.comments,
        controller: _commentController,
        postingComment: _postingComment,
        onPostComment: _postComment,
        isSaved: isSaved,
        savingTalk: _savingTalk,
        onToggleSaved: () => _toggleSaved(isSaved),
        isHost: widget.isHost,
        liveAudioStatus: _liveAudioStatus,
        liveAudioRole: _liveAudioRole,
        liveAudioMuted: _liveAudioMuted,
        liveAudioError: _liveAudioError,
        onRetryLiveAudio: _retryLiveAudio,
        onToggleLiveMute: _toggleLiveMute,
        hostRequestCount: hostControls.requests.length,
        onHostRequests: _openHostRequests,
        onHostManage: _openHostManage,
        onEndTalk: _endingTalk ? null : _endTalk,
        onReact: _react,
        reaction: participation.reaction,
        onAddAi: _openAiSeatSheet,
        onGift: widget.isHost ? null : () => _openGift(value.talk.hostName),
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
            isHost: widget.isHost,
            liveAudioStatus: _liveAudioStatus,
            liveAudioRole: _liveAudioRole,
            liveAudioMuted: _liveAudioMuted,
            liveAudioError: _liveAudioError,
            onRetryLiveAudio: _retryLiveAudio,
            onToggleLiveMute: _toggleLiveMute,
            hostRequestCount: hostControls.requests.length,
            onHostRequests: _openHostRequests,
            onHostManage: _openHostManage,
            onEndTalk: _endingTalk ? null : _endTalk,
            onReact: _react,
            reaction: participation.reaction,
            onAddAi: _openAiSeatSheet,
            onGift: widget.isHost ? null : () => _openGift(fallback.hostName),
            handStatus: participation.handStatus,
            handBusy: _handBusy,
            onRaiseHand: widget.isHost
                ? null
                : () => _raiseHand(participation.handStatus),
          );
        }
        return const Scaffold(
          body: Center(child: CircularProgressIndicator()),
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
            isHost: widget.isHost,
            liveAudioStatus: _liveAudioStatus,
            liveAudioRole: _liveAudioRole,
            liveAudioMuted: _liveAudioMuted,
            liveAudioError: _liveAudioError,
            onRetryLiveAudio: _retryLiveAudio,
            onToggleLiveMute: _toggleLiveMute,
            hostRequestCount: hostControls.requests.length,
            onHostRequests: _openHostRequests,
            onHostManage: _openHostManage,
            onEndTalk: _endingTalk ? null : _endTalk,
            onReact: _react,
            reaction: participation.reaction,
            onAddAi: _openAiSeatSheet,
            onGift: widget.isHost ? null : () => _openGift(fallback.hostName),
            handStatus: participation.handStatus,
            handBusy: _handBusy,
            onRaiseHand: widget.isHost
                ? null
                : () => _raiseHand(participation.handStatus),
          );
        }
        return Scaffold(
          appBar: AppBar(),
          body: _TalkUnavailable(
            onRetry: () => ref.invalidate(talkDetailProvider(widget.talkId)),
          ),
        );
      },
    );
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
    this.isHost = false,
    this.liveAudioStatus = TalkLiveAudioStatus.idle,
    this.liveAudioRole,
    this.liveAudioMuted = false,
    this.liveAudioError,
    this.onRetryLiveAudio,
    this.onToggleLiveMute,
    this.hostRequestCount = 0,
    this.onHostRequests,
    this.onHostManage,
    this.onEndTalk,
    this.onReact,
    this.reaction,
    this.onAddAi,
    this.onGift,
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
  final bool isHost;
  final TalkLiveAudioStatus liveAudioStatus;
  final TalkLiveRole? liveAudioRole;
  final bool liveAudioMuted;
  final String? liveAudioError;
  final VoidCallback? onRetryLiveAudio;
  final VoidCallback? onToggleLiveMute;
  final int hostRequestCount;
  final VoidCallback? onHostRequests;
  final VoidCallback? onHostManage;
  final VoidCallback? onEndTalk;
  final VoidCallback? onReact;
  final String? reaction;
  final VoidCallback? onAddAi;
  final VoidCallback? onGift;
  final TalkHandStatus handStatus;
  final bool handBusy;
  final VoidCallback? onRaiseHand;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Scaffold(
      backgroundColor: u.surfaceBg,
      appBar: AppBar(
        title: Text(
          talk.isLive ? 'Live Talk' : 'Talk Replay',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        actions: [
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
                    onToggleLiveMute:
                        talk.isLive ? onToggleLiveMute : null,
                    hostRequestCount: talk.isLive ? hostRequestCount : 0,
                    onHostRequests: onHostRequests,
                    onHostManage: onHostManage,
                    onEndTalk: onEndTalk,
                    onReact: onReact,
                    reaction: reaction,
                    onAddAi: onAddAi,
                    onGift: onGift,
                    handStatus: handStatus,
                    handBusy: handBusy,
                    onRaiseHand: onRaiseHand,
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
                          style: TextStyle(
                            color: u.textMuted,
                            fontSize: 14,
                          ),
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
                    delegate: SliverChildBuilderDelegate(
                      (context, index) {
                        if (index.isOdd) {
                          return Divider(
                            height: 1,
                            indent: 64,
                            color: u.structuralBorder,
                          );
                        }
                        return _CommentTile(comment: comments[index ~/ 2]);
                      },
                      childCount: comments.length * 2 - 1,
                    ),
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
    this.hostRequestCount = 0,
    this.onHostRequests,
    this.onHostManage,
    this.onEndTalk,
    this.onReact,
    this.reaction,
    this.onAddAi,
    this.onGift,
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
  final int hostRequestCount;
  final VoidCallback? onHostRequests;
  final VoidCallback? onHostManage;
  final VoidCallback? onEndTalk;
  final VoidCallback? onReact;
  final String? reaction;
  final VoidCallback? onAddAi;
  final VoidCallback? onGift;
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
              Icon(
                Icons.headphones_rounded,
                color: u.textMuted,
                size: 16,
              ),
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
                if (liveAudioRole == TalkLiveRole.host &&
                    liveAudioStatus != TalkLiveAudioStatus.connecting &&
                    liveAudioStatus != TalkLiveAudioStatus.ended &&
                    liveAudioStatus != TalkLiveAudioStatus.failed) ...[
                  const SizedBox(width: 4),
                  IconButton(
                    key: const ValueKey('talk-live-mic-toggle'),
                    tooltip: liveAudioMuted ? 'Unmute microphone' : 'Mute microphone',
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
              style: TextStyle(
                color: u.textMuted,
                fontSize: 14,
                height: 1.35,
              ),
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
                                ? 'Speaker'
                                : 'Raise hand',
                    onTap: onRaiseHand,
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
            Text(
              'Host',
              style: TextStyle(color: u.brandStrong, fontSize: 12),
            ),
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
            backgroundImage:
                image != null && image.isNotEmpty ? NetworkImage(image) : null,
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
  const _ActionButton({
    required this.icon,
    required this.label,
    this.onTap,
  });

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
            backgroundImage:
                image != null && image.isNotEmpty ? NetworkImage(image) : null,
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
          border: Border(
            top: BorderSide(color: u.structuralBorder),
          ),
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
            FilledButton(
              onPressed: onRetry,
              child: const Text('Try again'),
            ),
          ],
        ),
      ),
    );
  }
}
