import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../state/session_state.dart';
import 'human_contacts_controller.dart';
import 'human_contacts_transport.dart';

/// U24: C01 relationship state, not a new policy engine or a C02 send grant.
class HumanRequestPrivacyScreen extends ConsumerStatefulWidget {
  const HumanRequestPrivacyScreen({super.key});
  @override
  ConsumerState<HumanRequestPrivacyScreen> createState() => _HumanRequestPrivacyScreenState();
}

class _HumanRequestPrivacyScreenState extends ConsumerState<HumanRequestPrivacyScreen> {
  String? _currentOwnerId() {
    final session = ref.read(sessionProvider);
    return session is SessionSignedIn ? session.user.id : null;
  }

  bool _stillCurrent(
    HumanContact target, HumanContactStatus expected, String ownerId,
  ) {
    if (_currentOwnerId() != ownerId) return false;
    final state = ref.read(humanContactsProvider);
    return !state.busy && !state.loading && state.contacts.any((person) =>
      person.userId == target.userId &&
      person.status == expected &&
      person.requestRevision == target.requestRevision);
  }

  Future<bool> _confirm(String title, String explanation, String verb) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(title),
        content: Text(explanation),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Keep'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: Text(verb),
          ),
        ],
      ),
    );
    return result == true && mounted;
  }

  Future<void> _respond(HumanContact person, bool accept) async {
    final ownerId = _currentOwnerId();
    if (ownerId == null || person.requestRevision == null ||
        !_stillCurrent(person, HumanContactStatus.incoming, ownerId)) {
      await ref.read(humanContactsProvider.notifier).refresh();
      return;
    }
    if (!accept && !await _confirm(
      'Decline request?',
      'Decline the contact request from @' + person.handle + '?',
      'Decline',
    )) return;
    if (!mounted || !_stillCurrent(person, HumanContactStatus.incoming, ownerId)) return;
    await ref.read(humanContactsProvider.notifier).respond(
      person.userId, accept: accept, requestRevision: person.requestRevision!,
    );
  }

  Future<void> _withdraw(HumanContact person) async {
    final ownerId = _currentOwnerId();
    if (ownerId == null ||
        !_stillCurrent(person, HumanContactStatus.outgoing, ownerId)) {
      await ref.read(humanContactsProvider.notifier).refresh();
      return;
    }
    if (!await _confirm(
      'Withdraw request?',
      'Withdraw your pending request to @' + person.handle +
        '? Previously delivered messages will not be erased.',
      'Withdraw',
    )) return;
    if (!mounted || !_stillCurrent(person, HumanContactStatus.outgoing, ownerId)) return;
    await ref.read(humanContactsProvider.notifier).revoke(person.userId);
  }

  @override
  Widget build(BuildContext context) {
    if (ref.watch(sessionProvider) is! SessionSignedIn) {
      return Scaffold(
        appBar: AppBar(title: const Text('Requests and privacy')),
        body: const Center(child: Text('Sign in to manage your contact requests.')),
      );
    }
    final state = ref.watch(humanContactsProvider);
    final actions = ref.read(humanContactsProvider.notifier);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Requests and privacy'),
        actions: [
          IconButton(
            tooltip: 'Refresh requests',
            icon: const Icon(Icons.refresh),
            onPressed: state.busy || state.loading ? null : actions.refresh,
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: actions.refresh,
        child: HumanRequestPrivacyContent(
          value: state,
          onRefresh: actions.refresh,
          onRespond: _respond,
          onWithdraw: _withdraw,
          onPolicy: actions.updatePolicy,
          onDiscoverable: actions.updateDiscoverable,
        ),
      ),
    );
  }
}

/// Stateless and testable: only authoritative C01 readbacks are rendered.
class HumanRequestPrivacyContent extends StatelessWidget {
  const HumanRequestPrivacyContent({
    super.key,
    required this.value,
    required this.onRefresh,
    required this.onRespond,
    required this.onWithdraw,
    required this.onPolicy,
    required this.onDiscoverable,
  });
  final HumanContactsViewState value;
  final VoidCallback onRefresh;
  final Future<void> Function(HumanContact, bool) onRespond;
  final Future<void> Function(HumanContact) onWithdraw;
  final Future<void> Function(HumanContactPolicy) onPolicy;
  final Future<void> Function(bool) onDiscoverable;

