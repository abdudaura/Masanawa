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
  String? _stateFilter;
  late Future<List<AdminUser>> _future = _load();

  Future<List<AdminUser>> _load() => widget.api.users(state: _stateFilter);

  void _setStateFilter(String? state) {
    setState(() {
      _stateFilter = state;
      _future = _load();
    });
  }

  Future<void> _showRelationships(AdminUser user) async {
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (context) => FractionallySizedBox(
        heightFactor: 0.72,
        child: SafeArea(
          child: FutureBuilder<List<AdminRelationship>>(
            future: widget.api.userRelationships(user.userId),
            builder: (context, snapshot) {
              if (snapshot.connectionState != ConnectionState.done) {
                return const Center(child: CircularProgressIndicator());
              }
              if (snapshot.hasError) {
                return Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(snapshot.error.toString(), textAlign: TextAlign.center),
                  ),
                );
              }
              final relationships =
                  snapshot.data ?? const <AdminRelationship>[];
              return ListView(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                children: [
                  Text(
                    'User relationships',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    shortId(user.userId),
                    style: TextStyle(color: context.masanawa.textMuted),
                  ),
                  const SizedBox(height: 12),
                  if (relationships.isEmpty)
                    const Card(
                      child: ListTile(title: Text('No active relationships')),
                    )
                  else
                    ...relationships.map(
                      (relationship) => Card(
                        child: ListTile(
                          leading: const Icon(Icons.link_outlined),
                          title: Text(
                            'Character ${shortId(relationship.characterId)}',
                          ),
                          subtitle: Text(
                            '${shortId(relationship.relationshipId)} · '
                            'rev ${relationship.revision}\n'
                            'updated ${relationship.updatedAt}',
                          ),
                          isThreeLine: true,
                          trailing: Chip(label: Text(relationship.state)),
                        ),
                      ),
                    ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => AdminFuture<List<AdminUser>>(
        future: _future,
        retry: () => setState(() => _future = _load()),
        builder: (users) => AdminPageList(
          title: 'Users & identity',
          subtitle: 'Tenant users, linked identities and relationship counts. Lifecycle changes stay read-only until Identity exposes a canonical state-transition command.',
          controls: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              ChoiceChip(
                label: const Text('All'),
                selected: _stateFilter == null,
                onSelected: (_) => _setStateFilter(null),
              ),
              for (final state in const ['active', 'disabled', 'archived'])
                ChoiceChip(
                  label: Text(state),
                  selected: _stateFilter == state,
                  onSelected: (_) => _setStateFilter(state),
                ),
            ],
          ),
          children: users.map((user) => Card(
            child: ListTile(
              onTap: () => _showRelationships(user),
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
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Chip(label: Text(user.state)),
                  if (user.relationshipCount > 0) ...[
                    const SizedBox(width: 4),
                    const Icon(Icons.chevron_right),
                  ],
                ],
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
  String? _stateFilter;
  late Future<List<AdminAgentRun>> _future = _load();

  Future<List<AdminAgentRun>> _load() =>
      widget.api.agentRuns(state: _stateFilter);

  void _setStateFilter(String? state) {
    setState(() {
      _stateFilter = state;
      _future = _load();
    });
  }

  @override
  Widget build(BuildContext context) => AdminFuture<List<AdminAgentRun>>(
        future: _future,
        retry: () => setState(() => _future = _load()),
        builder: (runs) => AdminPageList(
          title: 'Agent runtime',
          subtitle: 'Recent AgentRun execution, failures and correlation traces.',
          controls: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              ChoiceChip(
                label: const Text('All'),
                selected: _stateFilter == null,
                onSelected: (_) => _setStateFilter(null),
              ),
              for (final state in const ['running', 'completed', 'failed'])
                ChoiceChip(
                  label: Text(state),
                  selected: _stateFilter == state,
                  onSelected: (_) => _setStateFilter(state),
                ),
            ],
          ),
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

  Future<void> _editOffer([AdminOffer? offer]) async {
    try {
      final skills = await widget.api.skills();
      if (!mounted) return;
      if (skills.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Create a SkillVersion before creating an Offer.')),
        );
        return;
      }
      final draft = await showDialog<_OfferDraft>(
        context: context,
        builder: (context) => _OfferEditorDialog(
          current: offer,
          skills: skills,
        ),
      );
      if (draft == null) return;
      await widget.api.saveOffer(
        current: offer,
        key: draft.key,
        title: draft.title,
        description: draft.description,
        skillVersionId: draft.skillVersionId,
        priceCredits: draft.priceCredits,
        fulfillmentReserveCredits: draft.fulfillmentReserveCredits,
        creatorCommissionCredits: draft.creatorCommissionCredits,
        fallbackCommissionCredits: draft.fallbackCommissionCredits,
        platformMarginCredits: draft.platformMarginCredits,
        regions: draft.regions,
        enabled: draft.enabled,
      );
      if (!mounted) return;
      setState(() => _future = _load());
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(offer == null
              ? 'Offer created.'
              : 'Offer saved as revision ${offer.revision + 1}.'),
        ),
      );
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(error.toString())),
        );
      }
    }
  }

  Future<void> _toggleOffer(AdminOffer offer, bool enabled) async {
    try {
      await widget.api.setOfferEnabled(offer, enabled);
      if (!mounted) return;
      setState(() => _future = _load());
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            enabled ? 'Offer enabled as a new revision.' : 'Offer disabled as a new revision.',
          ),
        ),
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
                    children: [
                      Align(
                        alignment: Alignment.centerRight,
                        child: FilledButton.icon(
                          onPressed: () => _editOffer(),
                          icon: const Icon(Icons.add),
                          label: const Text('New offer'),
                        ),
                      ),
                      const SizedBox(height: 12),
                      if (data.offers.isEmpty)
                        const Card(
                          child: ListTile(title: Text('No Offers configured')),
                        )
                      else
                        ...data.offers.map((offer) => Card(
                          child: ListTile(
                            onTap: () => _editOffer(offer),
                            leading: Icon(Icons.sell_outlined,
                                color: context.masanawa.brand),
                            title: Text(offer.title),
                            subtitle: Text(
                              '${offer.key} · ${offer.priceCredits} credits · '
                              'rev ${offer.revision}\n'
                              'Skill ${shortId(offer.skillVersionId)}'
                              '${offer.regions.isEmpty ? ' · all regions' : ' · ${offer.regions.join(', ')}'}',
                            ),
                            isThreeLine: true,
                            trailing: Switch(
                              value: offer.enabled,
                              onChanged: (value) => _toggleOffer(offer, value),
                            ),
                          ),
                        )),
                    ],
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

class _OfferDraft {
  const _OfferDraft({
    required this.key,
    required this.title,
    required this.description,
    required this.skillVersionId,
    required this.priceCredits,
    required this.fulfillmentReserveCredits,
    required this.creatorCommissionCredits,
    required this.fallbackCommissionCredits,
    required this.platformMarginCredits,
    required this.regions,
    required this.enabled,
  });

  final String key;
  final String title;
  final String description;
  final String skillVersionId;
  final int priceCredits;
  final int fulfillmentReserveCredits;
  final int creatorCommissionCredits;
  final int fallbackCommissionCredits;
  final int platformMarginCredits;
  final List<String> regions;
  final bool enabled;
}

class _OfferEditorDialog extends StatefulWidget {
  const _OfferEditorDialog({
    required this.current,
    required this.skills,
  });

  final AdminOffer? current;
  final List<AdminSkill> skills;

  @override
  State<_OfferEditorDialog> createState() => _OfferEditorDialogState();
}

class _OfferEditorDialogState extends State<_OfferEditorDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _key;
  late final TextEditingController _title;
  late final TextEditingController _description;
  late final TextEditingController _price;
  late final TextEditingController _reserve;
  late final TextEditingController _creator;
  late final TextEditingController _fallback;
  late final TextEditingController _margin;
  late final TextEditingController _regions;
  late String _skillVersionId;
  late bool _enabled;

  @override
  void initState() {
    super.initState();
    final current = widget.current;
    _key = TextEditingController(text: current?.key ?? '');
    _title = TextEditingController(text: current?.title ?? '');
    _description = TextEditingController(text: current?.description ?? '');
    _price = TextEditingController(text: current?.priceCredits.toString() ?? '');
    _reserve = TextEditingController(
      text: current?.fulfillmentReserveCredits.toString() ?? '0',
    );
    _creator = TextEditingController(
      text: current?.creatorCommissionCredits.toString() ?? '0',
    );
    _fallback = TextEditingController(
      text: current?.fallbackCommissionCredits.toString() ?? '0',
    );
    _margin = TextEditingController(
      text: current?.platformMarginCredits.toString() ?? '0',
    );
    _regions = TextEditingController(text: current?.regions.join(', ') ?? '');
    final currentSkillVersionId = current?.skillVersionId;
    _skillVersionId = currentSkillVersionId != null &&
            widget.skills.any(
              (skill) => skill.skillVersionId == currentSkillVersionId,
            )
        ? currentSkillVersionId
        : widget.skills.first.skillVersionId;
    _enabled = current?.enabled ?? true;
  }

  @override
  void dispose() {
    for (final controller in [
      _key,
      _title,
      _description,
      _price,
      _reserve,
      _creator,
      _fallback,
      _margin,
      _regions,
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  int? _credits(TextEditingController controller) =>
      int.tryParse(controller.text.trim());

  String? _required(String? value) =>
      value == null || value.trim().isEmpty ? 'Required' : null;

  String? _offerKey(String? value) {
    final normalized = value?.trim().toLowerCase() ?? '';
    return RegExp(r'^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    final price = _credits(_price)!;
    final reserve = _credits(_reserve)!;
    final creator = _credits(_creator)!;
    final fallback = _credits(_fallback)!;
    final margin = _credits(_margin)!;
    if (price < 1) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Price must be at least 1 credit.')),
      );
      return;
    }
    if (fallback > creator) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Fallback commission cannot exceed creator commission.')),
      );
      return;
    }
    if (reserve + creator + margin != price) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Price must equal reserve + creator commission + platform margin.'),
        ),
      );
      return;
    }
    final regions = _regions.text
        .split(',')
        .map((value) => value.trim().toUpperCase())
        .where((value) => value.isNotEmpty)
        .toSet()
        .toList()
      ..sort();
    Navigator.of(context).pop(
      _OfferDraft(
        key: _key.text.trim(),
        title: _title.text.trim(),
        description: _description.text.trim(),
        skillVersionId: _skillVersionId,
        priceCredits: price,
        fulfillmentReserveCredits: reserve,
        creatorCommissionCredits: creator,
        fallbackCommissionCredits: fallback,
        platformMarginCredits: margin,
        regions: regions,
        enabled: _enabled,
      ),
    );
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: Text(widget.current == null ? 'New Offer' : 'Revise Offer'),
        content: SizedBox(
          width: 560,
          child: Form(
            key: _formKey,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextFormField(
                    controller: _key,
                    enabled: widget.current == null,
                    decoration: const InputDecoration(labelText: 'Key'),
                    validator: _offerKey,
                  ),
                  TextFormField(
                    controller: _title,
                    decoration: const InputDecoration(labelText: 'Title'),
                    validator: _required,
                  ),
                  TextFormField(
                    controller: _description,
                    decoration: const InputDecoration(labelText: 'Description'),
                    minLines: 2,
                    maxLines: 4,
                    validator: _required,
                  ),
                  DropdownButtonFormField<String>(
                    initialValue: _skillVersionId,
                    decoration: const InputDecoration(labelText: 'Skill version'),
                    items: widget.skills
                        .map((skill) => DropdownMenuItem(
                              value: skill.skillVersionId,
                              child: Text('${skill.displayName} · ${skill.version}'),
                            ))
                        .toList(growable: false),
                    onChanged: (value) {
                      if (value != null) {
                        setState(() => _skillVersionId = value);
                      }
                    },
                  ),
                  TextFormField(
                    controller: _price,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Price credits'),
                    validator: _nonNegativeCredits,
                  ),
                  TextFormField(
                    controller: _reserve,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Fulfillment reserve'),
                    validator: _nonNegativeCredits,
                  ),
                  TextFormField(
                    controller: _creator,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Creator commission'),
                    validator: _nonNegativeCredits,
                  ),
                  TextFormField(
                    controller: _fallback,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Fallback commission'),
                    validator: _nonNegativeCredits,
                  ),
                  TextFormField(
                    controller: _margin,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Platform margin'),
                    validator: _nonNegativeCredits,
                  ),
                  TextFormField(
                    controller: _regions,
                    decoration: const InputDecoration(
                      labelText: 'Regions',
                      helperText: 'Comma-separated ISO/market codes; blank means all regions.',
                    ),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Enabled'),
                    value: _enabled,
                    onChanged: (value) => setState(() => _enabled = value),
                  ),
                ],
              ),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: _submit,
            child: const Text('Save revision'),
          ),
        ],
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

  Future<void> _showReceipts(AdminOperation operation) async {
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (context) => FractionallySizedBox(
        heightFactor: 0.78,
        child: SafeArea(
          child: FutureBuilder<List<AdminExternalReceipt>>(
            future: widget.api.operationReceipts(operation.operationId),
            builder: (context, snapshot) {
              if (snapshot.connectionState != ConnectionState.done) {
                return const Center(child: CircularProgressIndicator());
              }
              if (snapshot.hasError) {
                return Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(
                      snapshot.error.toString(),
                      textAlign: TextAlign.center,
                    ),
                  ),
                );
              }
              final receipts = snapshot.data ?? const <AdminExternalReceipt>[];
              return ListView(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                children: [
                  Text(
                    'External receipts',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${operation.kind} · ${shortId(operation.operationId)}',
                    style: TextStyle(color: context.masanawa.textMuted),
                  ),
                  const SizedBox(height: 12),
                  if (receipts.isEmpty)
                    const Card(
                      child: ListTile(
                        title: Text('No external receipts recorded'),
                      ),
                    )
                  else
                    ...receipts.map(
                      (receipt) => Card(
                        child: ListTile(
                          leading: const Icon(Icons.receipt_long_outlined),
                          title: Text(
                            '${receipt.provider} · ${receipt.normalizedStatus}',
                          ),
                          subtitle: Text(
                            '${receipt.verificationMethod}\n'
                            '${receipt.observedAt}'
                            '${receipt.providerVersion == null ? '' : ' · ${receipt.providerVersion}'}',
                          ),
                          isThreeLine: true,
                        ),
                      ),
                    ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }

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
                        onTap: () => _showReceipts(operation),
                        leading: const Icon(Icons.sync_alt_outlined),
                        title: Text(operation.kind),
                        subtitle: Text(
                          '${shortId(operation.operationId)}'
                          '${operation.provider == null ? '' : ' · ${operation.provider}'}'
                          '${operation.terminalErrorCode == null ? '' : '\n${operation.terminalErrorCode}'}',
                        ),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Chip(label: Text(operation.state)),
                            const SizedBox(width: 4),
                            const Icon(Icons.chevron_right),
                          ],
                        ),
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

  Future<void> _revoke(AdminCredentialRef credential) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Revoke provider credential?'),
        content: Text(
          'This disables ${credential.slotKey} for provider '
          '${shortId(credential.providerId)}. Running or future provider '
          'operations may stop using it.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Revoke'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    try {
      final revoked = await widget.api.revokeProviderCredential(credential);
      if (!mounted) return;
      setState(() => _future = widget.api.providerCredentials());
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            revoked
                ? 'Provider credential revoked.'
                : 'Credential was already inactive.',
          ),
        ),
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
              trailing: item.active
                  ? PopupMenuButton<String>(
                      onSelected: (value) {
                        if (value == 'revoke') _revoke(item);
                      },
                      itemBuilder: (_) => const [
                        PopupMenuItem(
                          value: 'revoke',
                          child: Text('Revoke credential'),
                        ),
                      ],
                      child: const Chip(label: Text('active')),
                    )
                  : const Chip(label: Text('inactive')),
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


class SystemAdminPage extends StatefulWidget {
  const SystemAdminPage({super.key, required this.api});
  final AdminApi api;

  @override
  State<SystemAdminPage> createState() => _SystemAdminPageState();
}

class _SystemAdminPageState extends State<SystemAdminPage> {
  late Future<SystemAdminData> _future = _load();

  Future<SystemAdminData> _load() async => SystemAdminData(
        snapshot: await widget.api.systemSnapshot(),
        memoryJobs: await widget.api.memoryJobs(),
        queueIssues: await widget.api.queueIssues(),
        worlds: await widget.api.worlds(),
        approvals: await widget.api.approvals(),
      );

  Future<void> _setWorldRunning(AdminWorld world, bool running) async {
    try {
      if (running) {
        await widget.api.resumeWorld(world);
      } else {
        await widget.api.pauseWorld(world);
      }
      if (!mounted) return;
      setState(() => _future = _load());
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(running ? 'World recovery started.' : 'World paused.'),
        ),
      );
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(error.toString())),
        );
      }
    }
  }


  Future<void> _decideApproval(
    AdminApproval approval,
    String decision,
  ) async {
    try {
      await widget.api.decideApproval(approval, decision);
      if (!mounted) return;
      setState(() => _future = _load());
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            decision == 'approved'
                ? 'Approval granted.'
                : 'Approval denied.',
          ),
        ),
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
  Widget build(BuildContext context) => AdminFuture<SystemAdminData>(
        future: _future,
        retry: () => setState(() => _future = _load()),
        builder: (data) => DefaultTabController(
          length: 3,
          child: Column(
            children: [
              const TabBar(tabs: [
                Tab(text: 'Memory & queues'),
                Tab(text: 'Worlds'),
                Tab(text: 'Approvals'),
              ]),
              Expanded(
                child: TabBarView(children: [
                  ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      Text(
                        'Memory health',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 8),
                      _MapMetrics(values: data.snapshot.memory),
                      const SizedBox(height: 20),
                      Text(
                        'Inbox / outbox',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 8),
                      _MapMetrics(values: data.snapshot.queues),
                      const SizedBox(height: 20),
                      Text(
                        'Memory jobs needing attention',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 8),
                      if (data.memoryJobs.isEmpty)
                        const Card(
                          child: ListTile(title: Text('No active Memory issues')),
                        )
                      else
                        ...data.memoryJobs.map(
                          (job) => Card(
                            child: ListTile(
                              leading: const Icon(Icons.psychology_outlined),
                              title: Text(
                                '${job.extractorKey} · ${job.state}',
                              ),
                              subtitle: Text(
                                '${shortId(job.memoryExtractionId)} · '
                                'attempt ${job.attempt}/${job.maxAttempts}'
                                '${job.safeErrorCode == null ? '' : '\n${job.safeErrorCode}'}',
                              ),
                              isThreeLine: job.safeErrorCode != null,
                            ),
                          ),
                        ),
                      const SizedBox(height: 20),
                      Text(
                        'Queue issues',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 8),
                      if (data.queueIssues.isEmpty)
                        const Card(
                          child: ListTile(title: Text('No inbox/outbox issues')),
                        )
                      else
                        ...data.queueIssues.map(
                          (issue) => Card(
                            child: ListTile(
                              leading: Icon(
                                issue.direction == 'inbox'
                                    ? Icons.move_to_inbox_outlined
                                    : Icons.outbox_outlined,
                              ),
                              title: Text(
                                '${issue.direction} · ${issue.route}',
                              ),
                              subtitle: Text(
                                '${shortId(issue.recordId)} · '
                                'attempt ${issue.attempt}'
                                '${issue.safeErrorCode == null ? '' : '\n${issue.safeErrorCode}'}',
                              ),
                              trailing: Chip(label: Text(issue.state)),
                            ),
                          ),
                        ),
                    ],
                  ),
                  ListView(
                    padding: const EdgeInsets.all(16),
                    children: data.worlds.map((world) => Card(
                      child: ListTile(
                        leading: const Icon(Icons.public_outlined),
                        title: Text(shortId(world.worldId)),
                        subtitle: Text(
                          'generation ${world.currentGenerationNumber} · '
                          'policy rev ${world.policyRevision} · world rev ${world.revision}',
                        ),
                        trailing: world.status == 'stopped'
                            ? const Chip(label: Text('stopped'))
                            : Switch(
                                value: world.status == 'active',
                                onChanged: (value) =>
                                    _setWorldRunning(world, value),
                              ),
                      ),
                    )).toList(growable: false),
                  ),
                  ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      if (data.approvals.isEmpty)
                        const Card(
                          child: ListTile(title: Text('No approval records')),
                        ),
                      ...data.approvals.map((approval) => Card(
                        child: ListTile(
                          leading: Icon(
                            approval.state == 'pending'
                                ? Icons.pending_actions_outlined
                                : Icons.verified_user_outlined,
                          ),
                          title: Text(approval.action),
                          subtitle: Text(
                            '${approval.riskClass} · ${shortId(approval.operationId)}\n'
                            '${approval.resourceKey}',
                          ),
                          isThreeLine: true,
                          trailing: approval.state == 'pending'
                              ? Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    IconButton(
                                      tooltip: 'Deny',
                                      onPressed: () =>
                                          _decideApproval(approval, 'denied'),
                                      icon: const Icon(Icons.close),
                                    ),
                                    IconButton.filledTonal(
                                      tooltip: 'Approve',
                                      onPressed: () =>
                                          _decideApproval(approval, 'approved'),
                                      icon: const Icon(Icons.check),
                                    ),
                                  ],
                                )
                              : Chip(label: Text(approval.state)),
                        ),
                      )),
                      const SizedBox(height: 12),
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Text(
                            'Approvals are decided with the signed-in operator '
                            'Principal. Approving records authority only; the '
                            'exact bound action must still replay through its '
                            'canonical Operation before any side effect occurs.',
                            style: TextStyle(color: context.masanawa.textMuted),
                          ),
                        ),
                      ),
                    ],
                  ),
                ]),
              ),
            ],
          ),
        ),
      );
}

