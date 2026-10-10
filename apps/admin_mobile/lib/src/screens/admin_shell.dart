import 'package:flutter/material.dart';

import '../core/admin_api.dart';
import '../theme/masanawa_theme.dart';
import 'platform_pages.dart';
import 'whatsapp_channel_page.dart';
import 'admin_agents_page.dart';
import '../operator_admin/operator_agents_page.dart';
import 'decision_center_page.dart';

class AdminShell extends StatefulWidget {
  const AdminShell({super.key, required this.api, required this.onSignOut});
  final AdminApi api;
  final Future<void> Function() onSignOut;

  @override
  State<AdminShell> createState() => _AdminShellState();
}

class _AdminSection {
  const _AdminSection(this.label, this.icon);
  final String label;
  final IconData icon;
}

class _AdminShellState extends State<AdminShell> {
  int _index = 0;

  static const _sections = <_AdminSection>[
    _AdminSection('Overview', Icons.dashboard_outlined),
    _AdminSection('Users', Icons.people_outline),
    _AdminSection('Admin Agents', Icons.support_agent_outlined),
    _AdminSection('Agent Operations', Icons.security_outlined),
    _AdminSection('Decision Center', Icons.psychology_alt_outlined),
    _AdminSection('Agents', Icons.smart_toy_outlined),
    _AdminSection('Skills', Icons.extension_outlined),
    _AdminSection('Runtime', Icons.timeline_outlined),
    _AdminSection('Commerce', Icons.account_balance_wallet_outlined),
    _AdminSection('Operations', Icons.rule_outlined),
    _AdminSection('Providers', Icons.hub_outlined),
    _AdminSection('System', Icons.settings_suggest_outlined),
    _AdminSection('Channels', Icons.forum_outlined),
    _AdminSection('Modules', Icons.grid_view_outlined),
    _AdminSection('Audit', Icons.fact_check_outlined),
  ];

  List<Widget> get _pages => [
        OverviewPage(api: widget.api),
        UsersAdminPage(api: widget.api),
        AdminAgentsPage(api: widget.api),
        OperatorAgentsPage(admin: widget.api),
        const DecisionCenterPage(),
        AgentsPage(api: widget.api),
        SkillsPage(api: widget.api),
        RuntimeAdminPage(api: widget.api),
        CommerceAdminPage(api: widget.api),
        OperationsAdminPage(api: widget.api),
        ProvidersAdminPage(api: widget.api),
        SystemAdminPage(api: widget.api),
        WhatsAppChannelPage(adminApi: widget.api),
        const ModulesAdminPage(),
        AuditAdminPage(api: widget.api),
      ];

  void _select(int value) {
    setState(() => _index = value);
    final navigator = Navigator.of(context);
    if (navigator.canPop()) navigator.pop();
  }

  @override
  Widget build(BuildContext context) => LayoutBuilder(
        builder: (context, constraints) {
          final wide = constraints.maxWidth >= 840;
          final pages = _pages;
          final content = IndexedStack(index: _index, children: pages);

          return Scaffold(
            appBar: AppBar(
              titleSpacing: 16,
              title: Row(
                children: [
                  Image.asset(
                    'assets/brand/masanawa_agent_logo.png',
                    width: 30,
                    height: 30,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      wide
                          ? 'Masanawa Admin · ${_sections[_index].label}'
                          : _sections[_index].label,
                    ),
                  ),
                ],
              ),
              actions: [
                IconButton(
                  tooltip: 'Sign out',
                  onPressed: widget.onSignOut,
                  icon: const Icon(Icons.logout),
                ),
              ],
            ),
            drawer: wide
                ? null
                : NavigationDrawer(
                    selectedIndex: _index,
                    onDestinationSelected: _select,
                    children: [
                      const Padding(
                        padding: EdgeInsets.fromLTRB(28, 20, 16, 10),
                        child: Text('Platform control'),
                      ),
                      ..._sections.map(
                        (section) => NavigationDrawerDestination(
                          icon: Icon(section.icon),
                          label: Text(section.label),
                        ),
                      ),
                    ],
                  ),
            body: wide
                ? Row(
                    children: [
                      NavigationRail(
                        selectedIndex: _index,
                        onDestinationSelected: _select,
                        labelType: NavigationRailLabelType.all,
                        leading: const Padding(
                          padding: EdgeInsets.only(bottom: 8),
                          child: Text('Control'),
                        ),
                        destinations: _sections
                            .map(
                              (section) => NavigationRailDestination(
                                icon: Icon(section.icon),
                                label: Text(section.label),
                              ),
                            )
                            .toList(growable: false),
                      ),
                      const VerticalDivider(width: 1),
                      Expanded(child: content),
                    ],
                  )
                : content,
          );
        },
      );
}

