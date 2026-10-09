import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../state/session_state.dart';
import 'human_contacts_controller.dart';
import 'human_contacts_transport.dart';

/// C01's human-contact management surface. The R17/C08 shell owner installs
/// this at the final /messages contact-discovery entry; it is not an AI chat.
class HumanContactsScreen extends ConsumerStatefulWidget {
  const HumanContactsScreen({super.key});

  @override
  ConsumerState<HumanContactsScreen> createState() =>
      _HumanContactsScreenState();
}

class _HumanContactsScreenState extends ConsumerState<HumanContactsScreen> {
  final _search = TextEditingController();

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    if (session is! SessionSignedIn) {
      return Scaffold(
        appBar: AppBar(title: const Text('Human contacts')),
        body: const Center(child: Text('Sign in to manage private contacts.')),
      );
    }
    final value = ref.watch(humanContactsProvider);
    final actions = ref.read(humanContactsProvider.notifier);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Human contacts'),
        actions: [
          IconButton(
            tooltip: 'Refresh contacts',
            onPressed: value.loading || value.busy ? null : actions.refresh,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: actions.refresh,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const Text(
              'Find a person by their exact @handle. '
              'A contact request never starts a public Talk or authorizes a payment.',
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _search,
                    autocorrect: false,
                    textCapitalization: TextCapitalization.none,
                    textInputAction: TextInputAction.search,
                    decoration: const InputDecoration(
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.alternate_email),
                      labelText: 'Person’s @handle',
                    ),
                    onSubmitted: value.searching || value.busy
                        ? null
                        : actions.findByHandle,
                  ),
                ),
                const SizedBox(width: 8),
                FilledButton(
                  onPressed: value.searching || value.busy
                      ? null
                      : () => actions.findByHandle(_search.text),
                  child: const Text('Find'),
                ),
              ],
            ),
            if (value.searching) ...[
              const SizedBox(height: 8),
              const LinearProgressIndicator(),
            ],
            if (value.error != null) ...[
              const SizedBox(height: 12),
              _MessageBanner(
                text: value.error!,
                icon: Icons.error_outline,
                onRetry: value.loading ? actions.refresh : null,
              ),
            ],
            if (value.notice != null) ...[
              const SizedBox(height: 12),
              _MessageBanner(text: value.notice!, icon: Icons.info_outline),
            ],
            if (value.lookup != null) ...[
              const SizedBox(height: 12),
              _ContactTile(
                contact: value.lookup!,
                busy: value.busy,
                foundBySearch: true,
                onRequest: () => actions.request(value.lookup!.handle),
                onRespond: (accept) =>
                    actions.respond(value.lookup!.userId, accept: accept,
                      requestRevision: value.lookup!.requestRevision!),
                onRevoke: () => _confirmRevoke(
                  context, value.lookup!, actions,
                ),
              ),
            ],
            const SizedBox(height: 24),
            Text(
              'Your privacy',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            if (value.preferences case final preferences?) ...[
              const SizedBox(height: 6),
              DropdownButtonFormField<HumanContactPolicy>(
                key: ValueKey(preferences.policy),
                initialValue: preferences.policy,
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  labelText: 'Who can contact you',
                ),
                items: const [
                  DropdownMenuItem(
                    value: HumanContactPolicy.requests,
                    child: Text('People ask for permission'),
                  ),
                  DropdownMenuItem(
                    value: HumanContactPolicy.anyone,
                    child: Text('Anyone who finds my handle'),
                  ),
                  DropdownMenuItem(
                    value: HumanContactPolicy.nobody,
                    child: Text('No new contact requests'),
                  ),
                ],
                onChanged: value.busy
                    ? null
                    : (policy) {
                        if (policy != null) actions.updatePolicy(policy);
                      },
              ),
              SwitchListTile.adaptive(
                contentPadding: EdgeInsets.zero,
                title: const Text('Find me by my @handle'),
                subtitle: const Text(
                  'Turn off to hide your account from new exact-handle lookups.',
                ),
                value: preferences.discoverableByHandle,
                onChanged: value.busy ? null : actions.updateDiscoverable,
              ),
            ] else if (value.loading) ...[
              const Padding(
                padding: EdgeInsets.all(16),
                child: Center(child: CircularProgressIndicator()),
              ),
            ],
            const SizedBox(height: 16),
            Text(
              'Contact requests and connections',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 4),
            const Text(
              'Requests must be accepted before private messaging '
              'when the recipient requires permission.',
            ),
            if (value.loading) ...[
              const Padding(
                padding: EdgeInsets.all(16),
                child: Center(child: CircularProgressIndicator()),
              ),
            ] else if (value.contacts.isEmpty) ...[
              const ListTile(
                leading: Icon(Icons.people_outline),
                title: Text('No contact requests yet'),
              ),
            ] else ...[
              for (final contact in value.contacts)
                _ContactTile(
                  key: ValueKey(contact.userId),
                  contact: contact,
                  busy: value.busy,
                  onRequest: () => actions.request(contact.handle),
                  onRespond: (accept) =>
                      actions.respond(contact.userId, accept: accept,
                          requestRevision: contact.requestRevision!),
                  onRevoke: () => _confirmRevoke(
                    context, contact, actions,
                  ),
                ),
            ],
            if (value.busy) const LinearProgressIndicator(),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  Future<void> _confirmRevoke(
    BuildContext context,
    HumanContact person,
    HumanContactsController actions,
  ) async {
    final approved = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Remove contact?'),
        content: Text(
          'Revoke contact permission for @${person.handle}? '
          'This does not delete past messages.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Keep'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Remove'),
          ),
        ],
      ),
    );
    if (approved == true && mounted) {
      await actions.revoke(person.userId);
    }
  }
}