class SystemAdminData {
  const SystemAdminData({
    required this.snapshot,
    required this.memoryJobs,
    required this.queueIssues,
    required this.worlds,
    required this.approvals,
  });

  final AdminSystemSnapshot snapshot;
  final List<AdminMemoryJob> memoryJobs;
  final List<AdminQueueIssue> queueIssues;
  final List<AdminWorld> worlds;
  final List<AdminApproval> approvals;
}

class _MapMetrics extends StatelessWidget {
  const _MapMetrics({required this.values});
  final Map<String, dynamic> values;

  @override
  Widget build(BuildContext context) => Wrap(
        spacing: 10,
        runSpacing: 10,
        children: values.entries.map((entry) => SizedBox(
          width: 170,
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    entry.value.toString(),
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _humanize(entry.key),
                    style: TextStyle(color: context.masanawa.textMuted),
                  ),
                ],
              ),
            ),
          ),
        )).toList(growable: false),
      );
}

String _humanize(String value) => value
    .replaceAllMapped(RegExp(r'([A-Z])'), (match) => ' ${match.group(1)}')
    .replaceAll('_', ' ')
    .trim();


class ModulesAdminPage extends StatelessWidget {
  const ModulesAdminPage({super.key});

  static const _modules = <_ModuleStatus>[
    _ModuleStatus(
      'WhatsApp & Telegram',
      Icons.forum_outlined,
      'WhatsApp control ready',
      'WhatsApp uses the admin-linked Gwani number with live status, QR pairing and relink controls. Telegram remains on its canonical bot transport.',
    ),
    _ModuleStatus(
      'Devices',
      Icons.devices_other_outlined,
      'Integration in progress',
      'Registration, pairing and capability publication are active platform workstreams. Admin controls will bind to those canonical contracts.',
    ),
    _ModuleStatus(
      'Workflows',
      Icons.account_tree_outlined,
      'Integration in progress',
      'Workflow versions, runs, leasing, retries, approvals and recovery are landing through the workflow workstream chain.',
    ),
    _ModuleStatus(
      'Social & Studio',
      Icons.campaign_outlined,
      'Platform contract pending',
      'Social publishing and studio administration remain later production milestones and must not be implemented as ad-hoc mobile-only state.',
    ),
    _ModuleStatus(
      'Plugins',
      Icons.extension_outlined,
      'Platform contract pending',
      'Plugin marketplace/configuration controls will appear here once canonical plugin ownership and authority contracts exist.',
    ),
    _ModuleStatus(
      'Agent Phone',
      Icons.phone_android_outlined,
      'Platform contract pending',
      'OmniSIP, SMS/USSD and device automation controls depend on the Agent Phone and Device Provider milestones.',
    ),
  ];