class OverviewPage extends StatefulWidget {
  const OverviewPage({super.key, required this.api});
  final AdminApi api;

  @override
  State<OverviewPage> createState() => _OverviewPageState();
}

class _OverviewPageState extends State<OverviewPage> {
  late Future<_OverviewData> _future = _load();

  Future<_OverviewData> _load() async {
    await widget.api.health();
    final readiness = await widget.api.readiness();
    final summary = await widget.api.platformSummary();
    final skills = await widget.api.skills();
    return _OverviewData(
      readiness: readiness,
      summary: summary,
      skills: skills.length,
    );
  }

  @override
  Widget build(BuildContext context) => AsyncPanel<_OverviewData>(
        future: _future,
        onRetry: () => setState(() => _future = _load()),
        builder: (data) {
          final ready = data.readiness.status == 'ready';
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(
                'Platform overview',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 4),
              Text(
                'Live operational truth across the Masanawa tenant.',
                style: TextStyle(color: context.masanawa.textMuted),
              ),
              const SizedBox(height: 14),
              Wrap(
                spacing: 12,
                runSpacing: 12,
                children: [
                  MetricCard(
                    label: 'Ops',
                    value: ready ? 'Ready' : data.readiness.status,
                    icon: ready
                        ? Icons.check_circle_outline
                        : Icons.warning_amber_rounded,
                  ),
                  MetricCard(
                    label: 'Users',
                    value: '${data.summary.users}',
                    icon: Icons.people_outline,
                  ),
                  MetricCard(
                    label: 'Characters',
                    value: '${data.summary.characters}',
                    icon: Icons.smart_toy_outlined,
                  ),
                  MetricCard(
                    label: 'Active sessions',
                    value: '${data.summary.activeSessions}',
                    icon: Icons.forum_outlined,
                  ),
                  MetricCard(
                    label: 'Running AgentRuns',
                    value: '${data.summary.runningAgentRuns}',
                    icon: Icons.play_circle_outline,
                  ),
                  MetricCard(
                    label: 'Skills',
                    value: '${data.skills}',
                    icon: Icons.extension_outlined,
                  ),
                  MetricCard(
                    label: 'Enabled offers',
                    value: '${data.summary.enabledOffers}',
                    icon: Icons.sell_outlined,
                  ),
                  MetricCard(
                    label: 'Fulfilled',
                    value: '${data.summary.completedFulfillments}',
                    icon: Icons.task_alt_outlined,
                  ),
                  MetricCard(
                    label: 'Needs reconciliation',
                    value: '${data.summary.openReconciliationCases}',
                    icon: Icons.rule_outlined,
                  ),
                  MetricCard(
                    label: 'Provider credentials',
                    value: '${data.summary.activeProviderCredentials}',
                    icon: Icons.key_outlined,
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Text(
                'Readiness checks',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 8),
              if (data.readiness.checks.isEmpty)
                const Card(
                  child: ListTile(title: Text('No dependency checks reported')),
                )
              else
                ...data.readiness.checks.map(
                  (check) => Card(
                    child: ListTile(
                      leading: Icon(
                        check['ready'] == true
                            ? Icons.check_circle_outline
                            : Icons.error_outline,
                      ),
                      title: Text(check['name']?.toString() ?? 'Check'),
                      subtitle: check['reason'] == null
                          ? null
                          : Text(check['reason'].toString()),
                    ),
                  ),
                ),
            ],
          );
        },
      );
}

class _OverviewData {
  const _OverviewData({
    required this.readiness,
    required this.summary,
    required this.skills,
  });
  final OpsReadiness readiness;
  final PlatformSummary summary;
  final int skills;
}

class MetricCard extends StatelessWidget {
  const MetricCard({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
  });
  final String label;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) => SizedBox(
        width: 155,
        child: Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(icon, color: context.masanawa.brand),
                const SizedBox(height: 12),
                Text(
                  value,
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                Text(
                  label,
                  style: TextStyle(color: context.masanawa.textMuted),
                ),
              ],
            ),
          ),
        ),
      );
}

