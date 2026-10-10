import 'package:flutter/material.dart';
import 'moderation_api.dart';

/// A15: phone-first staff case queue. AF00 wires into role-filtered drawer.
class ModerationScreen extends StatefulWidget {
  const ModerationScreen({super.key, required this.api, required this.canModerate});
  final ModerationApi api;
  final bool canModerate;
  @override State<ModerationScreen> createState() => _ModerationScreenState();
}
class _ModerationScreenState extends State<ModerationScreen> {
  late Future<List<Map<String, dynamic>>> _queue = widget.api.queue();
  void _refresh() => setState(() => _queue = widget.api.queue());

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Moderation · Gwani cases')),
    body: !widget.canModerate
        ? const Center(child: Text('Your staff role does not permit moderation.'))
        : RefreshIndicator(
            onRefresh: () async { _refresh(); await _queue; },
            child: FutureBuilder<List<Map<String, dynamic>>>(
              future: _queue,
              builder: (context, snapshot) {
                if (!snapshot.hasData && !snapshot.hasError) return const Center(child: CircularProgressIndicator());
                if (snapshot.hasError) return ListView(children: [
                  const ListTile(title: Text('Unable to load moderation queue'), subtitle: Text('Check your connection.')),
                  TextButton(onPressed: _refresh, child: const Text('Retry')),
                ]);
                final cases = snapshot.data!;
                if (cases.isEmpty) return ListView(children: const [
                  ListTile(title: Text('No reported cases'), subtitle: Text('The queue is clear. Pull to refresh.')),
                ]);
                return ListView.builder(
                  itemCount: cases.length,
                  itemBuilder: (context, index) {
                    final item = cases[index];
                    final id = item['caseId'] as String;
                    return Card(child: ListTile(
                      title: Text('${item['category']} · ${item['targetKind']}'),
                      subtitle: Text('$id\n${item['state']} · due ${item['slaDueAt']}'),
                      isThreeLine: true,
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () async {
                        await Navigator.push<void>(context, MaterialPageRoute(
                          builder: (_) => _StaffCaseDetail(api: widget.api, id: id),
                        ));
                        if (mounted) _refresh();
                      },
                    ));
                  },
                );
              },
            ),
          ),
  );
}
class _StaffCaseDetail extends StatefulWidget {
  const _StaffCaseDetail({required this.api, required this.id});
  final ModerationApi api;
  final String id;
  @override State<_StaffCaseDetail> createState() => _StaffCaseDetailState();
}
class _StaffCaseDetailState extends State<_StaffCaseDetail> {
  late Future<Map<String, dynamic>> _value = widget.api.caseDetail(widget.id);
  final _reason = TextEditingController();
  String _kind = 'hide_comment';
  bool _saving = false;
  String? _error;
  void _refresh() => setState(() => _value = widget.api.caseDetail(widget.id));
  @override void dispose() { _reason.dispose(); super.dispose(); }
  Future<void> _do(Future<void> Function() task) async {
    if (_saving) return;
    setState(() { _saving = true; _error = null; });
    try { await task(); if (mounted) { _refresh(); setState(() => _saving = false); } }
    catch (_) { if (mounted) setState(() { _saving = false; _error = 'Action was not saved. Refresh and retry.'; }); }
  }
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(widget.id)),
    body: FutureBuilder<Map<String, dynamic>>(
      future: _value,
      builder: (context, snapshot) {
        if (!snapshot.hasData && !snapshot.hasError) return const Center(child: CircularProgressIndicator());
        if (snapshot.hasError) return Center(child: TextButton(onPressed: _refresh, child: const Text('Retry case load')));
        final item = snapshot.data!;
        final actions = item['actions'] as List<dynamic>? ?? const [];
        return ListView(padding: const EdgeInsets.all(16), children: [
          Text('Status: ${item['state']}', style: Theme.of(context).textTheme.titleLarge),
          Text('${item['targetKind']} · ${item['targetId']}'),
          Text(item['details']?.toString() ?? ''),
          const SizedBox(height: 20),
          Text('Proposals', style: Theme.of(context).textTheme.titleMedium),
          for (final a in actions)
            Card(child: Column(children: [
              ListTile(
                title: Text('${a['kind']} · ${a['state']}'),
                subtitle: Text('Proposer ${a['proposedBy']}\nReason: ${a['reason']}'),
                isThreeLine: true,
              ),
              if (a['state'] == 'proposed')
                Wrap(children: [
                  TextButton(
                    onPressed: _saving ? null : () => _do(() => widget.api.decide(
                      caseId: widget.id, actionId: a['actionId'] as String,
                      approve: false, version: a['version'] as int,
                    )),
                    child: const Text('Reject'),
                  ),
                  FilledButton(
                    onPressed: _saving ? null : () => _do(() => widget.api.decide(
                      caseId: widget.id, actionId: a['actionId'] as String,
                      approve: true, version: a['version'] as int,
                    )),
                    child: Text(a['approvedBy'] == null ? 'Approve' : 'Second approval'),
                  ),
                ]),
            ])),
          const Divider(),
          const Text('Propose an action'),
          DropdownButtonFormField<String>(
            initialValue: _kind,
            items: const ['hide_comment', 'rate_limit', 'room_mute', 'user_ban', 'user_unban']
                .map((k) => DropdownMenuItem(value: k, child: Text(k.replaceAll('_', ' ')))).toList(),
            onChanged: (value) => setState(() => _kind = value ?? _kind),
          ),
          TextField(controller: _reason, decoration: const InputDecoration(labelText: 'Evidence and justification'), maxLength: 1000, maxLines: 2),
          const Text('Temporary actions expire after 24 hours. Bans require two different staff approvals.'),
          if (_error != null) Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          FilledButton(
            onPressed: _saving || _reason.text.trim().isEmpty ? null : () => _do(() => widget.api.propose(
              caseId: widget.id, kind: _kind, reason: _reason.text.trim(),
              version: item['version'] as int,
              expiresAt: ['hide_comment', 'room_mute', 'rate_limit'].contains(_kind)
                  ? DateTime.now().toUtc().add(const Duration(hours: 24)).toIso8601String() : null,
            )),
            child: const Text('Submit for review'),
          ),
        ]);
      },
    ),
  );
}