  @override
  Widget build(BuildContext context) => AdminPageList(
        title: 'Platform modules',
        subtitle:
            'Full-platform administration map. Controls appear only when canonical server contracts exist.',
        children: _modules
            .map(
              (module) => Card(
                child: ListTile(
                  leading: Icon(module.icon, color: context.masanawa.brand),
                  title: Text(module.name),
                  subtitle: Text(module.description),
                  isThreeLine: true,
                  trailing: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 120),
                    child: Text(
                      module.status,
                      textAlign: TextAlign.end,
                      style: TextStyle(color: context.masanawa.textMuted),
                    ),
                  ),
                ),
              ),
            )
            .toList(growable: false),
      );
}

class _ModuleStatus {
  const _ModuleStatus(this.name, this.icon, this.status, this.description);
  final String name;
  final IconData icon;
  final String status;
  final String description;
}

class AdminPageList extends StatelessWidget {
  const AdminPageList({
    super.key,
    required this.title,
    required this.subtitle,
    required this.children,
    this.controls,
  });
  final String title;
  final String subtitle;
  final List<Widget> children;
  final Widget? controls;

  @override
  Widget build(BuildContext context) => ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(title, style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 4),
          Text(subtitle, style: TextStyle(color: context.masanawa.textMuted)),
          if (controls != null) ...[
            const SizedBox(height: 12),
            controls!,
          ],
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
)
            .hasMatch(normalized)
        ? null
        : 'Use lowercase letters/numbers with . _ or - separators';
  }

  String? _nonNegativeCredits(String? value) {
    final parsed = int.tryParse(value?.trim() ?? '');
    return parsed == null || parsed < 0 ? 'Enter zero or more credits' : null;
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    final price = _credits(_price)!;
    final reserve = _credits(_reserve)!;
    final creator = _credits(_creator)!;
    final fallback = _credits(_fallback)!;
    final margin = _credits(_margin)!;
    if (price < 1) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Price must be at least 1 credit.')),
      );
      return;
    }
    if (fallback > creator) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Fallback commission cannot exceed creator commission.')),
      );
      return;
    }
    if (reserve + creator + margin != price) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Price must equal reserve + creator commission + platform margin.'),
        ),
      );
      return;
    }
    final regions = _regions.text
        .split(',')
        .map((value) => value.trim().toUpperCase())
        .where((value) => value.isNotEmpty)
        .toSet()
        .toList()
      ..sort();
    Navigator.of(context).pop(
      _OfferDraft(
        key: _key.text.trim(),
        title: _title.text.trim(),
        description: _description.text.trim(),
        skillVersionId: _skillVersionId,
        priceCredits: price,
        fulfillmentReserveCredits: reserve,
        creatorCommissionCredits: creator,
        fallbackCommissionCredits: fallback,
        platformMarginCredits: margin,
        regions: regions,
        enabled: _enabled,
      ),
    );
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: Text(widget.current == null ? 'New Offer' : 'Revise Offer'),
        content: SizedBox(
          width: 560,
          child: Form(
            key: _formKey,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextFormField(
                    controller: _key,
                    enabled: widget.current == null,
                    decoration: const InputDecoration(labelText: 'Key'),
                    validator: _offerKey,
                  ),
                  TextFormField(
                    controller: _title,
                    decoration: const InputDecoration(labelText: 'Title'),
                    validator: _required,
                  ),
                  TextFormField(
                    controller: _description,
                    decoration: const InputDecoration(labelText: 'Description'),
                    minLines: 2,
                    maxLines: 4,
                    validator: _required,
                  ),
                  DropdownButtonFormField<String>(
                    initialValue: _skillVersionId,
                    decoration: const InputDecoration(labelText: 'Skill version'),
                    items: widget.skills
                        .map((skill) => DropdownMenuItem(
                              value: skill.skillVersionId,
                              child: Text('${skill.displayName} · ${skill.version}'),
                            ))
                        .toList(growable: false),
                    onChanged: (value) {
                      if (value != null) {
                        setState(() => _skillVersionId = value);
                      }
                    },
                  ),
                  TextFormField(
                    controller: _price,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Price credits'),
                    validator: _nonNegativeCredits,
                  ),
                  TextFormField(
                    controller: _reserve,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Fulfillment reserve'),
                    validator: _nonNegativeCredits,
                  ),
                  TextFormField(
                    controller: _creator,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Creator commission'),
                    validator: _nonNegativeCredits,
                  ),
                  TextFormField(
                    controller: _fallback,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Fallback commission'),
                    validator: _nonNegativeCredits,
                  ),
                  TextFormField(
                    controller: _margin,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Platform margin'),
                    validator: _nonNegativeCredits,
                  ),
                  TextFormField(
                    controller: _regions,
                    decoration: const InputDecoration(
                      labelText: 'Regions',
                      helperText: 'Comma-separated ISO/market codes; blank means all regions.',
                    ),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Enabled'),
                    value: _enabled,
                    onChanged: (value) => setState(() => _enabled = value),
                  ),
                ],
              ),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: _submit,
            child: const Text('Save revision'),
          ),
        ],
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

  Future<void> _showReceipts(AdminOperation operation) async {
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (context) => FractionallySizedBox(
        heightFactor: 0.78,
        child: SafeArea(
          child: FutureBuilder<List<AdminExternalReceipt>>(
            future: widget.api.operationReceipts(operation.operationId),
            builder: (context, snapshot) {
              if (snapshot.connectionState != ConnectionState.done) {
                return const Center(child: CircularProgressIndicator());
              }
              if (snapshot.hasError) {
                return Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(
                      snapshot.error.toString(),
                      textAlign: TextAlign.center,
                    ),
                  ),
                );
              }
              final receipts = snapshot.data ?? const <AdminExternalReceipt>[];
              return ListView(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                children: [
                  Text(
                    'External receipts',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${operation.kind} · ${shortId(operation.operationId)}',
                    style: TextStyle(color: context.masanawa.textMuted),
                  ),
                  const SizedBox(height: 12),
                  if (receipts.isEmpty)
                    const Card(
                      child: ListTile(
                        title: Text('No external receipts recorded'),
                      ),
                    )
                  else
                    ...receipts.map(
                      (receipt) => Card(
                        child: ListTile(
                          leading: const Icon(Icons.receipt_long_outlined),
                          title: Text(
                            '${receipt.provider} · ${receipt.normalizedStatus}',
                          ),
                          subtitle: Text(
                            '${receipt.verificationMethod}\n'
                            '${receipt.observedAt}'
                            '${receipt.providerVersion == null ? '' : ' · ${receipt.providerVersion}'}',
                          ),
                          isThreeLine: true,
                        ),
                      ),
                    ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }

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
                        onTap: () => _showReceipts(operation),
                        leading: const Icon(Icons.sync_alt_outlined),
                        title: Text(operation.kind),
                        subtitle: Text(
                          '${shortId(operation.operationId)}'
                          '${operation.provider == null ? '' : ' · ${operation.provider}'}'
                          '${operation.terminalErrorCode == null ? '' : '\n${operation.terminalErrorCode}'}',
                        ),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Chip(label: Text(operation.state)),
                            const SizedBox(width: 4),
                            const Icon(Icons.chevron_right),
                          ],
                        ),
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

  Future<void> _revoke(AdminCredentialRef credential) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Revoke provider credential?'),
        content: Text(
          'This disables ${credential.slotKey} for provider '
          '${shortId(credential.providerId)}. Running or future provider '
          'operations may stop using it.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Revoke'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    try {
      final revoked = await widget.api.revokeProviderCredential(credential);
      if (!mounted) return;
      setState(() => _future = widget.api.providerCredentials());
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            revoked
                ? 'Provider credential revoked.'
                : 'Credential was already inactive.',
          ),
        ),
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
              trailing: item.active
                  ? PopupMenuButton<String>(
                      onSelected: (value) {
                        if (value == 'revoke') _revoke(item);
                      },
                      itemBuilder: (_) => const [
                        PopupMenuItem(
                          value: 'revoke',
                          child: Text('Revoke credential'),
                        ),
                      ],
                      child: const Chip(label: Text('active')),
                    )
                  : const Chip(label: Text('inactive')),
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


class SystemAdminPage extends StatefulWidget {
  const SystemAdminPage({super.key, required this.api});
  final AdminApi api;

  @override
  State<SystemAdminPage> createState() => _SystemAdminPageState();
}

class _SystemAdminPageState extends State<SystemAdminPage> {
  late Future<SystemAdminData> _future = _load();

  Future<SystemAdminData> _load() async => SystemAdminData(
        snapshot: await widget.api.systemSnapshot(),
        memoryJobs: await widget.api.memoryJobs(),
        queueIssues: await widget.api.queueIssues(),
        worlds: await widget.api.worlds(),
        approvals: await widget.api.approvals(),
      );

  Future<void> _setWorldRunning(AdminWorld world, bool running) async {
    try {
      if (running) {
        await widget.api.resumeWorld(world);
      } else {
        await widget.api.pauseWorld(world);
      }
      if (!mounted) return;
      setState(() => _future = _load());
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(running ? 'World recovery started.' : 'World paused.'),
        ),
      );
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(error.toString())),
        );
      }
    }
  }


  Future<void> _decideApproval(
    AdminApproval approval,
    String decision,
  ) async {
    try {
      await widget.api.decideApproval(approval, decision);
      if (!mounted) return;
      setState(() => _future = _load());
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            decision == 'approved'
                ? 'Approval granted.'
                : 'Approval denied.',
          ),
        ),
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
  Widget build(BuildContext context) => AdminFuture<SystemAdminData>(
        future: _future,
        retry: () => setState(() => _future = _load()),
        builder: (data) => DefaultTabController(
          length: 3,
          child: Column(
            children: [
              const TabBar(tabs: [
                Tab(text: 'Memory & queues'),
                Tab(text: 'Worlds'),
                Tab(text: 'Approvals'),
              ]),
              Expanded(
                child: TabBarView(children: [
                  ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      Text(
                        'Memory health',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 8),
                      _MapMetrics(values: data.snapshot.memory),
                      const SizedBox(height: 20),
                      Text(
                        'Inbox / outbox',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 8),
                      _MapMetrics(values: data.snapshot.queues),
                      const SizedBox(height: 20),
                      Text(
                        'Memory jobs needing attention',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 8),
                      if (data.memoryJobs.isEmpty)
                        const Card(
                          child: ListTile(title: Text('No active Memory issues')),
                        )
                      else
                        ...data.memoryJobs.map(
                          (job) => Card(
                            child: ListTile(
                              leading: const Icon(Icons.psychology_outlined),
                              title: Text(
                                '${job.extractorKey} · ${job.state}',
                              ),
                              subtitle: Text(
                                '${shortId(job.memoryExtractionId)} · '
                                'attempt ${job.attempt}/${job.maxAttempts}'
                                '${job.safeErrorCode == null ? '' : '\n${job.safeErrorCode}'}',
                              ),
                              isThreeLine: job.safeErrorCode != null,
                            ),
                          ),
                        ),
                      const SizedBox(height: 20),
                      Text(
                        'Queue issues',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 8),
                      if (data.queueIssues.isEmpty)
                        const Card(
                          child: ListTile(title: Text('No inbox/outbox issues')),
                        )
                      else
                        ...data.queueIssues.map(
                          (issue) => Card(
                            child: ListTile(
                              leading: Icon(
                                issue.direction == 'inbox'
                                    ? Icons.move_to_inbox_outlined
                                    : Icons.outbox_outlined,
                              ),
                              title: Text(
                                '${issue.direction} · ${issue.route}',
                              ),
                              subtitle: Text(
                                '${shortId(issue.recordId)} · '
                                'attempt ${issue.attempt}'
                                '${issue.safeErrorCode == null ? '' : '\n${issue.safeErrorCode}'}',
                              ),
                              trailing: Chip(label: Text(issue.state)),
                            ),
                          ),
                        ),
                    ],
                  ),
                  ListView(
                    padding: const EdgeInsets.all(16),
                    children: data.worlds.map((world) => Card(
                      child: ListTile(
                        leading: const Icon(Icons.public_outlined),
                        title: Text(shortId(world.worldId)),
                        subtitle: Text(
                          'generation ${world.currentGenerationNumber} · '
                          'policy rev ${world.policyRevision} · world rev ${world.revision}',
                        ),
                        trailing: world.status == 'stopped'
                            ? const Chip(label: Text('stopped'))
                            : Switch(
                                value: world.status == 'active',
                                onChanged: (value) =>
                                    _setWorldRunning(world, value),
                              ),
                      ),
                    )).toList(growable: false),
                  ),
                  ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      if (data.approvals.isEmpty)
                        const Card(
                          child: ListTile(title: Text('No approval records')),
                        ),
                      ...data.approvals.map((approval) => Card(
                        child: ListTile(
                          leading: Icon(
                            approval.state == 'pending'
                                ? Icons.pending_actions_outlined
                                : Icons.verified_user_outlined,
                          ),
                          title: Text(approval.action),
                          subtitle: Text(
                            '${approval.riskClass} · ${shortId(approval.operationId)}\n'
                            '${approval.resourceKey}',
                          ),
                          isThreeLine: true,
                          trailing: approval.state == 'pending'
                              ? Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    IconButton(
                                      tooltip: 'Deny',
                                      onPressed: () =>
                                          _decideApproval(approval, 'denied'),
                                      icon: const Icon(Icons.close),
                                    ),
                                    IconButton.filledTonal(
                                      tooltip: 'Approve',
                                      onPressed: () =>
                                          _decideApproval(approval, 'approved'),
                                      icon: const Icon(Icons.check),
                                    ),
                                  ],
                                )
                              : Chip(label: Text(approval.state)),
                        ),
                      )),
                      const SizedBox(height: 12),
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Text(
                            'Approvals are decided with the signed-in operator '
                            'Principal. Approving records authority only; the '
                            'exact bound action must still replay through its '
                            'canonical Operation before any side effect occurs.',
                            style: TextStyle(color: context.masanawa.textMuted),
                          ),
                        ),
                      ),
                    ],
                  ),
                ]),
              ),
            ],
          ),
        ),
      );
}