class AgentsPage extends StatefulWidget {
  const AgentsPage({super.key, required this.api});
  final AdminApi api;

  @override
  State<AgentsPage> createState() => _AgentsPageState();
}

class _AgentsPageState extends State<AgentsPage> {
  late Future<List<AgentPresentation>> _future = widget.api.agents();

  Future<void> _configureNew() async {
    try {
      final characters = await widget.api.characters();
      if (!mounted) return;
      final available = characters
          .where((character) =>
              !character.configuredInUserApp &&
              character.activeCharacterVersionId != null)
          .toList(growable: false);

      if (available.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('No unconfigured Character with an active version is available.'),
          ),
        );
        return;
      }

      final selected = await showModalBottomSheet<AdminCharacter>(
        context: context,
        showDragHandle: true,
        builder: (context) => SafeArea(
          child: ListView(
            shrinkWrap: true,
            children: [
              const ListTile(
                title: Text('Configure Character'),
                subtitle: Text('Choose a canonical Character to expose in the user app.'),
              ),
              ...available.map(
                (character) => ListTile(
                  leading: const Icon(Icons.smart_toy_outlined),
                  title: Text(character.displayName ?? shortId(character.characterId)),
                  subtitle: Text(
                    '${shortId(character.characterId)} · ${character.state}'
                    '${character.ownershipKind == null ? '' : ' · ${character.ownershipKind}'}',
                  ),
                  onTap: () => Navigator.of(context).pop(character),
                ),
              ),
            ],
          ),
        ),
      );
      if (selected == null || !mounted) return;

      final draft = AgentPresentation(
        characterId: selected.characterId,
        characterVersionId: selected.activeCharacterVersionId!,
        displayName: selected.displayName ?? '',
        roleLabel: selected.roleLabel ?? '',
        about: '',
        greeting: null,
        visibleInUserApp: true,
        sortOrder: 0,
        revision: 0,
      );

