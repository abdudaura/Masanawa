import 'package:flutter/material.dart';

import '../core/admin_api.dart';
import '../theme/masanawa_theme.dart';

class AdminShell extends StatefulWidget {
  const AdminShell({super.key, required this.api, required this.onSignOut});
  final AdminApi api;
  final Future<void> Function() onSignOut;

  @override
  State<AdminShell> createState() => _AdminShellState();
}

class _AdminShellState extends State<AdminShell> {
  int _index = 0;

  static const _destinations = <NavigationDestination>[
    NavigationDestination(
      icon: Icon(Icons.dashboard_outlined),
      selectedIcon: Icon(Icons.dashboard),
      label: 'Overview',
    ),
    NavigationDestination(
      icon: Icon(Icons.smart_toy_outlined),
      selectedIcon: Icon(Icons.smart_toy),
      label: 'Agents',
    ),
    NavigationDestination(
      icon: Icon(Icons.extension_outlined),
      selectedIcon: Icon(Icons.extension),
      label: 'Skills',
    ),
    NavigationDestination(
      icon: Icon(Icons.people_outline),
      selectedIcon: Icon(Icons.people),
      label: 'Users',
    ),
    NavigationDestination(
      icon: Icon(Icons.receipt_long_outlined),
      selectedIcon: Icon(Icons.receipt_long),
      label: 'Money',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final pages = <Widget>[
      OverviewPage(api: widget.api),
      AgentsPage(api: widget.api),
      SkillsPage(api: widget.api),
      const ContractPendingPage(
        icon: Icons.people_outline,
        title: 'Users',
        message:
            'User administration is waiting for an authorized server-side admin contract. The app will not query the database directly.',
      ),
      const ContractPendingPage(
        icon: Icons.receipt_long_outlined,
        title: 'Transactions',
        message:
            'Billing, crypto and settlement administration will connect here after scoped Ops projections are available.',
      ),
    ];

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 16,
        title: Row(
          children: [
            Image.asset(
              'assets/brand/masanawa_agent_logo.png',
              width: 32,
              height: 32,
            ),
            const SizedBox(width: 10),
            const Text('Masanawa Admin'),
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
      body: IndexedStack(index: _index, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (value) => setState(() => _index = value),
        destinations: _destinations,
      ),
    );
  }
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
    final agents = await widget.api.agents();
    final skills = await widget.api.skills();
    return _OverviewData(
      readiness: readiness,
      agents: agents.length,
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
                    label: 'Agents',
                    value: '${data.agents}',
                    icon: Icons.smart_toy_outlined,
                  ),
                  MetricCard(
                    label: 'Skills',
                    value: '${data.skills}',
                    icon: Icons.extension_outlined,
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
    required this.agents,
    required this.skills,
  });
  final OpsReadiness readiness;
  final int agents;
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

  @override
  Widget build(BuildContext context) =>
      AsyncPanel<List<AgentPresentation>>(
        future: _future,
        onRetry: () => setState(() => _future = widget.api.agents()),
        builder: (items) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text('Agents', style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 12),
            if (items.isEmpty)
              const Card(
                child: ListTile(title: Text('No configured agents')),
              )
            else
              ...items.map(
                (agent) => Card(
                  child: ListTile(
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
                    trailing: Icon(
                      agent.visibleInUserApp
                          ? Icons.visibility_outlined
                          : Icons.visibility_off_outlined,
                    ),
                  ),
                ),
              ),
          ],
        ),
      );
}

class SkillsPage extends StatefulWidget {
  const SkillsPage({super.key, required this.api});
  final AdminApi api;

  @override
  State<SkillsPage> createState() => _SkillsPageState();
}

class _SkillsPageState extends State<SkillsPage> {
  late Future<List<AdminSkill>> _future = widget.api.skills();

  @override
  Widget build(BuildContext context) => AsyncPanel<List<AdminSkill>>(
        future: _future,
        onRetry: () => setState(() => _future = widget.api.skills()),
        builder: (items) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text('Skills', style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 12),
            ...items.map(
              (skill) => Card(
                child: ListTile(
                  leading: Icon(
                    Icons.extension_outlined,
                    color: context.masanawa.brand,
                  ),
                  title: Text(skill.displayName),
                  subtitle: Text(
                    '${skill.key} · ${skill.version}\n${skill.description}',
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                  ),
                  isThreeLine: true,
                  trailing: Tooltip(
                    message:
                        skill.advertised ? 'Advertised' : 'Not advertised',
                    child: Chip(label: Text(skill.readiness)),
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
