import 'package:flutter/material.dart';

import '../../theme/masanawa_theme.dart';
import 'group_room_models.dart';

class GroupRoomScreen extends StatelessWidget {
  const GroupRoomScreen({
    super.key,
    required this.projection,
    required this.loading,
    this.errorMessage,
    this.onRetry,
    this.onOpenConversation,
    this.onOpenParticipant,
  });

  final GroupRoomProjection? projection;
  final bool loading;
  final String? errorMessage;
  final VoidCallback? onRetry;
  final VoidCallback? onOpenConversation;
  final ValueChanged<GroupParticipant>? onOpenParticipant;

  @override
  Widget build(BuildContext context) {
    final colors = context.masanawa;
    final view = projection;

    return Scaffold(
      backgroundColor: colors.surfaceBg,
      appBar: AppBar(title: const Text('Group Room')),
      body: RefreshIndicator(
        onRefresh: () async => onRetry?.call(),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
          children: [
            if (loading && view == null)
              const SizedBox(
                height: 420,
                child: Center(child: CircularProgressIndicator()),
              )
            else if (errorMessage != null && view == null)
              _ErrorState(message: errorMessage!, onRetry: onRetry)
            else if (view == null)
              const _UnavailableState()
            else ...[
              _Header(view: view),
              const SizedBox(height: 18),
              const _SectionTitle('Participants'),
              const SizedBox(height: 10),
              _Participants(
                participants: view.participants,
                onOpenParticipant: onOpenParticipant,
              ),
              const SizedBox(height: 22),
              const _SectionTitle('Recent conversation'),
              const SizedBox(height: 10),
              if (view.messages.isEmpty)
                const _NoMessages()
              else
                for (final message in view.messages)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _MessagePreview(
                      message: message,
                      author: view.participantFor(message.authorParticipantId),
                    ),
                  ),
              const SizedBox(height: 8),
              FilledButton.icon(
                onPressed: onOpenConversation,
                icon: const Icon(Icons.forum_outlined),
                label: const Text('Open conversation'),
              ),
              if (errorMessage != null) ...[
                const SizedBox(height: 10),
                _InlineWarning(message: errorMessage!, onRetry: onRetry),
              ],
            ],
          ],
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.view});

  final GroupRoomProjection view;

  @override
  Widget build(BuildContext context) {
    final colors = context.masanawa;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: colors.surfaceCard,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: colors.structuralBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 24,
                backgroundColor: colors.brand.withValues(alpha: .10),
                child: Icon(Icons.groups_2_outlined, color: colors.brand),
              ),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      view.title,
                      style: TextStyle(
                        color: colors.textPrimary,
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    if (view.description.isNotEmpty) ...[
                      const SizedBox(height: 5),
                      Text(
                        view.description,
                        style: TextStyle(
                          color: colors.textMuted,
                          fontSize: 13,
                          height: 1.4,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Icon(Icons.lock_outline, size: 17, color: colors.textMuted),
              const SizedBox(width: 7),
              Expanded(
                child: Text(
                  'Members only · group-scoped memory',
                  style: TextStyle(color: colors.textMuted, fontSize: 12),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Participants extends StatelessWidget {
  const _Participants({
    required this.participants,
    required this.onOpenParticipant,
  });

  final List<GroupParticipant> participants;
  final ValueChanged<GroupParticipant>? onOpenParticipant;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final participant in participants)
          ActionChip(
            avatar: Icon(_iconFor(participant.kind), size: 17),
            label: Text(_labelFor(participant)),
            onPressed: onOpenParticipant == null
                ? null
                : () => onOpenParticipant!(participant),
          ),
      ],
    );
  }

  IconData _iconFor(GroupParticipantKind kind) {
    switch (kind) {
      case GroupParticipantKind.human:
        return Icons.person_outline;
      case GroupParticipantKind.character:
        return Icons.smart_toy_outlined;
      case GroupParticipantKind.twin:
        return Icons.auto_awesome_outlined;
    }
  }

  String _labelFor(GroupParticipant participant) {
    switch (participant.role) {
      case GroupParticipantRole.owner:
        return '${participant.displayName} · owner';
      case GroupParticipantRole.moderator:
        return '${participant.displayName} · moderator';
      case GroupParticipantRole.member:
        return participant.displayName;
    }
  }
}

class _MessagePreview extends StatelessWidget {
  const _MessagePreview({required this.message, required this.author});

  final GroupMessageProjection message;
  final GroupParticipant author;

  @override
  Widget build(BuildContext context) {
    final colors = context.masanawa;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colors.surfaceCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.structuralBorder),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            author.kind == GroupParticipantKind.human
                ? Icons.person_outline
                : author.kind == GroupParticipantKind.character
                    ? Icons.smart_toy_outlined
                    : Icons.auto_awesome_outlined,
            size: 19,
            color: colors.brand,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  author.displayName,
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  message.text,
                  maxLines: 4,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontSize: 13,
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.masanawa;
    return Text(
      text,
      style: TextStyle(
        color: colors.textPrimary,
        fontSize: 16,
        fontWeight: FontWeight.w700,
      ),
    );
  }
}

class _NoMessages extends StatelessWidget {
  const _NoMessages();

  @override
  Widget build(BuildContext context) {
    final colors = context.masanawa;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 28),
      decoration: BoxDecoration(
        color: colors.surfaceCard,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: colors.structuralBorder),
      ),
      child: Text(
        'No group messages yet.',
        textAlign: TextAlign.center,
        style: TextStyle(color: colors.textMuted),
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = context.masanawa;
    return SizedBox(
      height: 420,
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.cloud_off_outlined, size: 36, color: colors.textMuted),
            const SizedBox(height: 10),
            Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(color: colors.textMuted),
            ),
            if (onRetry != null) ...[
              const SizedBox(height: 12),
              OutlinedButton(onPressed: onRetry, child: const Text('Try again')),
            ],
          ],
        ),
      ),
    );
  }
}

class _InlineWarning extends StatelessWidget {
  const _InlineWarning({required this.message, required this.onRetry});

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = context.masanawa;
    return Row(
      children: [
        Icon(Icons.info_outline, size: 18, color: colors.textMuted),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            message,
            style: TextStyle(color: colors.textMuted, fontSize: 12),
          ),
        ),
        if (onRetry != null)
          TextButton(onPressed: onRetry, child: const Text('Retry')),
      ],
    );
  }
}

class _UnavailableState extends StatelessWidget {
  const _UnavailableState();

  @override
  Widget build(BuildContext context) {
    final colors = context.masanawa;
    return SizedBox(
      height: 420,
      child: Center(
        child: Text(
          'This group room is not available yet.',
          style: TextStyle(color: colors.textMuted),
        ),
      ),
    );
  }
}