class SystemAdminData {
  const SystemAdminData({
    required this.snapshot,
    required this.memoryJobs,
    required this.queueIssues,
    required this.worlds,
    required this.approvals,
  });

  final AdminSystemSnapshot snapshot;
  final List<AdminMemoryJob> memoryJobs;
  final List<AdminQueueIssue> queueIssues;
  final List<AdminWorld> worlds;
  final List<AdminApproval> approvals;
}

class _MapMetrics extends StatelessWidget {
  const _MapMetrics({required this.values});
  final Map<String, dynamic> values;

  @override
  Widget build(BuildContext context) => Wrap(
        spacing: 10,
        runSpacing: 10,
        children: values.entries.map((entry) => SizedBox(
          width: 170,
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    entry.value.toString(),
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _humanize(entry.key),
                    style: TextStyle(color: context.masanawa.textMuted),
                  ),
                ],
              ),
            ),
          ),
        )).toList(growable: false),
      );
}

String _humanize(String value) => value
    .replaceAllMapped(RegExp(r'([A-Z])'), (match) => ' ${match.group(1)}')
    .replaceAll('_', ' ')
    .trim();


class ModulesAdminPage extends StatelessWidget {
  const ModulesAdminPage({super.key});

  static const _modules = <_ModuleStatus>[
    _ModuleStatus(
      'WhatsApp & Telegram',
      Icons.forum_outlined,
      'WhatsApp control ready',
      'WhatsApp uses the admin-linked Gwani number with live status, QR pairing and relink controls. Telegram remains on its canonical bot transport.',
    ),
    _ModuleStatus(
      'Devices',
      Icons.devices_other_outlined,
      'Integration in progress',
      'Registration, pairing and capability publication are active platform workstreams. Admin controls will bind to those canonical contracts.',
    ),
    _ModuleStatus(
      'Workflows',
      Icons.account_tree_outlined,
      'Integration in progress',
      'Workflow versions, runs, leasing, retries, approvals and recovery are landing through the workflow workstream chain.',
    ),
    _ModuleStatus(
      'Social & Studio',
      Icons.campaign_outlined,
      'Platform contract pending',
      'Social publishing and studio administration remain later production milestones and must not be implemented as ad-hoc mobile-only state.',
    ),
    _ModuleStatus(
      'Plugins',
      Icons.extension_outlined,
      'Platform contract pending',
      'Plugin marketplace/configuration controls will appear here once canonical plugin ownership and authority contracts exist.',
    ),
    _ModuleStatus(
      'Agent Phone',
      Icons.phone_android_outlined,
      'Platform contract pending',
      'OmniSIP, SMS/USSD and device automation controls depend on the Agent Phone and Device Provider milestones.',
    ),
  ];

