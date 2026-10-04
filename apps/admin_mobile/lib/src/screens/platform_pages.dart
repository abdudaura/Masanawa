import 'package:flutter/material.dart';

import '../core/admin_api.dart';
import '../theme/masanawa_theme.dart';

class UsersAdminPage extends StatefulWidget {
  const UsersAdminPage({super.key, required this.api});
  final AdminApi api;
  @override
  State<UsersAdminPage> createState() => _UsersAdminPageState();
}

class _UsersAdminPageState extends State<UsersAdminPage> {
  late Future<List<AdminUser>> _future = widget.api.users();

  Future<void> _changeState(AdminUser user, String state) async {
    try {
      await widget.api.setUserState(user, state);
      if (!mounted) return;
      setState(() => _future = widget.api.users());
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('User is now $state.')),
      );
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(error.toString())),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) => AdminFuture<List<AdminUser>>(
        future: _future,
        retry: () => setState(() => _future = widget.api.users()),
        builder: (users) => AdminPageList(
          title: 'Users & identity',
          subtitle: 'Tenant users, linked identities and relationship counts.',
          children: users.map((user) => Card(
            child: ListTile(
              leading: CircleAvatar(
                child: Icon(user.state == 'active'
                    ? Icons.person_outline
                    : Icons.person_off_outlined),
              ),
              title: Text(shortId(user.userId)),
              subtitle: Text(
                '${user.identityCount} identities · '
                '${user.relationshipCount} relationships · rev ${user.revision}',
              ),
              trailing: PopupMenuButton<String>(
                initialValue: user.state,
                onSelected: (state) => _changeState(user, state),
                itemBuilder: (_) => const [
                  PopupMenuItem(value: 'active', child: Text('Active')),
                  PopupMenuItem(value: 'disabled', child: Text('Disabled')),
                  PopupMenuItem(value: 'archived', child: Text('Archived')),
                ],
                child: Chip(label: Text(user.state)),
              ),
            ),
          )).toList(growable: false),
        ),
      );
}

class RuntimeAdminPage extends StatefulWidget {
  const RuntimeAdminPage({super.key, required this.api});
  final AdminApi api;
  @override
  State<RuntimeAdminPage> createState() => _RuntimeAdminPageState();
}

class _RuntimeAdminPageState extends State<RuntimeAdminPage> {
  late Future<List<AdminAgentRun>> _future = widget.api.agentRuns();

  @override
  Widget build(BuildContext context) => AdminFuture<List<AdminAgentRun>>(
        future: _future,
        retry: () => setState(() => _future = widget.api.agentRuns()),
        builder: (runs) => AdminPageList(
          title: 'Agent runtime',
          subtitle: 'Recent AgentRun execution, failures and correlation traces.',
          children: runs.map((run) => Card(
            child: ListTile(
              leading: Icon(
                run.state == 'running'
                    ? Icons.play_circle_outline
                    : run.state == 'completed'
                        ? Icons.check_circle_outline
                        : Icons.error_outline,
                color: run.state == 'failed'
                    ? context.masanawa.emergency
                    : context.masanawa.brand,
              ),
              title: Text('${shortId(run.agentRunId)} · ${run.state}'),
              subtitle: Text(
                'User ${shortId(run.userId)}\n'
                'Character ${shortId(run.characterId)}'
                '${run.failureCode == null ? '' : '\n${run.failureCode}'}',
              ),
              isThreeLine: true,
              trailing: Tooltip(
                message: run.correlationId,
                child: const Icon(Icons.hub_outlined),
              ),
            ),
          )).toList(growable: false),
        ),
      );
}

class CommerceAdminPage extends StatefulWidget {
  const CommerceAdminPage({super.key, required this.api});
  final AdminApi api;
  @override
  State<CommerceAdminPage> createState() => _CommerceAdminPageState();
}

class _CommerceAdminPageState extends State<CommerceAdminPage> {
  late Future<CommerceData> _future = _load();

  Future<CommerceData> _load() async => CommerceData(
        offers: await widget.api.offers(),
        fulfillments: await widget.api.fulfillments(),
        ledger: await widget.api.ledger(),
      );

