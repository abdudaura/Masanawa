import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/talk_host_controls_state.dart';
import '../../state/talk_safety_state.dart';
import '../../talks/talk_host_controls.dart';
import '../../talks/talk_safety.dart';
import '../../talks/talk_models.dart';
import '../../theme/masanawa_theme.dart';

Future<void> showTalkHostRequestsSheet(
  BuildContext context, {
  required String talkId,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => FractionallySizedBox(
      heightFactor: .78,
      child: _HostRequestsSheet(talkId: talkId),
    ),
  );
}

Future<void> showTalkHostManageSheet(
  BuildContext context, {
  required String talkId,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => FractionallySizedBox(
      heightFactor: .78,
      child: _HostManageSheet(talkId: talkId),
    ),
  );
}

Future<bool> confirmEndTalk(BuildContext context) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('End this Talk?'),
      content: const Text(
        'Live participation will stop. A replay may remain available according to the Talk’s publication settings.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: const Text('Keep live'),
        ),
        FilledButton(
          key: const ValueKey('end-talk-confirm'),
          onPressed: () => Navigator.of(context).pop(true),
          child: const Text('End Talk'),
        ),
      ],
    ),
  );
  return confirmed == true;
}

class _HostRequestsSheet extends ConsumerStatefulWidget {
  const _HostRequestsSheet({required this.talkId});

  final String talkId;

  @override
  ConsumerState<_HostRequestsSheet> createState() => _HostRequestsSheetState();
}

class _HostRequestsSheetState extends ConsumerState<_HostRequestsSheet> {
  String? _busyId;

  Future<void> _act(
    TalkHostRequest request,
    TalkHostRequestAction action,
  ) async {
    if (_busyId != null) return;
    setState(() => _busyId = request.requestId);
    try {
      await ref.read(talkHostControlsTransportProvider).actOnRequest(
            talkId: widget.talkId,
            requestId: request.requestId,
            action: action,
          );
      ref.invalidate(talkHostControlsProvider(widget.talkId));
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Couldn’t update this request.')),
      );
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final asyncView = ref.watch(talkHostControlsProvider(widget.talkId));

    return Scaffold(
      backgroundColor: u.surfaceBg,
      appBar: AppBar(
        automaticallyImplyLeading: false,
        title: const Text('Requests'),
        leading: IconButton(
          tooltip: 'Close',
          onPressed: () => Navigator.of(context).pop(),
          icon: const Icon(Icons.close_rounded),
        ),
      ),
      body: asyncView.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => _HostSheetState(
          icon: Icons.wifi_off_rounded,
          title: 'Couldn’t load requests.',
          subtitle: 'Close and try again.',
        ),
        data: (view) {
          if (view.requests.isEmpty) {
            return const _HostSheetState(
              icon: Icons.inbox_outlined,
              title: 'No pending requests.',
              subtitle:
                  'Raise Hand and sponsored AI requests will appear here.',
            );
          }

          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(10, 8, 10, 24),
            itemCount: view.requests.length,
            separatorBuilder: (_, __) =>
                Divider(height: 1, indent: 62, color: u.structuralBorder),
            itemBuilder: (context, index) {
              final request = view.requests[index];
              final busy = _busyId == request.requestId;
              return _HostRequestTile(
                request: request,
                busy: busy,
                onAccept: () =>
                    _act(request, TalkHostRequestAction.accept),
                onDecline: () =>
                    _act(request, TalkHostRequestAction.decline),
              );
            },
          );
        },
      ),
    );
  }
}

class _HostRequestTile extends StatelessWidget {
  const _HostRequestTile({
    required this.request,
    required this.busy,
    required this.onAccept,
    required this.onDecline,
  });

  final TalkHostRequest request;
  final bool busy;
  final VoidCallback onAccept;
  final VoidCallback onDecline;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final image = request.avatarUrl?.trim();
    final isHuman = request.kind == TalkHostRequestKind.humanSpeaker;
    final typeLabel = switch (request.kind) {
      TalkHostRequestKind.humanSpeaker => 'Wants to speak · Free',
      TalkHostRequestKind.sponsoredExpert => 'Sponsored Expert',
      TalkHostRequestKind.sponsoredTwin => 'Sponsored Twin',
    };