  @override
  Widget build(BuildContext context) => AdminPageList(
        title: 'Platform modules',
        subtitle:
            'Full-platform administration map. Controls appear only when canonical server contracts exist.',
        children: _modules
            .map(
              (module) => Card(
                child: ListTile(
                  leading: Icon(module.icon, color: context.masanawa.brand),
                  title: Text(module.name),
                  subtitle: Text(module.description),
                  isThreeLine: true,
                  trailing: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 120),
                    child: Text(
                      module.status,
                      textAlign: TextAlign.end,
                      style: TextStyle(color: context.masanawa.textMuted),
                    ),
                  ),
                ),
              ),
            )
            .toList(growable: false),
      );
}

class _ModuleStatus {
  const _ModuleStatus(this.name, this.icon, this.status, this.description);
  final String name;
  final IconData icon;
  final String status;
  final String description;
}

class AdminPageList extends StatelessWidget {
  const AdminPageList({
    super.key,
    required this.title,
    required this.subtitle,
    required this.children,
    this.controls,
  });
  final String title;
  final String subtitle;
  final List<Widget> children;
  final Widget? controls;

  @override
  Widget build(BuildContext context) => ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(title, style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 4),
          Text(subtitle, style: TextStyle(color: context.masanawa.textMuted)),
          if (controls != null) ...[
            const SizedBox(height: 12),
            controls!,
          ],
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
