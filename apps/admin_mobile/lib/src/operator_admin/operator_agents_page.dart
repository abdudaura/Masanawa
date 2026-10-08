import 'package:flutter/material.dart';
import '../core/admin_api.dart';
import 'operator_agent_api.dart';

/// Review-only operator controls: published versions and runtime readiness are
/// projections. This page never grants a tool or silently changes a wallet.
class OperatorAgentsPage extends StatefulWidget {
  const OperatorAgentsPage({super.key, required this.admin, this.repository});
  final AdminApi admin;
  final OperatorAgentRepository? repository;
  @override
  State<OperatorAgentsPage> createState() => _OperatorAgentsPageState();
}

class _OperatorAgentsPageState extends State<OperatorAgentsPage> {
  late OperatorAgentRepository _repository;
  OperatorAgentSnapshot? _snapshot;
  Object? _error;
  bool _loading = false;
  bool _busy = false;
  int _generation = 0;

  @override
  void initState() {
    super.initState();
    _repository = widget.repository ?? OperatorAgentApi(admin: widget.admin);
    _refresh();
  }

  @override
  void didUpdateWidget(covariant OperatorAgentsPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.admin != widget.admin || oldWidget.repository != widget.repository) {
      _repository = widget.repository ?? OperatorAgentApi(admin: widget.admin);
      _snapshot = null;
      _refresh();
    }
  }

  @override
  void dispose() {
    _generation++;
    super.dispose();
  }

  Future<void> _refresh() async {
    final generation = ++_generation;
    setState(() { _loading = true; _error = null; _snapshot = null; });
    try {
      final value = await _repository.snapshot();
      if (!mounted || generation != _generation) return;
      setState(() { _snapshot = value; _loading = false; });
    } catch (error) {
      if (!mounted || generation != _generation) return;
      setState(() { _loading = false; _error = error; });
    }
  }

  Future<void> _detach(OperatorAgent agent, OperatorSkill skill) async {
    final revision = agent.assignmentRevision;
    if (_busy || revision == null) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Remove assigned skill?'),
        content: Text('Remove ' + skill.name + ' from ' + agent.name +
            '? The change affects server-side configuration. This does not delete the skill, revoke existing receipts or approve new tools.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Remove skill')),
        ],
      ),
    );
    if (confirmed != true || !mounted || _busy) return;
    final generation = ++_generation;
    setState(() { _busy = true; _error = null; });
    try {
      await _repository.detachSkill(
        characterId: agent.id, skillVersionId: skill.id, expectedRevision: revision);
      final updated = await _repository.snapshot();
      if (!mounted || generation != _generation) return;
      final matching = updated.agents.where((item) => item.id == agent.id).toList();
      if (matching.length != 1 || matching.single.skillIds.contains(skill.id) ||
          (matching.single.assignmentRevision ?? 0) <= revision) {
        throw const OperatorAgentException('UNCERTAIN',
            'The server has not confirmed this change. Reload to inspect the agent.');
      }
      setState(() { _snapshot = updated; _busy = false; });
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Skill removed and confirmed by server readback.')));
    } catch (error) {
      if (!mounted || generation != _generation) return;
      setState(() { _busy = false; _snapshot = null; _error = error; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final snapshot = _snapshot;
    final skills = <String, OperatorSkill>{
      for (final value in snapshot?.skills ?? const <OperatorSkill>[]) value.id: value,
    };
    return RefreshIndicator(
      onRefresh: _busy ? () async {} : _refresh,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        children: [
          Row(children: [
            Expanded(child: Text('Agent operations',
                style: Theme.of(context).textTheme.headlineSmall)),
            IconButton(tooltip: 'Refresh authoritative catalog', icon: const Icon(Icons.refresh),
                onPressed: _busy || _loading ? null : _refresh),
          ]),
          const Text('Privileged, server-backed agent versions and skill assignments. '
              'A configured skill is not proof that a live tool is ready.'),
          const SizedBox(height: 12),
          if (_loading) const Center(child: CircularProgressIndicator()),
          if (_error != null) Card(child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(children: [
              const Icon(Icons.warning_amber_outlined),
              Text(_error.toString()),
              const SizedBox(height: 8),
              FilledButton(onPressed: _busy ? null : _refresh, child: const Text('Retry safely')),
            ]),
          )),
          if (!_loading && snapshot != null) ...[
            Text('Read from Ops: ' + snapshot.readAt,
                style: Theme.of(context).textTheme.bodySmall),
            if (snapshot.agents.isEmpty)
              const Card(child: ListTile(title: Text('No configured agents returned.'))),
            ...snapshot.agents.map((agent) => Card(
              child: ExpansionTile(
                key: ValueKey(agent.id),
                leading: Icon(agent.visible ? Icons.smart_toy : Icons.visibility_off_outlined),
                title: Text(agent.name),
                subtitle: Text(agent.role + ' · Presentation rev ' +
                    agent.presentationRevision.toString()),
                children: [
                  ListTile(title: const Text('Canonical version'),
                    subtitle: SelectableText(agent.version)),
                  ListTile(title: const Text('Assignment revision'),
                    subtitle: Text(agent.assignmentRevision?.toString() ?? 'Not configured')),
                  if (agent.skillIds.isEmpty)
                    const ListTile(title: Text('No skills assigned')),
                  ...agent.skillIds.map((id) {
                    final skill = skills[id];
                    return ListTile(
                      title: Text(skill?.name ?? 'Unrecognized skill'),
                      subtitle: Text(skill == null ? 'Unknown version — inspect catalog' :
                          'v' + skill.version + ' · ' + skill.readiness),
                      trailing: skill == null || agent.assignmentRevision == null
                          ? const Icon(Icons.lock_outline)
                          : TextButton(
                              onPressed: _busy ? null : () => _detach(agent, skill),
                              child: const Text('Remove'),
                            ),
                    );
                  }),
                  const Padding(
                    padding: EdgeInsets.all(12),
                    child: Text('Granting new capabilities, publishing/rollback and money-related '
                        'changes require separate atomic audit and approval. Not available here.'),
                  ),
                ],
              ),
            )),
          ],
        ],
      ),
    );
  }
}