    return Padding(
      key: ValueKey('host-request-' + request.requestId),
      padding: const EdgeInsets.fromLTRB(6, 10, 6, 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 21,
            backgroundColor: u.surfaceMuted,
            backgroundImage:
                image != null && image.isNotEmpty ? NetworkImage(image) : null,
            child: image == null || image.isEmpty
                ? Icon(
                    isHuman
                        ? Icons.person_rounded
                        : request.kind == TalkHostRequestKind.sponsoredExpert
                            ? Icons.verified_rounded
                            : Icons.auto_awesome_rounded,
                    color: u.brandStrong,
                  )
                : null,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  request.displayName,
                  style: TextStyle(
                    color: u.textPrimary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  typeLabel +
                      (request.amountLabel?.trim().isNotEmpty == true
                          ? ' · ' + request.amountLabel!
                          : ''),
                  style: TextStyle(color: u.textMuted, fontSize: 12),
                ),
                if (request.detail.trim().isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(
                    request.detail,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(color: u.textMuted, fontSize: 12),
                  ),
                ],
                const SizedBox(height: 9),
                Row(
                  children: [
                    OutlinedButton(
                      onPressed: busy ? null : onDecline,
                      child: const Text('Decline'),
                    ),
                    const SizedBox(width: 8),
                    FilledButton(
                      key: ValueKey('host-request-accept-' + request.requestId),
                      onPressed: busy ? null : onAccept,
                      child: busy
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Text('Accept'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _HostManageSheet extends ConsumerStatefulWidget {
  const _HostManageSheet({required this.talkId});

  final String talkId;

  @override
  ConsumerState<_HostManageSheet> createState() => _HostManageSheetState();
}

class _HostManageSheetState extends ConsumerState<_HostManageSheet> {
  String? _busyId;

  Future<void> _report(TalkHostParticipant participant) async {
    if (_busyId != null || participant.isHost) return;
    final targetKind = participant.kind == TalkParticipantKind.human
        ? TalkSafetyTargetKind.profile
        : TalkSafetyTargetKind.persona;
    final targetId = participant.kind == TalkParticipantKind.human
        ? participant.profileHandle?.trim()
        : participant.personaId?.trim();
    if (targetId == null || targetId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Reporting is unavailable for this participant.')),
      );
      return;
    }
    final reason = await showModalBottomSheet<TalkSafetyReportReason>(
      context: context,
      useSafeArea: true,
      builder: (_) => _ParticipantReportReasonSheet(
        displayName: participant.displayName,
      ),
    );
    if (!mounted || reason == null) return;
    setState(() => _busyId = participant.participantId);
    try {
      await ref.read(talkSafetyTransportProvider).reportTarget(
            targetKind: targetKind,
            targetId: targetId,
            reason: reason,
            detail: 'Reported by Talk Host from ' + widget.talkId,
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
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _block(TalkHostParticipant participant) async {
    final userId = participant.userId?.trim();
    if (
      _busyId != null ||
      participant.isHost ||
      participant.kind != TalkParticipantKind.human ||
      userId == null ||
      userId.isEmpty
    ) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Block ' + participant.displayName + '?'),
        content: const Text(
          'They will be removed from this Talk and won’t be able to raise a hand or comment on your Talks while blocked.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            key: const ValueKey('host-participant-block-confirm'),
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Block and remove'),
          ),
        ],
      ),
    );
    if (!mounted || confirmed != true) return;

    setState(() => _busyId = participant.participantId);
    try {
      final current =
          await ref.read(talkSafetyTransportProvider).loadUserPreference(userId);
      await ref.read(talkSafetyTransportProvider).setUserPreference(
            userId: userId,
            blocked: true,
            muted: current.muted,
          );
      ref.invalidate(talkSafetyPreferenceProvider(userId));

      try {
        await ref.read(talkHostControlsTransportProvider).actOnParticipant(
              talkId: widget.talkId,
              participantId: participant.participantId,
              action: TalkHostParticipantAction.remove,
            );
        ref.invalidate(talkHostControlsProvider(widget.talkId));
      } catch (_) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Participant blocked, but live removal failed. Try Remove again.',
            ),
          ),
        );
        return;
      }

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Participant blocked and removed.')),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Couldn’t block this participant.')),
      );
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _act(
    TalkHostParticipant participant,
    TalkHostParticipantAction action,
  ) async {
    if (_busyId != null || participant.isHost) return;
    setState(() => _busyId = participant.participantId);
    try {
      await ref.read(talkHostControlsTransportProvider).actOnParticipant(
            talkId: widget.talkId,
            participantId: participant.participantId,
            action: action,
          );
      ref.invalidate(talkHostControlsProvider(widget.talkId));
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Couldn’t update this participant.')),
      );
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final asyncView = ref.watch(talkHostControlsProvider(widget.talkId));

    return Scaffold(
      backgroundColor: u.surfaceBg,
      appBar: AppBar(
        automaticallyImplyLeading: false,
        title: const Text('Manage participants'),
        leading: IconButton(
          tooltip: 'Close',
          onPressed: () => Navigator.of(context).pop(),
          icon: const Icon(Icons.close_rounded),
        ),
      ),
      body: asyncView.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => const _HostSheetState(
          icon: Icons.wifi_off_rounded,
          title: 'Couldn’t load participants.',
          subtitle: 'Close and try again.',
        ),
        data: (view) {
          if (view.participants.isEmpty) {
            return const _HostSheetState(
              icon: Icons.people_outline_rounded,
              title: 'No active participants.',
              subtitle: 'Active Seats will appear here.',
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(10, 8, 10, 24),
            itemCount: view.participants.length,
            separatorBuilder: (_, __) =>
                Divider(height: 1, indent: 62, color: u.structuralBorder),
            itemBuilder: (context, index) {
              final participant = view.participants[index];
              final busy = _busyId == participant.participantId;
              return _ParticipantTile(
                participant: participant,
                busy: busy,
                onReport: () => _report(participant),
                onBlock: participant.kind == TalkParticipantKind.human &&
                        participant.userId?.trim().isNotEmpty == true
                    ? () => _block(participant)
                    : null,
                onMuteToggle: () => _act(
                  participant,
                  participant.isMuted
                      ? TalkHostParticipantAction.unmute
                      : TalkHostParticipantAction.mute,
                ),
                onRemove: () =>
                    _act(participant, TalkHostParticipantAction.remove),
              );
            },
          );
        },
      ),
    );
  }
}

enum _ParticipantMenuAction { muteToggle, remove, report, block }

class _ParticipantTile extends StatelessWidget {
  const _ParticipantTile({
    required this.participant,
    required this.busy,
    required this.onMuteToggle,
    required this.onRemove,
    required this.onReport,
    this.onBlock,
  });

