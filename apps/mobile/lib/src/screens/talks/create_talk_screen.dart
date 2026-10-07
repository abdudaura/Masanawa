import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/talk_state.dart';
import '../../talks/talk_models.dart';
import '../../theme/masanawa_theme.dart';

class CreateTalkScreen extends ConsumerStatefulWidget {
  const CreateTalkScreen({
    super.key,
    this.onCreated,
    this.onAddExpert,
    this.onInvitePerson,
    this.onAddTwin,
  });

  final void Function(TalkDiscoveryItem talk)? onCreated;
  final VoidCallback? onAddExpert;
  final VoidCallback? onInvitePerson;
  final VoidCallback? onAddTwin;

  @override
  ConsumerState<CreateTalkScreen> createState() => _CreateTalkScreenState();
}

class _CreateTalkScreenState extends ConsumerState<CreateTalkScreen> {
  final _topic = TextEditingController();
  final _title = TextEditingController();
  bool _creating = false;
  bool _recordReplay = false;

  @override
  void dispose() {
    _topic.dispose();
    _title.dispose();
    super.dispose();
  }

  Future<void> _goLive() async {
    final topic = _topic.text.trim();
    if (topic.isEmpty || _creating) return;
    setState(() => _creating = true);
    try {
      final talk = await ref.read(talkTransportProvider).createTalk(
            topic: topic,
            title: _title.text.trim().isEmpty ? null : _title.text.trim(),
            recordReplay: _recordReplay,
          );
      ref.invalidate(talkFeedProvider(TalkFeedKind.explore));
      ref.invalidate(talkFeedProvider(TalkFeedKind.live));
      if (!mounted) return;
      widget.onCreated?.call(talk);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Couldn’t start the Talk right now. Try again.'),
        ),
      );
    } finally {
      if (mounted) setState(() => _creating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Scaffold(
      backgroundColor: u.surfaceBg,
      appBar: const AppBar(title: Text('Create a Talk')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 110),
          children: [
            Text(
              'What do you want to talk about?',
              style: TextStyle(
                color: u.textPrimary,
                fontSize: 20,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              key: const ValueKey('create-talk-topic'),
              controller: _topic,
              minLines: 3,
              maxLines: 5,
              maxLength: 220,
              decoration: const InputDecoration(
                hintText: 'Say it naturally — Gwani can help shape the conversation.',
              ),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 12),
            TextField(
              key: const ValueKey('create-talk-title'),
              controller: _title,
              maxLength: 90,
              decoration: const InputDecoration(
                hintText: 'Short title (optional)',
                prefixIcon: Icon(Icons.title_rounded),
              ),
            ),
            const SizedBox(height: 18),
            Text(
              'Who’s joining?',
              style: TextStyle(
                color: u.textPrimary,
                fontSize: 16,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 10),
            _ParticipantAction(
              icon: Icons.verified_outlined,
              title: 'Add Expert',
              subtitle: 'Bring a Masanawa specialist to the table',
              onTap: widget.onAddExpert,
            ),
            _ParticipantAction(
              icon: Icons.person_add_alt_1_rounded,
              title: 'Invite person',
              subtitle: 'Human speaker Seats are free',
              onTap: widget.onInvitePerson,
            ),
            _ParticipantAction(
              icon: Icons.auto_awesome_rounded,
              title: 'Add My Twin',
              subtitle: 'Bring your Twin into a paid AI Seat',
              onTap: widget.onAddTwin,
            ),
            const SizedBox(height: 14),
            SwitchListTile.adaptive(
              key: const ValueKey('create-talk-record-replay'),
              contentPadding: const EdgeInsets.symmetric(horizontal: 4),
              value: _recordReplay,
              onChanged: _creating
                  ? null
                  : (value) => setState(() => _recordReplay = value),
              title: const Text(
                'Save a replay',
                style: TextStyle(fontWeight: FontWeight.w600),
              ),
              subtitle: const Text(
                'Record this Talk so people can listen after it ends.',
              ),
              secondary: const Icon(Icons.replay_circle_filled_outlined),
            ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(13),
              decoration: BoxDecoration(
                color: u.surfaceCard,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: u.structuralBorder),
              ),
              child: Row(
                children: [
                  Icon(Icons.people_alt_outlined, color: u.brandStrong),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Up to 6 active Seats, with no more than 3 AI Seats.',
                      style: TextStyle(
                        color: u.textMuted,
                        fontSize: 13,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      bottomSheet: SafeArea(
        top: false,
        child: Container(
          color: u.surfaceCard,
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
          child: FilledButton.icon(
            key: const ValueKey('create-talk-go-live'),
            onPressed: _topic.text.trim().isEmpty || _creating ? null : _goLive,
            icon: _creating
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.podcasts_rounded),
            label: Text(_creating ? 'Starting…' : 'Go Live'),
          ),
        ),
      ),
    );
  }
}

class _ParticipantAction extends StatelessWidget {
  const _ParticipantAction({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Material(
      color: u.surfaceCard,
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
        leading: CircleAvatar(
          backgroundColor: u.surfaceMuted,
          child: Icon(icon, color: u.brandStrong),
        ),
        title: Text(
          title,
          style: TextStyle(
            color: u.textPrimary,
            fontWeight: FontWeight.w600,
          ),
        ),
        subtitle: Text(
          subtitle,
          style: TextStyle(color: u.textMuted, fontSize: 12.5),
        ),
        trailing: Icon(Icons.chevron_right_rounded, color: u.textMuted),
        onTap: onTap,
      ),
    );
  }
}
