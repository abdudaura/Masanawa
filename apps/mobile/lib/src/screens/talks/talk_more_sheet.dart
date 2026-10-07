import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/talk_safety_state.dart';
import '../../state/talk_social_profile_state.dart';
import '../../state/talk_state.dart';
import '../../talks/talk_models.dart';
import '../../talks/talk_safety.dart';
import '../../theme/masanawa_theme.dart';

Future<void> showTalkMoreSheet(
  BuildContext context, {
  required TalkDiscoveryItem talk,
  required bool isHost,
}) {
  return showModalBottomSheet<void>(
    context: context,
    useSafeArea: true,
    isScrollControlled: true,
    builder: (_) => _TalkMoreSheet(talk: talk, isHost: isHost),
  );
}

class _TalkMoreSheet extends ConsumerStatefulWidget {
  const _TalkMoreSheet({
    required this.talk,
    required this.isHost,
  });

  final TalkDiscoveryItem talk;
  final bool isHost;

  @override
  ConsumerState<_TalkMoreSheet> createState() => _TalkMoreSheetState();
}

class _TalkMoreSheetState extends ConsumerState<_TalkMoreSheet> {
  bool _busy = false;

  String? get _hostUserId {
    for (final participant in widget.talk.participants) {
      if (participant.isHost && participant.kind == TalkParticipantKind.human) {
        final id = participant.id.trim();
        if (id.isNotEmpty) return id;
      }
    }
    return null;
  }