  final TalkHostParticipant participant;
  final bool busy;
  final VoidCallback onMuteToggle;
  final VoidCallback onRemove;
  final VoidCallback onReport;
  final VoidCallback? onBlock;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final kind = switch (participant.kind) {
      TalkParticipantKind.human =>
        participant.isHost ? 'Host' : 'Speaker',
      TalkParticipantKind.expert => 'Expert',
      TalkParticipantKind.twin => 'Twin',
    };

    return ListTile(
      key: ValueKey('host-participant-' + participant.participantId),
      contentPadding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
      leading: CircleAvatar(
        backgroundColor:
            participant.kind == TalkParticipantKind.human
                ? u.brandStrong
                : u.surfaceMuted,
        child: Icon(
          participant.kind == TalkParticipantKind.human
              ? Icons.person_rounded
              : participant.kind == TalkParticipantKind.expert
                  ? Icons.verified_rounded
                  : Icons.auto_awesome_rounded,
          color: participant.kind == TalkParticipantKind.human
              ? Colors.white
              : u.brandStrong,
        ),
      ),
      title: Text(
        participant.displayName,
        style: const TextStyle(fontWeight: FontWeight.w700),
      ),
      subtitle: Text(
        kind + (participant.isMuted ? ' · Muted' : ''),
        style: TextStyle(color: u.textMuted),
      ),
      trailing: participant.isHost
          ? Text(
              'You',
              style: TextStyle(
                color: u.brandStrong,
                fontWeight: FontWeight.w700,
              ),
            )
          : PopupMenuButton<_ParticipantMenuAction>(
              key: ValueKey('host-participant-menu-' + participant.participantId),
              enabled: !busy,
              onSelected: (action) {
                switch (action) {
                  case _ParticipantMenuAction.muteToggle:
                    onMuteToggle();
                  case _ParticipantMenuAction.remove:
                    onRemove();
                  case _ParticipantMenuAction.report:
                    onReport();
                  case _ParticipantMenuAction.block:
                    onBlock?.call();
                }
              },
              itemBuilder: (_) => [
                PopupMenuItem(
                  value: _ParticipantMenuAction.muteToggle,
                  child: Text(participant.isMuted ? 'Unmute' : 'Mute'),
                ),
                const PopupMenuItem(
                  value: _ParticipantMenuAction.remove,
                  child: Text('Remove'),
                ),
                PopupMenuItem(
                  key: ValueKey('host-participant-report-' + participant.participantId),
                  value: _ParticipantMenuAction.report,
                  child: const Text('Report'),
                ),
                if (onBlock != null)
                  PopupMenuItem(
                    key: ValueKey('host-participant-block-' + participant.participantId),
                    value: _ParticipantMenuAction.block,
                    child: const Text('Block'),
                  ),
              ],
            ),
    );
  }
}

class _HostSheetState extends StatelessWidget {
  const _HostSheetState({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(28, 80, 28, 28),
      children: [
        Icon(icon, size: 42, color: u.textMuted),
        const SizedBox(height: 12),
        Text(
          title,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: u.textPrimary,
            fontSize: 17,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 5),
        Text(
          subtitle,
          textAlign: TextAlign.center,
          style: TextStyle(color: u.textMuted, fontSize: 13),
        ),
      ],
    );
  }
}


class _ParticipantReportReasonSheet extends StatelessWidget {
  const _ParticipantReportReasonSheet({required this.displayName});

  final String displayName;

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
            'Report ' + displayName,
            style: TextStyle(
              color: u.textPrimary,
              fontSize: 18,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          Flexible(
            child: ListView(
              shrinkWrap: true,
              children: [
                for (final reason in TalkSafetyReportReason.values)
                  ListTile(
                    key: ValueKey('host-participant-report-reason-' + reason.wire),
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
