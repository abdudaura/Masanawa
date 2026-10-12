import 'dart:async';
import 'package:flutter/material.dart';
import '../agents/agent_shell.dart';
import 'group_call_controller.dart';
import 'group_call_transport.dart';

class GroupCallScreen extends StatefulWidget {
  const GroupCallScreen({
    super.key,
    required this.accountKey,
    required this.currentAccountKey,
    required this.contacts,
    required this.transport,
    this.authorize,
    this.onChildConnected,
    this.onChildClosed,
    this.controller,
  });
  final String accountKey;
  final String? Function() currentAccountKey;
  final List<GroupContact> contacts;
  final GroupCallTransport transport;
  final Future<GroupAdmission?> Function(GroupContact)? authorize;
  final FutureOr<void> Function(AgentLiveVoiceGrant)? onChildConnected,
      onChildClosed;
  final GroupCallController? controller;
  @override
  State<GroupCallScreen> createState() => _GroupCallScreenState();
}

class _GroupCallScreenState extends State<GroupCallScreen> {
  late GroupCallController _controller;
  final Set<String> _selected = {};
  @override
  void initState() {
    super.initState();
    _controller =
        widget.controller ??
        GroupCallController(
          accountKey: widget.accountKey,
          currentAccountKey: widget.currentAccountKey,
          transport: widget.transport,
          contacts: widget.contacts,
          authorize: widget.authorize,
          onChildConnected: widget.onChildConnected,
          onChildClosed: widget.onChildClosed,
        );
    _controller.addListener(_refresh);
  }

  void _refresh() {
    if (mounted) setState(() {});
  }

  @override
  void didUpdateWidget(GroupCallScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.accountKey != widget.accountKey) {
      unawaited(_controller.accountChanged());
    }
  }

  @override
  void dispose() {
    _controller.removeListener(_refresh);
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controller = _controller;
    final inCall = controller.group != null;
    return PopScope<Object?>(
      canPop: controller.ended || !inCall,
      onPopInvokedWithResult: (didPop, _) async {
        if (!didPop) {
          await controller.end();
          if (context.mounted) Navigator.of(context).pop();
        }
      },
      child: Scaffold(
        appBar: AppBar(title: const Text('Group call')),
        body: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(16),
                child: Text(
                  controller.ended
                      ? 'Group call ended'
                      : inCall
                      ? 'One microphone · Masana speak in turn'
                      : widget.contacts.length < 2
                      ? 'Add at least two current Masana contacts before starting a group call.'
                      : 'Choose 2–4 Masana for a private audio call. Each paid voice needs your approval.',
                ),
              ),
              if (controller.error != null)
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(
                    controller.error!,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ),
              if (controller.busy) const LinearProgressIndicator(),
              Expanded(
                child: ListView(
                  children: [
                    for (final contact in widget.contacts)
                      if (!inCall)
                        CheckboxListTile(
                          title: Text(contact.displayName),
                          subtitle: Text(
                            contact.supportAgent
                                ? 'Support Masana'
                                : 'Voice price confirmed before joining',
                          ),
                          value: _selected.contains(contact.characterId),
                          onChanged: controller.busy || controller.ended
                              ? null
                              : (value) {
                                  setState(() {
                                    if (value == true && _selected.length < 4) {
                                      _selected.add(contact.characterId);
                                    } else {
                                      _selected.remove(contact.characterId);
                                    }
                                  });
                                },
                        )
                      else if (controller.group!.participants.any(
                        (p) => p.characterId == contact.characterId,
                      ))
                        ListTile(
                          title: Text(contact.displayName),
                          subtitle: Text(
                            controller.memberStates[contact.characterId] ??
                                'selected',
                          ),
                          trailing:
                              controller.ended ||
                                  const ['left', 'failed'].contains(
                                    controller.memberStates[contact
                                        .characterId],
                                  )
                              ? null
                              : IconButton(
                                  tooltip: 'Remove ${contact.displayName}',
                                  icon: const Icon(Icons.person_remove),
                                  onPressed: () =>
                                      controller.remove(contact.characterId),
                                ),
                        ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(16),
                child: !inCall
                    ? FilledButton.icon(
                        onPressed:
                            controller.busy ||
                                controller.ended ||
                                _selected.length < 2
                            ? null
                            : () => controller.start(_selected.toList()),
                        icon: const Icon(Icons.call),
                        label: const Text('Start group call'),
                      )
                    : Row(
                        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                        children: [
                          IconButton(
                            tooltip: controller.muted
                                ? 'Unmute microphone'
                                : 'Mute microphone',
                            onPressed: controller.ended
                                ? null
                                : () => controller.setMuted(!controller.muted),
                            icon: Icon(
                              controller.muted ? Icons.mic_off : Icons.mic,
                            ),
                          ),
                          FilledButton.icon(
                            onPressed: controller.ended ? null : controller.end,
                            icon: const Icon(Icons.call_end),
                            label: const Text('End call'),
                          ),
                        ],
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