  Future<void> _toggleFollowing({
    required String hostUserId,
    required bool following,
  }) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await ref.read(talkSocialProfileTransportProvider).setFollowingUserId(
            userId: hostUserId,
            following: following,
          );
      ref.invalidate(humanProfileByUserIdProvider(hostUserId));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(following ? 'Following Host.' : 'Unfollowed Host.'),
        ),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Couldn’t update Follow right now.')),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _setPreference({
    required TalkSafetyPreference current,
    bool? blocked,
    bool? muted,
  }) async {
    final hostUserId = _hostUserId;
    if (hostUserId == null || _busy) return;
    setState(() => _busy = true);
    try {
      await ref.read(talkSafetyTransportProvider).setUserPreference(
            userId: hostUserId,
            blocked: blocked ?? current.blocked,
            muted: muted ?? current.muted,
          );
      ref.invalidate(talkSafetyPreferenceProvider(hostUserId));
      if (!mounted) return;
      final hiding = (blocked ?? current.blocked) || (muted ?? current.muted);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            hiding
                ? 'This Host’s Talks will be hidden from you.'
                : 'Host preference updated.',
          ),
        ),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Couldn’t update that preference.')),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _report() async {
    if (_busy) return;
    final reason = await showModalBottomSheet<TalkSafetyReportReason>(
      context: context,
      useSafeArea: true,
      builder: (context) => _ReportReasonSheet(talkTitle: widget.talk.title),
    );
    if (!mounted || reason == null) return;
    setState(() => _busy = true);
    try {
      await ref.read(talkSafetyTransportProvider).reportTalk(
            talkId: widget.talk.id,
            isReplay: !widget.talk.isLive,
            reason: reason,
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Report received. Thank you.')),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Couldn’t send the report right now.')),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _editDetails() async {
    final updated = await showEditTalkDetailsSheet(
      context,
      talk: widget.talk,
      onSave: ({required title, required topic, required summary}) async {
        await ref.read(talkTransportProvider).updateTalk(
              talkId: widget.talk.id,
              title: title,
              topic: topic,
              summary: summary,
            );
      },
    );
    if (!mounted || updated != true) return;
    Navigator.of(context).pop();
  }

  Future<void> _participants() {
    return showTalkParticipantsSheet(
      context,
      participants: widget.talk.participants,
      fallbackHostName: widget.talk.hostName,
    );
  }

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final hostUserId = _hostUserId;
    final preference = !widget.isHost && hostUserId != null
        ? ref.watch(talkSafetyPreferenceProvider(hostUserId))
        : null;
    final hostProfile = !widget.isHost && hostUserId != null
        ? ref.watch(humanProfileByUserIdProvider(hostUserId))
        : null;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 22),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 38,
              height: 4,
              decoration: BoxDecoration(
                color: u.structuralBorder,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
          ),
          const SizedBox(height: 14),
          Text(
            'Talk options',
            style: TextStyle(
              color: u.textPrimary,
              fontSize: 18,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          if (widget.isHost)
            ListTile(
              key: const ValueKey('talk-more-edit'),
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.edit_outlined),
              title: const Text('Edit Talk details'),
              subtitle: const Text('Change title, topic or replay summary'),
              onTap: _busy ? null : _editDetails,
            ),
          ListTile(
            key: const ValueKey('talk-more-participants'),
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.groups_2_outlined),
            title: const Text('View participants'),
            subtitle: Text(
              widget.talk.participants.isEmpty
                  ? 'See who is at the table'
                  : '${widget.talk.participants.length} at the table',
            ),
            onTap: _participants,
          ),
          if (!widget.isHost) ...[
            if (hostUserId != null)
              hostProfile!.when(
                data: (profile) {
                  if (profile == null) return const SizedBox.shrink();
                  return ListTile(
                    key: const ValueKey('talk-more-follow-host'),
                    contentPadding: EdgeInsets.zero,
                    leading: Icon(
                      profile.isFollowing
                          ? Icons.person_remove_outlined
                          : Icons.person_add_alt_1_outlined,
                    ),
                    title: Text(
                      profile.isFollowing ? 'Following' : 'Follow Host',
                    ),
                    subtitle: Text(
                      profile.isFollowing
                          ? 'Tap to unfollow ${profile.displayName}'
                          : 'See more Talks from ${profile.displayName}',
                    ),
                    onTap: _busy
                        ? null
                        : () => _toggleFollowing(
                              hostUserId: hostUserId,
                              following: !profile.isFollowing,
                            ),
                  );
                },
                loading: () => const ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(Icons.person_add_alt_1_outlined),
                  title: Text('Follow Host'),
                  subtitle: Text('Loading Host profile…'),
                  enabled: false,
                ),
                error: (_, __) => const SizedBox.shrink(),
              ),
            ListTile(
              key: const ValueKey('talk-more-report'),
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.flag_outlined),
              title: Text(widget.talk.isLive ? 'Report Talk' : 'Report replay'),
              subtitle: const Text('Send a private safety report to Masanawa'),
              onTap: _busy ? null : _report,
            ),
            if (hostUserId == null)
              const ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(Icons.shield_outlined),
                title: Text('Host preferences unavailable'),
                subtitle: Text('This Talk does not expose a verified Host identity.'),
              )
            else
              preference!.when(
                data: (value) => Column(
                  children: [
                    SwitchListTile(
                      key: const ValueKey('talk-more-mute-host'),
                      contentPadding: EdgeInsets.zero,
                      secondary: const Icon(Icons.volume_off_outlined),
                      title: const Text('Mute Host'),
                      subtitle: const Text('Hide this Host’s Talks from your feeds'),
                      value: value.muted,
                      onChanged: _busy
                          ? null
                          : (next) => _setPreference(
                                current: value,
                                muted: next,
                              ),
                    ),
                    SwitchListTile(
                      key: const ValueKey('talk-more-block-host'),
                      contentPadding: EdgeInsets.zero,
                      secondary: const Icon(Icons.block_outlined),
                      title: const Text('Block Host'),
                      subtitle: const Text(
                        'Hide their Talks and prevent Talk interaction',
                      ),
                      value: value.blocked,
                      onChanged: _busy
                          ? null
                          : (next) => _setPreference(
                                current: value,
                                blocked: next,
                              ),
                    ),
                  ],
                ),
                loading: () => const Padding(
                  padding: EdgeInsets.symmetric(vertical: 18),
                  child: Center(child: CircularProgressIndicator()),
                ),
                error: (_, __) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.refresh_rounded),
                  title: const Text('Couldn’t load Host preferences'),
                  subtitle: const Text('Tap to try again'),
                  onTap: () =>
                      ref.invalidate(talkSafetyPreferenceProvider(hostUserId)),
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class _ReportReasonSheet extends StatelessWidget {
  const _ReportReasonSheet({required this.talkTitle});

  final String talkTitle;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 22),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Why are you reporting this?',
            style: TextStyle(
              color: u.textPrimary,
              fontSize: 18,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            talkTitle,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(color: u.textMuted, fontSize: 13),
          ),
          const SizedBox(height: 8),
          Flexible(
            child: ListView(
              shrinkWrap: true,
              children: [
                for (final reason in TalkSafetyReportReason.values)
                  ListTile(
                    key: ValueKey('talk-report-${reason.wire}'),
                    contentPadding: EdgeInsets.zero,
                    title: Text(reason.label),
                    onTap: () => Navigator.of(context).pop(reason),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

Future<void> showTalkParticipantsSheet(
  BuildContext context, {
  required List<TalkParticipantPreview> participants,
  required String fallbackHostName,
}) {
  return showModalBottomSheet<void>(
    context: context,
    useSafeArea: true,
    builder: (context) {
      final u = context.masanawa;
      final effective = participants.isEmpty
          ? [
              TalkParticipantPreview(
                id: 'host',
                name: fallbackHostName.isEmpty ? 'Host' : fallbackHostName,
                kind: TalkParticipantKind.human,
                isHost: true,
              ),
            ]
          : participants;
      return Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 22),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Participants',
              style: TextStyle(
                color: u.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 8),
            for (final participant in effective)
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: CircleAvatar(
                  backgroundColor: u.surfaceMuted,
                  child: Icon(
                    switch (participant.kind) {
                      TalkParticipantKind.human => Icons.person_rounded,
                      TalkParticipantKind.expert => Icons.verified_rounded,
                      TalkParticipantKind.twin => Icons.auto_awesome_rounded,
                    },
                    color: u.brandStrong,
                  ),
                ),
                title: Text(participant.name.isEmpty ? 'Participant' : participant.name),
                subtitle: Text(
                  participant.isHost
                      ? 'Human · Host'
                      : switch (participant.kind) {
                          TalkParticipantKind.human => 'Human · Speaker',
                          TalkParticipantKind.expert => 'Masanawa Expert · AI',
                          TalkParticipantKind.twin => 'Twin · AI',
                        },
                ),
              ),
          ],
        ),
      );
    },
  );
}


