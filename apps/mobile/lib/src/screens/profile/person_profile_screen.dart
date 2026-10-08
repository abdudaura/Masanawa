import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../social/talk_social_profiles.dart';
import '../../state/talk_social_profile_state.dart';
import '../../theme/masanawa_theme.dart';
import '../talks/talk_home_screen.dart';
import 'human_profile_safety_sheet.dart';
import 'human_profile_report_sheet.dart';
import '../../state/session_state.dart';

class PersonProfileScreen extends ConsumerStatefulWidget {
  const PersonProfileScreen({
    super.key,
    required this.handle,
    this.onOpenTalk,
    this.onOpenTwin,
    this.onOpenMessage,
  });

  final String handle;
  final void Function(String talkId)? onOpenTalk;
  final void Function(String publicId)? onOpenTwin;
  final void Function(String handle)? onOpenMessage;

  @override
  ConsumerState<PersonProfileScreen> createState() => _PersonProfileScreenState();
}

class _PersonProfileScreenState extends ConsumerState<PersonProfileScreen> {
  HumanProfile? _local;
  bool _followBusy = false;

  Future<void> _refresh() async {
    setState(() => _local = null);
    ref.invalidate(humanProfileProvider(widget.handle));
    await ref.read(humanProfileProvider(widget.handle).future);
  }

  Future<void> _toggleFollow(HumanProfile profile) async {
    if (_followBusy) return;
    setState(() => _followBusy = true);
    try {
      final updated =
          await ref.read(talkSocialProfileTransportProvider).setFollowing(
                handle: profile.handle,
                following: !profile.isFollowing,
              );
      if (!mounted) return;
      setState(() => _local = updated);
      ref.invalidate(humanProfileProvider(widget.handle));
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Couldn’t update Follow right now.')),
      );
    } finally {
      if (mounted) setState(() => _followBusy = false);
    }
  }

  Future<void> _openSafety(HumanProfile profile) async {
    final session = ref.read(sessionProvider);
    if (session is! SessionSignedIn || !session.user.isActive) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Sign in to manage profile safety.')));
      return;
    }
    await showModalBottomSheet<void>(context: context, isScrollControlled: true,
      showDragHandle: true, builder: (_) => HumanProfileReportSheet(
        handle: profile.handle, reporterUserId: session.user.id));
  }

  @override
  Widget build(BuildContext context) {
    final asyncProfile = ref.watch(humanProfileProvider(widget.handle));
    return asyncProfile.when(
      loading: () => const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      ),
      error: (_, __) => _Unavailable(
        label: 'Couldn’t load this profile.',
        onRetry: () => ref.invalidate(humanProfileProvider(widget.handle)),
      ),
      data: (remote) {
        final profile = _local ?? remote;
        if (profile == null) {
          return const _Unavailable(label: 'This profile is unavailable.');
        }
        return _PersonProfileBody(
          profile: profile,
          followBusy: _followBusy,
          onFollow: () => _toggleFollow(profile),
          onRefresh: _refresh,
          onSafety: () => _openSafety(profile),
          onOpenTalk: widget.onOpenTalk,
          onOpenTwin: widget.onOpenTwin,
          onOpenMessage: widget.onOpenMessage,
        );
      },
    );
  }
}

class _PersonProfileBody extends StatelessWidget {
  const _PersonProfileBody({
    required this.profile,
    required this.followBusy,
    required this.onFollow,
    required this.onRefresh,
    required this.onSafety,
    this.onOpenTalk,
    this.onOpenTwin,
    this.onOpenMessage,
  });

  final HumanProfile profile;
  final bool followBusy;
  final VoidCallback onFollow;
  final Future<void> Function() onRefresh;
  final VoidCallback onSafety;
  final void Function(String talkId)? onOpenTalk;
  final void Function(String publicId)? onOpenTwin;
  final void Function(String handle)? onOpenMessage;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final avatar = profile.avatarUrl?.trim();
    final twinId = profile.twinPublicId?.trim();

