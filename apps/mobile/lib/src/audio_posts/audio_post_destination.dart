import 'dart:async';

import 'package:flutter/material.dart';

import 'audio_post_composer_screen.dart';
import 'audio_post_capture_sheet.dart';
import 'audio_post_draft_store.dart';
import 'audio_post_detail_screen.dart';
import 'audio_post_feed_screen.dart';
import 'audio_post_playback.dart';
import 'audio_post_report_action.dart';
import 'audio_post_transport.dart';
import 'creator_profile_screen.dart';
import 'creator_profile_transport.dart';
import 'following_transport.dart';

/// Feature-local navigation for Published Talks; AF00 mounts exactly this
/// destination in the five-tab shell and supplies the already-authorized
/// Gateway transports. It never creates its own session, media store or routes.
class PublishedTalksDestination extends StatefulWidget {
  const PublishedTalksDestination({
    super.key,
    required this.accountId,
    required this.isCurrentAccount,
    required this.transport,
    this.creatorTransport,
    this.followingTransport,
    this.reportTransport,
    this.playback,
    this.acquireVerifiedAudio,
    this.uploadVerifiedAudio,
    this.attemptStore,
  });

  final String accountId;
  final bool Function(String) isCurrentAccount;
  final AudioPostTransport transport;
  /// Only injected after the authenticated creator route is mounted by AF00.
  final CreatorProfileTransport? creatorTransport;
  final CreatorFollowingTransport? followingTransport;
  /// Only injected after the canonical TalkSafety report route is mounted.
  final PublishedAudioReportTransport? reportTransport;
  /// AF05/AF15 manage native audio focus and private media URL issuance.
  final AudioPostPlaybackController? playback;
  /// Must return an AF15 server-verified asset; no local-only recordings.
  final AcquireVerifiedPostAudio? acquireVerifiedAudio;
  /// AF05/AF15 private verified upload, never a client-created asset reference.
  final UploadVerifiedTalkAudio? uploadVerifiedAudio;
  final TalkPublishAttemptStore? attemptStore;

  @override
  State<PublishedTalksDestination> createState() =>
      _PublishedTalksDestinationState();
}

class _PublishedTalksDestinationState extends State<PublishedTalksDestination> {
  final ValueNotifier<int> _receiptRefresh = ValueNotifier<int>(0);
  // Child routes live on AF00's Navigator but belong to this account/session.
  // Close them when the root replaces the auth/transport binding.
  final Set<Route<void>> _featureRoutes = <Route<void>>{};

  void _pushFeatureRoute(Route<void> route) {
    _featureRoutes.add(route);
    final pending = Navigator.of(context).push<void>(route);
    unawaited(pending.then<void>(
      (_) { _featureRoutes.remove(route); },
      onError: (Object _, StackTrace __) { _featureRoutes.remove(route); },
    ));
  }

  @override
  void didUpdateWidget(covariant PublishedTalksDestination oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.accountId != widget.accountId ||
        oldWidget.transport != widget.transport ||
        oldWidget.isCurrentAccount != widget.isCurrentAccount ||
        !_authorized) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        final navigator = Navigator.of(context);
        for (final route in _featureRoutes.toList().reversed) {
          if (route.isActive) navigator.removeRoute(route);
        }
      });
    }
  }
  bool get _authorized => widget.accountId.trim().isNotEmpty &&
      widget.isCurrentAccount(widget.accountId);

  @override
  void dispose() {
    _receiptRefresh.dispose();
    super.dispose();
  }

  void _openCreatorPost(AudioPost post) {
    final playback = widget.playback;
    if (!_authorized || playback == null || !playback.isAuthorized ||
        post.status != 'published') return;
    _pushFeatureRoute(MaterialPageRoute<void>(
      builder: (_) => AudioPostDetailScreen(
        key: ValueKey('creator-talk-route-${post.postId}'),
        post: post,
        playback: playback,
        accountId: widget.accountId,
        isCurrentAccount: widget.isCurrentAccount,
      ),
    ));
  }

  void _openCreator(String authorId, String authorKind) {
    final transport = widget.creatorTransport;
    if (!_authorized || transport == null) return;
    final accountId = widget.accountId;
    _pushFeatureRoute(MaterialPageRoute<void>(
      builder: (_) => CreatorProfileScreen(
        key: ValueKey('creator-route-$accountId-$authorKind-$authorId'),
        transport: transport,
        following: widget.followingTransport,
        accountId: accountId,
        isCurrentAccount: widget.isCurrentAccount,
        authorId: authorId,
        authorKind: authorKind,
        onOpenPost: widget.playback == null ? null : _openCreatorPost,
      ),
    ));
  }

  void _openComposer() {
    if (!_authorized) return;
    final accountId = widget.accountId;
    final transport = widget.transport;
    _pushFeatureRoute(MaterialPageRoute<void>(
      builder: (_) => AudioPostComposerScreen(
        key: ValueKey('composer-route-$accountId'),
        transport: transport,
        accountId: accountId,
        isCurrentAccount: widget.isCurrentAccount,
        acquireVerifiedAudio: widget.acquireVerifiedAudio,
        uploadVerifiedAudio: widget.uploadVerifiedAudio,
        attemptStore: widget.attemptStore,
        onPublished: (_) {
          // Refresh server-authoritative feed while preserving feed tab/scroll
          // and the durable request receipt in the composer route.
          if (mounted && _authorized && widget.accountId == accountId &&
              identical(widget.transport, transport)) {
            _receiptRefresh.value++;
          }
        },
      ),
    ));
  }

  @override
  Widget build(BuildContext context) => AudioPostFeedScreen(
    transport: widget.transport,
    accountId: widget.accountId,
    isCurrentAccount: widget.isCurrentAccount,
    followingTransport: widget.followingTransport,
    reportTransport: widget.reportTransport,
    playback: widget.playback,
    onCreatePost: _openComposer,
    onOpenCreator: widget.creatorTransport == null ? null : _openCreator,
    refreshSignal: _receiptRefresh,
  );
}