typedef TalkDetailsSave = Future<void> Function({
  required String title,
  required String topic,
  required String summary,
});

Future<bool?> showEditTalkDetailsSheet(
  BuildContext context, {
  required TalkDiscoveryItem talk,
  required TalkDetailsSave onSave,
}) {
  return showModalBottomSheet<bool>(
    context: context,
    useSafeArea: true,
    isScrollControlled: true,
    builder: (_) => _EditTalkDetailsSheet(talk: talk, onSave: onSave),
  );
}

class _EditTalkDetailsSheet extends StatefulWidget {
  const _EditTalkDetailsSheet({
    required this.talk,
    required this.onSave,
  });

  final TalkDiscoveryItem talk;
  final TalkDetailsSave onSave;

  @override
  State<_EditTalkDetailsSheet> createState() => _EditTalkDetailsSheetState();
}

class _EditTalkDetailsSheetState extends State<_EditTalkDetailsSheet> {
  late final TextEditingController _title;
  late final TextEditingController _topic;
  late final TextEditingController _summary;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _title = TextEditingController(text: widget.talk.title);
    _topic = TextEditingController(text: widget.talk.topic ?? '');
    _summary = TextEditingController(text: widget.talk.summary);
  }

  @override
  void dispose() {
    _title.dispose();
    _topic.dispose();
    _summary.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_saving) return;
    final title = _title.text.trim();
    final topic = _topic.text.trim();
    final summary = _summary.text.trim();
    if (title.isEmpty || topic.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Title and topic are required.')),
      );
      return;
    }
    setState(() => _saving = true);
    try {
      await widget.onSave(title: title, topic: topic, summary: summary);
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Couldn’t update the Talk right now.')),
      );
      setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        18,
        20,
        18 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Edit Talk details',
              style: TextStyle(
                color: u.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 14),
            TextField(
              key: const ValueKey('talk-edit-title'),
              controller: _title,
              maxLength: 160,
              decoration: const InputDecoration(labelText: 'Title'),
            ),
            const SizedBox(height: 8),
            TextField(
              key: const ValueKey('talk-edit-topic'),
              controller: _topic,
              maxLength: 240,
              decoration: const InputDecoration(labelText: 'Topic'),
            ),
            const SizedBox(height: 8),
            TextField(
              key: const ValueKey('talk-edit-summary'),
              controller: _summary,
              maxLength: 1000,
              minLines: 3,
              maxLines: 5,
              decoration: const InputDecoration(
                labelText: 'Summary',
                hintText: 'Useful context for people finding the replay later',
              ),
            ),
            const SizedBox(height: 12),
            FilledButton(
              key: const ValueKey('talk-edit-save'),
              onPressed: _saving ? null : _save,
              child: _saving
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Save changes'),
            ),
          ],
        ),
      ),
    );
  }
}
