import 'dart:async';

import 'package:flutter/material.dart';

import 'audio_post_playback.dart';
import 'audio_post_transport.dart';

/// A creator's published Talk opens a deliberate, controllable listening view.
/// Reuses the very same AF09/AF15 private-media ticket player as the feed.
/// Nothing starts automatically and the signed object URL is never rendered.
class AudioPostDetailScreen extends StatefulWidget {
  const AudioPostDetailScreen({
    super.key,
    required this.post,
    required this.playback,
    required this.accountId,
    required this.isCurrentAccount,
  });

  final AudioPost post;
  final AudioPostPlaybackController playback;
  final String accountId;
  final bool Function(String) isCurrentAccount;

  @override
  State<AudioPostDetailScreen> createState() => _AudioPostDetailScreenState();
}

class _AudioPostDetailScreenState extends State<AudioPostDetailScreen> {
  bool get _authorized => widget.accountId.isNotEmpty &&
      widget.isCurrentAccount(widget.accountId) &&
      widget.playback.accountId == widget.accountId &&
      widget.playback.isAuthorized;

  Future<void> _stopOwnPlayback(AudioPostPlaybackController player,
      String postId) async {
    if (player.activePostId != postId) return;
    try {
      await player.stop();
    } catch (_) {
      // Navigation must not expose signed media URLs/native exceptions.
    }
  }

  @override
  void didUpdateWidget(covariant AudioPostDetailScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.accountId != widget.accountId ||
        oldWidget.playback != widget.playback ||
        oldWidget.post.postId != widget.post.postId || !_authorized) {
      unawaited(_stopOwnPlayback(oldWidget.playback, oldWidget.post.postId));
    }
  }

  @override
  void dispose() {
    unawaited(_stopOwnPlayback(widget.playback, widget.post.postId));
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Audio Talk')),
    body: !_authorized
        ? const Center(child: Text('Sign in to listen to this Talk.'))
        : widget.post.status != 'published'
            ? const Center(child: Text('This Talk is no longer available.'))
            : SafeArea(
                child: ListView(
                  padding: const EdgeInsets.all(20),
                  children: [
                    Text(widget.post.title,
                        style: Theme.of(context).textTheme.headlineSmall),
                    const SizedBox(height: 12),
                    Text(widget.post.authorId),
                    if (widget.post.authorKind == 'masana')
                      const Text('AI-created audio',
                          semanticsLabel: 'AI-created audio'),
                    const SizedBox(height: 12),
                    Text('${(widget.post.durationMs / 1000).round()} seconds'),
                    Text('${widget.post.likeCount} likes · '
                        '${widget.post.commentCount} comments'),
                    const SizedBox(height: 20),
                    AnimatedBuilder(
                      animation: widget.playback,
                      builder: (context, _) {
                        final active = widget.playback.activePostId ==
                            widget.post.postId;
                        final waiting = active && widget.playback.loading;
                        final playing = active && widget.playback.playing;
                        final canStart = _authorized &&
                            widget.post.status == 'published';
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            FilledButton.icon(
                              key: const ValueKey('creator-talk-listen'),
                              onPressed: canStart && !waiting
                                  ? () => widget.playback.play(widget.post)
                                  : null,
                              icon: waiting
                                  ? const SizedBox(
                                      width: 18, height: 18,
                                      child: CircularProgressIndicator(
                                          strokeWidth: 2))
                                  : Icon(playing
                                      ? Icons.stop : Icons.play_arrow),
                              label: Text(waiting ? 'Loading audio…'
                                  : playing ? 'Stop listening' : 'Listen'),
                            ),
                            if (active && widget.playback.error != null)
                              Text(widget.playback.error!,
                                  key: const ValueKey('creator-talk-error')),
                          ],
                        );
                      },
                    ),
                  ],
                ),
              ),
  );
}