class _MessageBanner extends StatelessWidget {
  const _MessageBanner({required this.text, required this.icon, this.onRetry});
  final String text;
  final IconData icon;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) => Card(
    child: ListTile(
      leading: Icon(icon),
      title: Text(text),
      trailing: onRetry == null
          ? null
          : TextButton(onPressed: onRetry, child: const Text('Retry')),
    ),
  );
}

class _ContactTile extends StatelessWidget {
  const _ContactTile({
    super.key,
    required this.contact,
    required this.busy,
    required this.onRequest,
    required this.onRespond,
    required this.onRevoke,
    this.foundBySearch = false,
  });

  final HumanContact contact;
  final bool busy;
  final bool foundBySearch;
  final VoidCallback onRequest;
  final void Function(bool accept) onRespond;
  final VoidCallback onRevoke;

  @override
  Widget build(BuildContext context) {
    final status = contact.status;
    final statusLabel = switch (status) {
      HumanContactStatus.accepted => 'Connected',
      HumanContactStatus.incoming => 'Wants to connect',
      HumanContactStatus.outgoing => 'Waiting for approval',
      HumanContactStatus.declined => 'Request unavailable',
      HumanContactStatus.revoked => 'You removed this connection',
      HumanContactStatus.none => 'Not connected',
    };
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        child: Column(
          children: [
            ListTile(
              leading: CircleAvatar(
                child: Text(contact.displayName.substring(0, 1).toUpperCase()),
              ),
              title: Text(contact.displayName),
              subtitle: Text('@${contact.handle} · $statusLabel'),
            ),
            if (status == HumanContactStatus.incoming)
              Wrap(
                spacing: 8,
                children: [
                  OutlinedButton(
                    onPressed: busy || contact.requestRevision == null ? null : () => onRespond(false),
                    child: const Text('Decline'),
                  ),
                  FilledButton(
                    onPressed: busy || contact.requestRevision == null ? null : () => onRespond(true),
                    child: const Text('Accept'),
                  ),
                ],
              )
            else if ((status == HumanContactStatus.none && foundBySearch) ||
                status == HumanContactStatus.revoked)
              Align(
                alignment: Alignment.centerRight,
                child: FilledButton(
                  onPressed: busy ? null : onRequest,
                  child: Text(status == HumanContactStatus.revoked
                    ? 'Request reconnect' : 'Request contact'),
                ),
              )
            else if (status == HumanContactStatus.accepted ||
                status == HumanContactStatus.outgoing)
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: busy ? null : onRevoke,
                  child: Text(status == HumanContactStatus.outgoing
                      ? 'Withdraw request'
                      : 'Remove contact'),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