  @override
  Widget build(BuildContext context) => AdminFuture<CommerceData>(
        future: _future,
        retry: () => setState(() => _future = _load()),
        builder: (data) => DefaultTabController(
          length: 3,
          child: Column(
            children: [
              const TabBar(tabs: [
                Tab(text: 'Offers'),
                Tab(text: 'Fulfillments'),
                Tab(text: 'Ledger'),
              ]),
              Expanded(
                child: TabBarView(children: [
                  ListView(
                    padding: const EdgeInsets.all(16),
                    children: data.offers.map((offer) => Card(
                      child: ListTile(
                        leading: Icon(Icons.sell_outlined,
                            color: context.masanawa.brand),
                        title: Text(offer.key),
                        subtitle: Text(
                          '${shortId(offer.offerId)} · rev ${offer.revision}',
                        ),
                        trailing: Chip(
                          label: Text(offer.enabled ? 'enabled' : 'disabled'),
                        ),
                      ),
                    )).toList(growable: false),
                  ),
                  ListView(
                    padding: const EdgeInsets.all(16),
                    children: data.fulfillments.map((item) => Card(
                      child: ListTile(
                        leading: const Icon(Icons.inventory_2_outlined),
                        title: Text(shortId(item.fulfillmentId)),
                        subtitle: Text('Quote ${shortId(item.quoteId)}'),
                        trailing: Chip(label: Text(item.state)),
                      ),
                    )).toList(growable: false),
                  ),
                  ListView(
                    padding: const EdgeInsets.all(16),
                    children: data.ledger.map((entry) => Card(
                      child: ListTile(
                        leading: const Icon(Icons.account_balance_wallet_outlined),
                        title: Text(
                          '${entry.amountCredits} credits · ${entry.reason}',
                        ),
                        subtitle: Text(
                          '${entry.debitKind} → ${entry.creditKind}\n'
                          '${shortId(entry.ledgerEntryId)}',
                        ),
                        isThreeLine: true,
                      ),
                    )).toList(growable: false),
                  ),
                ]),
              ),
            ],
          ),
        ),
      );
}

class CommerceData {
  const CommerceData({
    required this.offers,
    required this.fulfillments,
    required this.ledger,
  });
  final List<AdminOffer> offers;
  final List<AdminFulfillment> fulfillments;
  final List<AdminLedgerEntry> ledger;
}

class OperationsAdminPage extends StatefulWidget {
  const OperationsAdminPage({super.key, required this.api});
  final AdminApi api;
  @override
  State<OperationsAdminPage> createState() => _OperationsAdminPageState();
}

class _OperationsAdminPageState extends State<OperationsAdminPage> {
  late Future<OperationsData> _future = _load();

  Future<OperationsData> _load() async => OperationsData(
        operations: await widget.api.operations(),
        reconciliation: await widget.api.reconciliationCases(),
      );

  @override
  Widget build(BuildContext context) => AdminFuture<OperationsData>(
        future: _future,
        retry: () => setState(() => _future = _load()),
        builder: (data) => DefaultTabController(
          length: 2,
          child: Column(
            children: [
              const TabBar(tabs: [
                Tab(text: 'Operations'),
                Tab(text: 'Reconciliation'),
              ]),
              Expanded(
                child: TabBarView(children: [
                  ListView(
                    padding: const EdgeInsets.all(16),
                    children: data.operations.map((operation) => Card(
                      child: ListTile(
                        leading: const Icon(Icons.sync_alt_outlined),
                        title: Text(operation.kind),
                        subtitle: Text(
                          '${shortId(operation.operationId)}'
                          '${operation.provider == null ? '' : ' · ${operation.provider}'}'
                          '${operation.terminalErrorCode == null ? '' : '\n${operation.terminalErrorCode}'}',
                        ),
                        trailing: Chip(label: Text(operation.state)),
                      ),
                    )).toList(growable: false),
                  ),
                  ListView(
                    padding: const EdgeInsets.all(16),
                    children: data.reconciliation.map((item) => Card(
                      child: ListTile(
                        leading: Icon(
                          item.status == 'needs-attention'
                              ? Icons.warning_amber_rounded
                              : Icons.rule_outlined,
                          color: item.status == 'needs-attention'
                              ? context.masanawa.warning
                              : context.masanawa.brand,
                        ),
                        title: Text(item.reasonCode),
                        subtitle: Text(
                          '${shortId(item.operationId)}'
                          '${item.nextAction == null ? '' : '\n${item.nextAction}'}',
                        ),
                        trailing: Chip(label: Text(item.status)),
                      ),
                    )).toList(growable: false),
                  ),
                ]),
              ),
            ],
          ),
        ),
      );
}

