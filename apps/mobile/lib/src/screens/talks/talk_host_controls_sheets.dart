import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/talk_host_controls_state.dart';
import '../../talks/talk_host_controls.dart';
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

class _ParticipantTile extends StatelessWidget {
  const _ParticipantTile({
    required this.participant,
    required this.busy,
    required this.onMuteToggle,
    required this.onRemove,
  });

  final TalkHostParticipant participant;
  final bool busy;
  final VoidCallback onMuteToggle;
  final VoidCallback onRemove;

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
          : PopupMenuButton<TalkHostParticipantAction>(
              enabled: !busy,
              onSelected: (action) {
                if (action == TalkHostParticipantAction.remove) {
                  onRemove();
                } else {
                  onMuteToggle();
                }
              },
              itemBuilder: (_) => [
                PopupMenuItem(
                  value: participant.isMuted
                      ? TalkHostParticipantAction.unmute
                      : TalkHostParticipantAction.mute,
                  child: Text(participant.isMuted ? 'Unmute' : 'Mute'),
                ),
                const PopupMenuItem(
                  value: TalkHostParticipantAction.remove,
                  child: Text('Remove'),
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