      final changed = await Navigator.of(context).push<bool>(
        MaterialPageRoute(
          builder: (_) => AgentEditorScreen(api: widget.api, agent: draft),
        ),
      );
      if (changed == true && mounted) {
        setState(() => _future = widget.api.agents());
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(error.toString())),
        );
      }
    }
  }

  Future<void> _edit(AgentPresentation agent) async {
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => AgentEditorScreen(api: widget.api, agent: agent),
      ),
    );
    if (changed == true && mounted) {
      setState(() => _future = widget.api.agents());
    }
  }

  @override
  Widget build(BuildContext context) =>
      AsyncPanel<List<AgentPresentation>>(
        future: _future,
        onRetry: () => setState(() => _future = widget.api.agents()),
        builder: (items) => RefreshIndicator(
          onRefresh: () async {
            final next = widget.api.agents();
            setState(() => _future = next);
            await next;
          },
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Agents',
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                  ),
                  FilledButton.icon(
                    onPressed: _configureNew,
                    icon: const Icon(Icons.add),
                    label: const Text('Configure'),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                'Manage configured Agents or expose another canonical Character.',
                style: TextStyle(color: context.masanawa.textMuted),
              ),
              const SizedBox(height: 12),
              if (items.isEmpty)
                const Card(
                  child: ListTile(title: Text('No configured agents')),
                )
              else
                ...items.map(
                  (agent) => Card(
                    child: ListTile(
                      onTap: () => _edit(agent),
                      leading: CircleAvatar(
                        backgroundColor: context.masanawa.surfaceMuted,
                        child: Icon(
                          Icons.smart_toy_outlined,
                          color: context.masanawa.brand,
                        ),
                      ),
                      title: Text(agent.displayName),
                      subtitle: Text(
                        '${agent.roleLabel}\n${agent.about}',
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                      ),
                      isThreeLine: true,
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            agent.visibleInUserApp
                                ? Icons.visibility_outlined
                                : Icons.visibility_off_outlined,
                          ),
                          const SizedBox(width: 4),
                          const Icon(Icons.chevron_right),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      );
}

class AgentEditorScreen extends StatefulWidget {
  const AgentEditorScreen({
    super.key,
    required this.api,
    required this.agent,
  });

  final AdminApi api;
  final AgentPresentation agent;

  @override
  State<AgentEditorScreen> createState() => _AgentEditorScreenState();
}

class _AgentEditorScreenState extends State<AgentEditorScreen> {
  late AgentPresentation _agent = widget.agent;
  late final TextEditingController _name =
      TextEditingController(text: _agent.displayName);
  late final TextEditingController _role =
      TextEditingController(text: _agent.roleLabel);
  late final TextEditingController _about =
      TextEditingController(text: _agent.about);
  late final TextEditingController _greeting =
      TextEditingController(text: _agent.greeting ?? '');
  late final TextEditingController _sort =
      TextEditingController(text: _agent.sortOrder.toString());

  late Future<_AgentEditorData> _future = _load();
  bool _visible = false;
  bool _saving = false;
  String? _error;

  Future<_AgentEditorData> _load() async {
    _visible = _agent.visibleInUserApp;
    final skills = await widget.api.skills();
    final assignment = await widget.api.agentSkills(_agent.characterId);
    return _AgentEditorData(
      skills: skills,
      selected: assignment?.skillVersionIds.toSet() ?? <String>{},
      assignmentRevision: assignment?.revision,
    );
  }

  Future<void> _save(_AgentEditorData data) async {
    final sort = int.tryParse(_sort.text.trim());
    if (_name.text.trim().isEmpty || _role.text.trim().isEmpty || sort == null) {
      setState(() => _error = 'Name, role and a valid sort order are required.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      _agent = await widget.api.updateAgentPresentation(
        _agent,
        displayName: _name.text,
        roleLabel: _role.text,
        about: _about.text,
        greeting: _greeting.text,
        visibleInUserApp: _visible,
        sortOrder: sort,
      );
      await widget.api.updateAgentSkills(
        _agent.characterId,
        skillVersionIds: data.selected.toList(growable: false),
        expectedRevision: data.assignmentRevision,
      );
      if (mounted) Navigator.of(context).pop(true);
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _role.dispose();
    _about.dispose();
    _greeting.dispose();
    _sort.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Edit agent')),
        body: AsyncPanel<_AgentEditorData>(
          future: _future,
          onRetry: () => setState(() => _future = _load()),
          builder: (data) => StatefulBuilder(
            builder: (context, setInnerState) => ListView(
              padding: const EdgeInsets.all(16),
              children: [
                TextField(
                  controller: _name,
                  decoration: const InputDecoration(labelText: 'Display name'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _role,
                  decoration: const InputDecoration(labelText: 'Role label'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _about,
                  minLines: 3,
                  maxLines: 5,
                  decoration: const InputDecoration(labelText: 'About'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _greeting,
                  minLines: 2,
                  maxLines: 4,
                  decoration: const InputDecoration(
                    labelText: 'Greeting',
                    hintText: 'Optional',
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _sort,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Sort order'),
                ),
                const SizedBox(height: 8),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  value: _visible,
                  onChanged: (value) {
                    setState(() => _visible = value);
                    setInnerState(() {});
                  },
                  title: const Text('Visible in customer app'),
                ),
                const SizedBox(height: 18),
                Text(
                  'Assigned Skills',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 8),
                ...data.skills.map(
                  (skill) => CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    value: data.selected.contains(skill.skillVersionId),
                    onChanged: (checked) {
                      setInnerState(() {
                        if (checked == true) {
                          data.selected.add(skill.skillVersionId);
                        } else {
                          data.selected.remove(skill.skillVersionId);
                        }
                      });
                    },
                    title: Text(skill.displayName),
                    subtitle: Text(
                      '${skill.key} · ${skill.version} · ${skill.readiness}',
                    ),
                  ),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    _error!,
                    style: TextStyle(color: context.masanawa.emergency),
                  ),
                ],
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: _saving ? null : () => _save(data),
                  icon: _saving
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.save_outlined),
                  label: Text(_saving ? 'Saving…' : 'Save agent'),
                ),
                const SizedBox(height: 32),
              ],
            ),
          ),
        ),
      );
}

class _AgentEditorData {
  _AgentEditorData({
    required this.skills,
    required this.selected,
    required this.assignmentRevision,
  });

  final List<AdminSkill> skills;
  final Set<String> selected;
  final int? assignmentRevision;
}

class SkillsPage extends StatefulWidget {
  const SkillsPage({super.key, required this.api});
  final AdminApi api;

  @override
  State<SkillsPage> createState() => _SkillsPageState();
}

class _SkillsPageState extends State<SkillsPage> {
  late Future<List<AdminSkill>> _future = widget.api.skills();

  Future<void> _edit(AdminSkill skill) async {
    var state = skill.readiness == 'unknown' ? 'disabled' : skill.readiness;
    var advertised = skill.advertised;
    final reason = TextEditingController(text: skill.reasonCode ?? '');

    final saved = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text(skill.displayName),
          content: SizedBox(
            width: 420,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  initialValue: state,
                  decoration: const InputDecoration(labelText: 'Readiness'),
                  items: const [
                    DropdownMenuItem(value: 'ready', child: Text('Ready')),
                    DropdownMenuItem(value: 'degraded', child: Text('Degraded')),
                    DropdownMenuItem(value: 'blocked', child: Text('Blocked')),
                    DropdownMenuItem(value: 'disabled', child: Text('Disabled')),
                  ],
                  onChanged: (value) {
                    if (value == null) return;
                    setDialogState(() {
                      state = value;
                      if (state != 'ready') advertised = false;
                    });
                  },
                ),
                const SizedBox(height: 12),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  value: advertised,
                  onChanged: state == 'ready'
                      ? (value) => setDialogState(() => advertised = value)
                      : null,
                  title: const Text('Advertise to runtime'),
                  subtitle: const Text('Only Ready Skills may be advertised.'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: reason,
                  decoration: const InputDecoration(
                    labelText: 'Reason code',
                    hintText: 'Optional, e.g. provider.degraded',
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () async {
                try {
                  await widget.api.updateSkillReadiness(
                    skill,
                    state: state,
                    advertised: advertised,
                    reasonCode: reason.text,
                  );
                  if (context.mounted) Navigator.of(context).pop(true);
                } catch (error) {
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text(error.toString())),
                    );
                  }
                }
              },
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
    reason.dispose();

    if (saved == true && mounted) {
      setState(() => _future = widget.api.skills());
    }
  }

  @override
  Widget build(BuildContext context) => AsyncPanel<List<AdminSkill>>(
        future: _future,
        onRetry: () => setState(() => _future = widget.api.skills()),
        builder: (items) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text('Skills', style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 4),
            Text(
              'Inspect and manage runtime readiness and advertising.',
              style: TextStyle(color: context.masanawa.textMuted),
            ),
            const SizedBox(height: 12),
            ...items.map(
              (skill) => Card(
                child: ListTile(
                  onTap: () => _edit(skill),
                  leading: Icon(
                    Icons.extension_outlined,
                    color: context.masanawa.brand,
                  ),
                  title: Text(skill.displayName),
                  subtitle: Text(
                    '${skill.key} · ${skill.version}'
                    '${skill.reasonCode == null ? '' : '\n${skill.reasonCode}'}',
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                  ),
                  isThreeLine: skill.reasonCode != null,
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (skill.advertised)
                        const Padding(
                          padding: EdgeInsets.only(right: 6),
                          child: Icon(Icons.campaign_outlined),
                        ),
                      Chip(label: Text(skill.readiness)),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      );
}

class ContractPendingPage extends StatelessWidget {
  const ContractPendingPage({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
  });
  final IconData icon;
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) => Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 440),
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 54, color: context.masanawa.brand),
                const SizedBox(height: 16),
                Text(
                  title,
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 8),
                Text(
                  message,
                  textAlign: TextAlign.center,
                  style: TextStyle(color: context.masanawa.textMuted),
                ),
              ],
            ),
          ),
        ),
      );
}

class AsyncPanel<T> extends StatelessWidget {
  const AsyncPanel({
    super.key,
    required this.future,
    required this.builder,
    required this.onRetry,
  });
  final Future<T> future;
  final Widget Function(T value) builder;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => FutureBuilder<T>(
        future: future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.cloud_off_outlined, size: 48),
                    const SizedBox(height: 12),
                    Text(
                      snapshot.error.toString(),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 12),
                    OutlinedButton.icon(
                      onPressed: onRetry,
                      icon: const Icon(Icons.refresh),
                      label: const Text('Retry'),
                    ),
                  ],
                ),
              ),
            );
          }
          return builder(snapshot.requireData);
        },
      );
}