class OperationsData {
  const OperationsData({
    required this.operations,
    required this.reconciliation,
  });
  final List<AdminOperation> operations;
  final List<AdminReconciliationCase> reconciliation;
}

class ProvidersAdminPage extends StatefulWidget {
  const ProvidersAdminPage({super.key, required this.api});
  final AdminApi api;
  @override
  State<ProvidersAdminPage> createState() => _ProvidersAdminPageState();
}

class _ProvidersAdminPageState extends State<ProvidersAdminPage> {
  late Future<List<AdminCredentialRef>> _future =
      widget.api.providerCredentials();

  @override
  Widget build(BuildContext context) => AdminFuture<List<AdminCredentialRef>>(
        future: _future,
        retry: () =>
            setState(() => _future = widget.api.providerCredentials()),
        builder: (items) => AdminPageList(
          title: 'Providers & credentials',
          subtitle:
              'Metadata only. Secret ciphertext is never returned to this app.',
          children: items.map((item) => Card(
            child: ListTile(
              leading: Icon(
                Icons.key_outlined,
                color: item.active
                    ? context.masanawa.brand
                    : context.masanawa.textMuted,
              ),
              title: Text('${shortId(item.providerId)} · ${item.slotKey}'),
              subtitle: Text(
                'generation ${item.generation} · ${item.algorithm}\n'
                'key ${shortId(item.keyId)}',
              ),
              isThreeLine: true,
              trailing: Chip(
                label: Text(item.active ? 'active' : 'inactive'),
              ),
            ),
          )).toList(growable: false),
        ),
      );
}

class AuditAdminPage extends StatefulWidget {
  const AuditAdminPage({super.key, required this.api});
  final AdminApi api;
  @override
  State<AuditAdminPage> createState() => _AuditAdminPageState();
}

class _AuditAdminPageState extends State<AuditAdminPage> {
  late Future<List<AdminAuditEvent>> _future = widget.api.auditEvents();

  @override
  Widget build(BuildContext context) => AdminFuture<List<AdminAuditEvent>>(
        future: _future,
        retry: () => setState(() => _future = widget.api.auditEvents()),
        builder: (items) => AdminPageList(
          title: 'Audit trail',
          subtitle: 'Security-safe event metadata for operational tracing.',
          children: items.map((item) => Card(
            child: ListTile(
              leading: const Icon(Icons.fact_check_outlined),
              title: Text(item.eventType),
              subtitle: Text(
                '${item.aggregateType} · ${shortId(item.aggregateId)}\n'
                '${shortId(item.correlationId)}',
              ),
              isThreeLine: true,
              trailing: Chip(label: Text(item.sensitivity)),
            ),
          )).toList(growable: false),
        ),
      );
}

class AdminPageList extends StatelessWidget {
  const AdminPageList({
    super.key,
    required this.title,
    required this.subtitle,
    required this.children,
  });
  final String title;
  final String subtitle;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(title, style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 4),
          Text(subtitle, style: TextStyle(color: context.masanawa.textMuted)),
          const SizedBox(height: 14),
          if (children.isEmpty)
            const Card(child: ListTile(title: Text('No records')))
          else
            ...children,
        ],
      );
}

class AdminFuture<T> extends StatelessWidget {
  const AdminFuture({
    super.key,
    required this.future,
    required this.builder,
    required this.retry,
  });
  final Future<T> future;
  final Widget Function(T value) builder;
  final VoidCallback retry;

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
                    Text(snapshot.error.toString(), textAlign: TextAlign.center),
                    const SizedBox(height: 12),
                    OutlinedButton.icon(
                      onPressed: retry,
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

String shortId(String value) => value.length <= 20
    ? value
    : '${value.substring(0, 10)}…${value.substring(value.length - 7)}';
