import 'package:flutter/material.dart';

import 'public_discovery_controller.dart';
import 'public_discovery_models.dart';
import 'public_discovery_transport.dart';

/// Nested public search, not a sixth tab. F12 mounts this using the authenticated
/// session and a typed router callback. Opening a result does not accept a
/// contact request, join a Talk Seat, send a DM or authorize payment.
class PublicDiscoveryScreen extends StatefulWidget {
  const PublicDiscoveryScreen({
    super.key,
    required this.transport,
    required this.ownerId,
    required this.isCurrentOwner,
    required this.openRoute,
  });

  final PublicDiscoveryTransport transport;
  final String ownerId;
  final bool Function(String ownerId) isCurrentOwner;
  final ValueChanged<String> openRoute;

  @override
  State<PublicDiscoveryScreen> createState() => _PublicDiscoveryScreenState();
}

class _PublicDiscoveryScreenState extends State<PublicDiscoveryScreen> {
  final _query = TextEditingController();
  late PublicDiscoveryController _controller;

  @override
  void initState() {
    super.initState();
    _newController();
  }

  void _newController() {
    _controller = PublicDiscoveryController(
      transport: widget.transport,
      ownerId: widget.ownerId,
      isCurrentOwner: widget.isCurrentOwner,
    )..addListener(_changed);
  }

  void _changed() {
    if (mounted) setState(() {});
  }

  @override
  void didUpdateWidget(covariant PublicDiscoveryScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.ownerId != widget.ownerId ||
        !identical(oldWidget.transport, widget.transport)) {
      _controller.removeListener(_changed);
      _controller.dispose();
      _query.clear();
      _newController();
    }
  }

  @override
  void dispose() {
    _controller.removeListener(_changed);
    _controller.dispose();
    _query.dispose();
    super.dispose();
  }

  void _search() => _controller.search(_query.text);

  @override
  Widget build(BuildContext context) {
    final controller = _controller;
    return Scaffold(
      appBar: AppBar(title: const Text('Discover Masanawa')),
      body: !controller.authorized
          ? const Center(child: Text('Sign in to discover public Talks and people.'))
          : Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
                  child: TextField(
                    controller: _query,
                    textInputAction: TextInputAction.search,
                    maxLength: 120,
                    autocorrect: false,
                    decoration: InputDecoration(
                      labelText: 'Search public Talks, people and agents',
                      hintText: 'Name, topic or exact handle',
                      prefixIcon: const Icon(Icons.search),
                      suffixIcon: IconButton(
                        tooltip: 'Search',
                        onPressed: controller.loading ? null : _search,
                        icon: const Icon(Icons.arrow_forward),
                      ),
                      border: const OutlineInputBorder(),
                    ),
                    onSubmitted: (_) => _search(),
                  ),
                ),
                SizedBox(
                  height: 52,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    children: [
                      for (final filter in PublicDiscoveryFilter.values)
                        Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: ChoiceChip(
                            label: Text(switch (filter) {
                              PublicDiscoveryFilter.all => 'All',
                              PublicDiscoveryFilter.talks => 'Talks',
                              PublicDiscoveryFilter.people => 'People',
                              PublicDiscoveryFilter.experts => 'Experts',
                              PublicDiscoveryFilter.twins => 'Twins',
                            }),
                            selected: controller.filter == filter,
                            onSelected: (selected) {
                              if (selected && !controller.loading) {
                                controller.search(_query.text, newFilter: filter);
                              }
                            },
                          ),
                        ),
                    ],
                  ),
                ),
                SwitchListTile.adaptive(
                  dense: true,
                  title: const Text('Live now only'),
                  subtitle: const Text('Show live public Talks and active human hosts'),
                  value: controller.liveOnly,
                  onChanged: controller.loading
                      ? null
                      : (next) => controller.search(_query.text, newLiveOnly: next),
                ),
                if (controller.loading) const LinearProgressIndicator(),
                if (controller.error != null)
                  MaterialBanner(
                    content: Text(controller.error!),
                    leading: const Icon(Icons.error_outline),
                    actions: [
                      TextButton(
                        onPressed: () {
                          if (controller.items.isNotEmpty && controller.nextOffset != null) {
                            controller.loadMore();
                          } else {
                            controller.search(_query.text);
                          }
                        },
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                Expanded(
                  child: controller.items.isEmpty
                      ? Center(
                          child: Text(controller.loading
                              ? 'Searching…'
                              : controller.query.length < 2
                                  ? 'Enter at least two characters.'
                                  : controller.error == null
                                      ? 'No eligible public results. Try another search.'
                                      : 'Results unavailable. Retry above.'),
                        )
                      : ListView.builder(
                          key: const Key('public-discovery-results'),
                          itemCount: controller.items.length +
                              (controller.nextOffset != null ||
                                      controller.saturated ? 1 : 0),
                          itemBuilder: (context, index) {
                            if (index >= controller.items.length) {
                              if (controller.nextOffset != null) {
                                return Padding(
                                  padding: const EdgeInsets.symmetric(
                                      vertical: 12, horizontal: 24),
                                  child: OutlinedButton(
                                    onPressed: controller.loadingMore
                                        ? null : controller.loadMore,
                                    child: Text(controller.loadingMore
                                        ? 'Loading more…' : 'Load more'),
                                  ),
                                );
                              }
                              return const Padding(
                                padding: EdgeInsets.all(16),
                                child: Text(
                                  'Search may contain more results. Refine your words or choose a category.',
                                  textAlign: TextAlign.center,
                                ),
                              );
                            }
                            final item = controller.items[index];
                            final category = switch (item.kind) {
                              PublicDiscoveryKind.talk => 'Public Talk',
                              PublicDiscoveryKind.person => 'Person',
                              PublicDiscoveryKind.expert => 'Masanawa Expert · AI',
                              PublicDiscoveryKind.twin => 'Published Twin · AI',
                            };
                            final detail = switch (item.kind) {
                              PublicDiscoveryKind.talk =>
                                item.isLive ? 'Live · ${item.listenerCount} listening'
                                    : 'Replay or past Talk',
                              PublicDiscoveryKind.person =>
                                item.isLive ? 'Hosting live' : 'Public profile',
                              PublicDiscoveryKind.expert ||
                              PublicDiscoveryKind.twin =>
                                '${item.available ? 'Available' : 'Unavailable'}'
                                '${item.seatFeeLabel.isNotEmpty ? ' · Seat ${item.seatFeeLabel}' : ''}',
                            };
                            return ListTile(
                              key: ValueKey('${item.kind.name}:${item.id}'),
                              leading: CircleAvatar(
                                backgroundImage: item.avatarUrl == null
                                    ? null : NetworkImage(item.avatarUrl!),
                                child: item.avatarUrl != null ? null : Icon(switch (item.kind) {
                                  PublicDiscoveryKind.talk => Icons.mic,
                                  PublicDiscoveryKind.person => Icons.person_outline,
                                  PublicDiscoveryKind.expert => Icons.smart_toy_outlined,
                                  PublicDiscoveryKind.twin => Icons.people_outline,
                                }),
                              ),
                              title: Text(item.title, maxLines: 1,
                                  overflow: TextOverflow.ellipsis),
                              subtitle: Text('$category · ${item.subtitle}\n$detail',
                                  maxLines: 3, overflow: TextOverflow.ellipsis),
                              isThreeLine: true,
                              trailing: const Icon(Icons.chevron_right),
                              onTap: controller.authorized
                                  ? () => widget.openRoute(item.route)
                                  : null,
                            );
                          },
                        ),
                ),
              ],
            ),
    );
  }
}
