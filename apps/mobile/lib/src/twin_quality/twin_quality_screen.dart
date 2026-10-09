import 'package:flutter/material.dart';
import 'twin_quality.dart';

/// F12 mounts this inside My Twin / Agents, not the root five-tab router.
/// An accountEpoch change must accompany every account/session switch.
class TwinQualityOwnerDashboard extends StatefulWidget {
  const TwinQualityOwnerDashboard({
    super.key, required this.transport, required this.accountEpoch,
    this.onOpenSupport,
  });
  final TwinQualityTransport transport;
  final String accountEpoch;
  final VoidCallback? onOpenSupport;
  @override
  State<TwinQualityOwnerDashboard> createState() => _TwinQualityOwnerDashboardState();
}
class _TwinQualityOwnerDashboardState extends State<TwinQualityOwnerDashboard> {
  TwinQualityReport? report;
  bool loading = true;
  String? error;
  int generation = 0;
  @override
  void initState() { super.initState(); _load(); }
  @override
  void didUpdateWidget(covariant TwinQualityOwnerDashboard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.accountEpoch != widget.accountEpoch ||
        !identical(oldWidget.transport,widget.transport)) {
      generation++;
      report = null;
      error = null;
      loading = true;
      _load();
    }
  }
  Future<void> _load() async {
    final token = ++generation;
    if (mounted) setState(() { loading = true; error = null; report = null; });
    try {
      final fresh = await widget.transport.load();
      if (!mounted || generation != token) return;
      setState(() { report = fresh; loading = false; });
    } catch (_) {
      if (!mounted || generation != token) return;
      setState(() { error = 'Could not verify Twin activity and earnings.'; loading = false; });
    }
  }
  @override
  void dispose() { generation++; super.dispose(); }
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    if (loading) return const Center(child:CircularProgressIndicator());
    if (error != null) return Center(child:Column(
      mainAxisSize:MainAxisSize.min,
      children:[
        Text(error!),
        const SizedBox(height:8),
        OutlinedButton(onPressed:_load,child:const Text('Retry')),
      ],
    ));
    final data = report!;
    if (!data.hasTwin) return const Center(child:Text('Create a Twin to review its activity and earnings.'));
    return RefreshIndicator(
      onRefresh:_load,
      child:ListView(
        physics:const AlwaysScrollableScrollPhysics(),
        padding:const EdgeInsets.all(16),
        children:[
          Text('Twin quality and earnings',style:theme.textTheme.titleLarge),
          const SizedBox(height:6),
          const Text('Amounts come from your account ledger, not activity estimates.'),
          const SizedBox(height:16),
          _metric('Available earnings',data.availableCredits,
            'Settled Credits; payout requires separate eligibility and confirmation.'),
          _metric('Pending earnings',data.pendingCredits,
            'Not withdrawable until settled.'),
          _metric('Agent Float',data.floatCredits,
            'Execution capital; not withdrawable earnings.'),
          if (data.floatExhausted) const ListTile(
            leading:Icon(Icons.warning_amber_outlined),
            title:Text('Twin has no Agent Float'),
            subtitle:Text('Paid tasks may be unavailable. Do not assume rerouting succeeded.'),
          ),
          const Divider(),
          Text('Recent activity sample',style:theme.textTheme.titleMedium),
          Text('${data.sampledEvents} events shown (limit ${data.sampledLimit}); not an all-time success rate.'),
          Text('${data.completed} completed · ${data.unsuccessful} failed, refunded or expired'),
          for (final activity in data.recent) ListTile(
            dense:true,
            title:Text('${activity.kind} · ${activity.status}'),
            subtitle:Text(activity.occurredAt.toLocal().toString()),
          ),
          if (data.recent.isEmpty) const Text('No recent activity recorded.'),
          const Divider(),
          const Text('Task quotas and provider costs are unverified, not zero.'),
          const Text('A gift, purchase or voice event is not proof of commission or payout.'),
          if (widget.onOpenSupport != null) OutlinedButton.icon(
            onPressed:widget.onOpenSupport,
            icon:const Icon(Icons.support_agent_outlined),
            label:const Text('Get help with activity or earnings'),
          ),
        ],
      ),
    );
  }
  Widget _metric(String title,int amount,String detail) => Card(
    child:ListTile(title:Text(title),trailing:Text('$amount Credits'),subtitle:Text(detail)),
  );
}