  @override
  Widget build(BuildContext context) {
    final incoming = value.contacts.where(
      (person) => person.status == HumanContactStatus.incoming).toList(growable: false);
    final outgoing = value.contacts.where(
      (person) => person.status == HumanContactStatus.outgoing).toList(growable: false);
    final locked = value.loading || value.busy;
    return ListView(
      key: const ValueKey('u24-request-privacy-list'),
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      children: [
        const Text('Manage private human contact requests here. Accepting does not '
            'authorize Wallet payments, Assistant access or phonebook sharing.'),
        const SizedBox(height: 16),
        Text('Contact privacy', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 10),
        if (value.preferences case final preferences?) ...[
          DropdownButtonFormField<HumanContactPolicy>(
            key: ValueKey('u24-policy-' + preferences.policy.name),
            initialValue: preferences.policy,
            decoration: const InputDecoration(
              border: OutlineInputBorder(),
              labelText: 'Who can contact me',
            ),
            items: const [
              DropdownMenuItem(value: HumanContactPolicy.requests,
                  child: Text('Ask before messaging')),
              DropdownMenuItem(value: HumanContactPolicy.anyone,
                  child: Text('Allow people who find me')),
              DropdownMenuItem(value: HumanContactPolicy.nobody,
                  child: Text('No new contact requests')),
            ],
            onChanged: locked ? null : (policy) {
              if (policy != null) onPolicy(policy);
            },
          ),
          SwitchListTile.adaptive(
            key: const ValueKey('u24-handle-visibility'),
            contentPadding: EdgeInsets.zero,
            title: const Text('Findable by exact @handle'),
            subtitle: const Text('Existing connections and requests have '
                'separate permissions. Turning this off does not erase them.'),
            value: preferences.discoverableByHandle,
            onChanged: locked ? null : onDiscoverable,
          ),
        ] else if (!value.loading)
          const Text('Privacy settings unavailable. Refresh to retry.'),
        if (value.loading) const Center(child: CircularProgressIndicator()),
        if (value.busy) const LinearProgressIndicator(),
        if (value.error case final error?)
          Card(child: ListTile(
            title: Text(error),
            trailing: TextButton(
              onPressed: locked ? null : onRefresh,
              child: const Text('Retry'),
            ),
          )),
        if (value.notice case final notice?)
          Semantics(liveRegion: true,
            child: Card(child: ListTile(title: Text(notice)))),
        const SizedBox(height: 16),
        _RequestSection(
          title: 'Received requests',
          emptyText: 'No received requests in this page',
          contacts: incoming,
          busy: locked,
          onRespond: onRespond,
          onWithdraw: onWithdraw,
        ),
        const SizedBox(height: 16),
        _RequestSection(
          title: 'Sent requests',
          emptyText: 'No sent requests in this page',
          contacts: outgoing,
          busy: locked,
          onRespond: onRespond,
          onWithdraw: onWithdraw,
        ),
        const SizedBox(height: 16),
        const Text('Showing the current server page (at most 50 contacts). '
            'These counts are not full inbox totals. C02 rechecks permission '
            'when sending; a revoked or blocked contact cannot be granted '
            'messaging access by this screen.'),
        const SizedBox(height: 12),
        const Text('Removing a request is not blocking or reporting abuse. '
            'Use the separately authorized person safety controls for those actions.'),
      ],
    );
  }
}

class _RequestSection extends StatelessWidget {
  const _RequestSection({
    required this.title, required this.emptyText, required this.contacts,
    required this.busy, required this.onRespond, required this.onWithdraw,
  });
  final String title;
  final String emptyText;
  final List<HumanContact> contacts;
  final bool busy;
  final Future<void> Function(HumanContact, bool) onRespond;
  final Future<void> Function(HumanContact) onWithdraw;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Text(title + ' (' + contacts.length.toString() + ' on this page)',
          style: Theme.of(context).textTheme.titleMedium),
      if (contacts.isEmpty)
        ListTile(leading: const Icon(Icons.inbox_outlined), title: Text(emptyText)),
      for (final person in contacts)
        Card(
          key: ValueKey('u24-' + person.status.name + '-' + person.userId),
          child: Column(children: [
            ListTile(
              leading: CircleAvatar(
                child: Text(person.displayName.isEmpty
                    ? '?' : person.displayName.substring(0, 1).toUpperCase()),
              ),
              title: Text(person.displayName,
                  maxLines: 1, overflow: TextOverflow.ellipsis),
              subtitle: Text('@' + person.handle,
                  maxLines: 1, overflow: TextOverflow.ellipsis),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
              child: Align(
                alignment: Alignment.centerRight,
                child: person.status == HumanContactStatus.incoming
                    ? Wrap(spacing: 8, children: [
                        OutlinedButton(
                          key: ValueKey('u24-decline-' + person.userId),
                          onPressed: busy || person.requestRevision == null
                              ? null : () => onRespond(person, false),
                          child: const Text('Decline'),
                        ),
                        FilledButton(
                          key: ValueKey('u24-accept-' + person.userId),
                          onPressed: busy || person.requestRevision == null
                              ? null : () => onRespond(person, true),
                          child: const Text('Accept'),
                        ),
                      ])
                    : OutlinedButton(
                        key: ValueKey('u24-withdraw-' + person.userId),
                        onPressed: busy ? null : () => onWithdraw(person),
                        child: const Text('Withdraw'),
                      ),
              ),
            ),
          ]),
        ),
    ],
  );
}