    return Scaffold(
      backgroundColor: u.surfaceCard,
      appBar: AppBar(title: Text('@' + profile.handle), actions: [
        IconButton(key: const ValueKey('human-profile-safety-open'),
          tooltip: 'Block or mute person', icon: const Icon(Icons.shield_outlined),
          onPressed: () => showModalBottomSheet<void>(context: context,
            useSafeArea: true, isScrollControlled: true,
            builder: (_) => HumanProfileSafetySheet(handle: profile.handle,
              displayName: profile.displayName))),
        IconButton(key: const ValueKey('human-profile-report-open'),
          tooltip: 'Report profile', icon: const Icon(Icons.flag_outlined), onPressed: onSafety),
      ]),
      body: RefreshIndicator(
        onRefresh: onRefresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(12, 16, 12, 28),
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CircleAvatar(
                  radius: 38,
                  backgroundColor: u.brandStrong,
                  backgroundImage:
                      avatar != null && avatar.isNotEmpty ? NetworkImage(avatar) : null,
                  child: avatar == null || avatar.isEmpty
                      ? const Icon(Icons.person_rounded,
                          color: Colors.white, size: 36)
                      : null,
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              profile.displayName,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: u.textPrimary,
                                fontSize: 21,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                          if (profile.isLive) ...[
                            const SizedBox(width: 7),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 7, vertical: 3),
                              decoration: BoxDecoration(
                                color: u.emergency.withValues(alpha: .12),
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Text(
                                'LIVE',
                                style: TextStyle(
                                  color: u.emergency,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '@' + profile.handle,
                        style: TextStyle(color: u.textMuted, fontSize: 13),
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          _Stat(
                            value: _compact(profile.followerCount),
                            label: 'followers',
                          ),
                          const SizedBox(width: 18),
                          _Stat(
                            value: _compact(profile.followingCount),
                            label: 'following',
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (profile.bio.trim().isNotEmpty) ...[
              const SizedBox(height: 13),
              Text(
                profile.bio,
                style: TextStyle(
                  color: u.textPrimary,
                  fontSize: 14,
                  height: 1.35,
                ),
              ),
            ],
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: FilledButton(
                    key: const ValueKey('person-profile-follow'),
                    onPressed: followBusy ? null : onFollow,
                    child: Text(
                      followBusy
                          ? 'Updating…'
                          : profile.isFollowing
                              ? 'Following'
                              : 'Follow',
                    ),
                  ),
                ),
                if (profile.isLive &&
                    profile.liveTalkId?.isNotEmpty == true &&
                    onOpenTalk != null) ...[
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => onOpenTalk!(profile.liveTalkId!),
                      icon: const Icon(Icons.headphones_rounded),
                      label: const Text('Listen live'),
                    ),
                  ),
                ],
              ],
            ),
            if (onOpenMessage != null) ...[
              const SizedBox(height: 10),
              OutlinedButton.icon(
                key: const ValueKey('person-profile-message'),
                onPressed: () => onOpenMessage!(profile.handle),
                icon: const Icon(Icons.chat_bubble_outline),
                label: const Text('Message privately'),
              ),
            ],
            if (twinId != null && twinId.isNotEmpty) ...[
              const SizedBox(height: 14),
              Material(
                color: u.surfaceCard,
                borderRadius: BorderRadius.circular(14),
                child: ListTile(
                  onTap: onOpenTwin == null ? null : () => onOpenTwin!(twinId),
                  leading: CircleAvatar(
                    backgroundColor: u.surfaceMuted,
                    child: Icon(Icons.auto_awesome_rounded, color: u.brandStrong),
                  ),
                  title: Text(
                    profile.twinDisplayName?.trim().isNotEmpty == true
                        ? profile.twinDisplayName!
                        : 'Their Twin',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  subtitle: const Text('AI persona'),
                  trailing: onOpenTwin == null
                      ? null
                      : Icon(Icons.chevron_right_rounded, color: u.textMuted),
                ),
              ),
            ],
            const SizedBox(height: 20),
            Text(
              'Talks',
              style: TextStyle(
                color: u.textPrimary,
                fontSize: 17,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 9),
            if (profile.talks.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 26),
                child: Text(
                  'No public Talks yet.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: u.textMuted),
                ),
              )
            else
              for (var i = 0; i < profile.talks.length; i++) ...[
                TalkFeedCard(
                  talk: profile.talks[i],
                  onTap: onOpenTalk == null
                      ? null
                      : () => onOpenTalk!(profile.talks[i].id),
                ),
                if (i != profile.talks.length - 1) const SizedBox(height: 10),
              ],
          ],
        ),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.value, required this.label});
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Row(
      children: [
        Text(
          value,
          style: TextStyle(
            color: u.textPrimary,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(width: 4),
        Text(label, style: TextStyle(color: u.textMuted, fontSize: 12)),
      ],
    );
  }
}

class _Unavailable extends StatelessWidget {
  const _Unavailable({required this.label, this.onRetry});
  final String label;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.person_off_outlined, size: 42),
              const SizedBox(height: 12),
              Text(label, textAlign: TextAlign.center),
              if (onRetry != null) ...[
                const SizedBox(height: 12),
                FilledButton(onPressed: onRetry, child: const Text('Try again')),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

String _compact(int value) {
  if (value >= 1000000) {
    final n = value / 1000000;
    return n.toStringAsFixed(n >= 10 ? 0 : 1) + 'M';
  }
  if (value >= 1000) {
    final n = value / 1000;
    return n.toStringAsFixed(n >= 10 ? 0 : 1) + 'K';
  }
  return value.toString();
}

