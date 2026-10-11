import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:go_router/go_router.dart';

import '../core/providers.dart';
import '../features/account/fan_account_repository.dart';
import '../features/account/fan_account_screen.dart';
import '../features/home_feed/feed_api.dart';
import '../features/home_feed/feed_screen.dart';
import '../features/masana/masana_directory_screen.dart';
import '../features/masana/masana_profile_screen.dart';
import '../features/masana/masana_repository.dart';
import '../features/masana_chat/masana_chat_api.dart';
import '../features/masana_chat/masana_chat_controller.dart';
import '../features/masana_chat/masana_chat_screen.dart';
import '../features/masana_chat/masana_chats_list_api.dart';
import '../features/masana_chat/masana_chats_list_screen.dart';
import '../features/videos/video_repository.dart';
import '../features/videos/videos_screen.dart';
import '../screens/wallet/wallet_screen.dart';
import '../state/session_state.dart';

/// Canonical rebuild routes. The old four-tab Talk/Twin enum is intentionally
/// left only for old compatibility source; it must never choose production tabs.
enum MasanawaTab {
  chats('chats'),
  rooms('rooms'),
  home('home'),
  gwani('gwani'),
  wallet('wallet');

  const MasanawaTab(this.query);
  final String query;

  static MasanawaTab parse(String? raw) => switch (raw) {
    'chats' => chats,
    'rooms' => rooms,
    'gwani' => gwani,
    'wallet' => wallet,
    _ => home,
  };

  String get location => this == home ? '/home' : '/home?tab=$query';
}

/// Consumer navigation composition only. Auth, money, Masana eligibility and
/// provider permissions still belong to the existing server authorities.
/// No Talk, Twin, public posting or user-created Room affordance is mounted.
class MasanawaConsumerShell extends ConsumerStatefulWidget {
  const MasanawaConsumerShell({super.key, this.initialTab = MasanawaTab.home});
  final MasanawaTab initialTab;

  @override
  ConsumerState<MasanawaConsumerShell> createState() => _MasanawaConsumerShellState();
}

class _MasanawaConsumerShellState extends ConsumerState<MasanawaConsumerShell> {
  late MasanawaTab _selected;
  final Set<MasanawaTab> _visited = {};
  bool _videos = false;
  bool _videoVisited = false;
  late final DioFeedApi _feed;
  late final VideoRepository _video;
  late final GatewayMasanaRepository _masana;
  late final MasanaChatsListApi _inbox;

  @override
  void initState() {
    super.initState();
    _selected = widget.initialTab;
    _visited.add(_selected);
    final client = ref.read(apiClientProvider);
    _feed = DioFeedApi(client.dio, () async => client.accessToken);
    _video = VideoRepository(client.dio);
    _masana = GatewayMasanaRepository(client.dio);
    _inbox = MasanaChatsListApi(client.dio, const FlutterSecureStorage());
  }

  @override
  void didUpdateWidget(covariant MasanawaConsumerShell oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialTab != widget.initialTab) {
      _selected = widget.initialTab;
      _visited.add(_selected);
    }
  }

  void _switch(MasanawaTab tab) {
    if (tab == _selected) return;
    setState(() {
      _selected = tab;
      _visited.add(tab);
    });
    context.go(tab.location);
  }

  String _translate(String en, String ha) =>
      Localizations.localeOf(context).languageCode == 'ha' ? ha : en;

  Widget _home(String account) => Scaffold(
    appBar: AppBar(
      title: const Text('Masanawa'),
      actions: [
        IconButton(
          tooltip: _translate('Find Masana', 'Nemo Masana'),
          icon: const Icon(Icons.search_outlined),
          onPressed: () => context.push('/masana/discover'),
        ),
        IconButton(
          tooltip: _translate('My account', 'Asusuna'),
          icon: const Icon(Icons.account_circle_outlined),
          onPressed: () => context.push('/account'),
        ),
      ],
    ),
    body: Column(children: [
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        child: Row(children: [
          Expanded(child: ChoiceChip(
            label: Text(_translate('Feed', 'Labarai')),
            selected: !_videos,
            onSelected: (_) => setState(() => _videos = false),
          )),
          const SizedBox(width: 8),
          Expanded(child: ChoiceChip(
            label: Text(_translate('Videos', 'Bidiyoyi')),
            selected: _videos,
            onSelected: (_) => setState(() { _videos = true; _videoVisited = true; }),
          )),
        ]),
      ),
      Expanded(child: IndexedStack(index: _videos ? 1 : 0, children: [
        MasanaFeedScreen(
          key: ValueKey('masana-feed-$account'),
          api: _feed,
          accountKey: account,
          onMasanaProfile: (id) => context.push(
            '/masana/${Uri.encodeComponent(id)}/profile'),
          // Media requires post+media pair and an audio-focus handoff; never
          // substitute a bare media ID, or grant a non-authorized playback.
        ),
        _videoVisited
            ? ExternalVideosScreen(
                key: ValueKey('official-videos-$account'),
                accountKey: account,
                languageCode: Localizations.localeOf(context).languageCode,
                load: _video.list,
                loadPage: _video.page,
                checkAvailability: _video.isApproved,
              )
            : const SizedBox.shrink(),
      ])),
    ]),
  );

  Widget _page(MasanawaTab tab, String account) => switch (tab) {
    MasanawaTab.chats => MasanaChatsListScreen(
      key: ValueKey('inbox-$account'),
      accountId: account,
      inbox: _inbox,
      onOpen: (id, _) => context.push('/masana/${Uri.encodeComponent(id)}/chat'),
      onDiscover: () => context.push('/masana/discover'),
    ),
    MasanawaTab.rooms => const _RoomsIntegrationGate(),
    MasanawaTab.home => _home(account),
    MasanawaTab.gwani => _GwaniLanding(
      key: ValueKey('gwani-$account'),
      repository: _masana,
      onOpen: (id) => context.push('/masana/${Uri.encodeComponent(id)}/chat'),
    ),
    MasanawaTab.wallet => WalletScreen(
      embeddedInShell: true,
      onBuyBills: () => context.push('/billing'),
      onOpenCrypto: () => context.push('/crypto'),
      onOpenBillingService: (service) => context.push(
        '/billing?service=${Uri.encodeQueryComponent(service)}'),
    ),
  };

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    final account = session is SessionSignedIn ? session.user.id : '';
    return Scaffold(
      body: IndexedStack(
        index: _selected.index,
        children: [
          for (final tab in MasanawaTab.values)
            _visited.contains(tab)
                ? KeyedSubtree(
                    key: ValueKey('${tab.query}-$account'),
                    child: _page(tab, account),
                  )
                : const SizedBox.shrink(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selected.index,
        onDestinationSelected: (index) => _switch(MasanawaTab.values[index]),
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.chat_bubble_outline),
            selectedIcon: const Icon(Icons.chat_bubble),
            label: _translate('Chats', 'Hirarraki'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.school_outlined),
            selectedIcon: const Icon(Icons.school),
            label: _translate('Rooms', 'Dakuna'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.home_outlined),
            selectedIcon: const Icon(Icons.home),
            label: _translate('Home', 'Gida'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.support_agent_outlined),
            selectedIcon: const Icon(Icons.support_agent),
            label: 'Gwani',
          ),
          NavigationDestination(
            icon: const Icon(Icons.account_balance_wallet_outlined),
            selectedIcon: const Icon(Icons.account_balance_wallet),
            label: _translate('Wallet', 'Aljihu'),
          ),
        ],
      ),
    );
  }
}

/// Paid/free Room source is still in #625, stacked with #655. Do not render an
/// invented enrollment or mark an unverified Play entitlement as approved.
class _RoomsIntegrationGate extends StatelessWidget {
  const _RoomsIntegrationGate();
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Rooms')),
    body: Center(child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Icon(Icons.school_outlined, size: 48),
        const SizedBox(height: 12),
        const Text('Rooms are not available yet.',
          textAlign: TextAlign.center),
        const SizedBox(height: 8),
        const Text('Joining, lessons and paid subscriptions will be enabled only after the server verifies your access.',
          textAlign: TextAlign.center),
      ]),
    )),
  );
}

class _GwaniLanding extends StatefulWidget {
  const _GwaniLanding({super.key, required this.repository, required this.onOpen});
  final MasanaRepository repository;
  final ValueChanged<String> onOpen;
  @override State<_GwaniLanding> createState() => _GwaniLandingState();
}
class _GwaniLandingState extends State<_GwaniLanding> {
  late Future<MasanaProfile?> _future = _load();
  Future<MasanaProfile?> _load() async {
    final profiles = await widget.repository.search('Gwani');
    for (final profile in profiles) {
      if (profile.profile['handle']?.toString().toLowerCase() == 'gwani' ||
          profile.displayName.trim().toLowerCase() == 'gwani') {
        return profile;
      }
    }
    return null;
  }
  @override
  void didUpdateWidget(covariant _GwaniLanding old) {
    super.didUpdateWidget(old);
    if (old.repository != widget.repository) _future = _load();
  }
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Gwani')),
    body: FutureBuilder<MasanaProfile?>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }
        final agent = snapshot.data;
        if (snapshot.hasError || agent == null) {
          return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Text('Gwani is currently unavailable.'),
            TextButton(onPressed: () => setState(() => _future = _load()),
              child: const Text('Retry')),
          ]));
        }
        return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text(agent.displayName,
            style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 12),
          FilledButton.icon(
            icon: const Icon(Icons.chat_bubble_outline),
            label: const Text('Chat with Gwani'),
            onPressed: () => widget.onOpen(agent.characterId),
          ),
        ]));
      },
    ),
  );
}

/// J03 uses the same authenticated Dio and the existing durable outbox.
/// A route cannot invent a character ID or bypass the server's platform-owner
/// eligibility check. Controller is disposed when the route/account goes away.
class MasanawaConversationRoute extends ConsumerStatefulWidget {
  const MasanawaConversationRoute({super.key, required this.characterId});
  final String characterId;
  @override
  ConsumerState<MasanawaConversationRoute> createState() =>
      _MasanawaConversationRouteState();
}
class _MasanawaConversationRouteState
    extends ConsumerState<MasanawaConversationRoute> {
  MasanaChatController? _controller;
  String? _account;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _sync();
  }

  void _sync() {
    final session = ref.read(sessionProvider);
    final account = session is SessionSignedIn ? session.user.id : '';
    if (_controller != null && _account == account &&
        _controller!.characterId == widget.characterId) return;
    _controller?.dispose();
    _account = account;
    if (account.isEmpty) { _controller = null; return; }
    _controller = MasanaChatController(
      api: MasanaChatApi(ref.read(apiClientProvider).dio),
      drafts: const MasanaChatDraftStore(FlutterSecureStorage()),
      accountId: account,
      characterId: widget.characterId,
    );
  }

  @override
  void didUpdateWidget(covariant MasanawaConversationRoute old) {
    super.didUpdateWidget(old);
    if (old.characterId != widget.characterId) _sync();
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Listening to session also rebuilds on logout/account switch.
    final session = ref.watch(sessionProvider);
    final account = session is SessionSignedIn ? session.user.id : '';
    if (account != _account) _sync();
    final controller = _controller;
    if (controller == null) {
      return const Scaffold(body: Center(child: Text('Sign in to chat.')));
    }
    return MasanaChatScreen(
      key: ValueKey('masana-chat-${widget.characterId}-$account'),
      controller: controller,
      displayName: 'Masana',
      // Not enabled until AF00 registers/qualifies 0006 and C13 route.
      hideQualified: false,
      // Voice remains disabled until verified J04 provider+device qualification.
      voiceQualified: false,
    );
  }
}

class MasanawaProfileRoute extends ConsumerWidget {
  const MasanawaProfileRoute({super.key, required this.characterId});
  final String characterId;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    final account = session is SessionSignedIn ? session.user.id : '';
    return MasanaProfileScreen(
      key: ValueKey('masana-profile-$characterId-$account'),
      characterId: characterId,
      accountKey: account,
      repository: GatewayMasanaRepository(ref.read(apiClientProvider).dio),
      onChat: () => context.push('/masana/${Uri.encodeComponent(characterId)}/chat'),
    );
  }
}

class MasanawaDiscoverRoute extends ConsumerWidget {
  const MasanawaDiscoverRoute({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    return MasanaDirectoryScreen(
      accountKey: session is SessionSignedIn ? session.user.id : '',
      repository: GatewayMasanaRepository(ref.read(apiClientProvider).dio),
      openProfile: (id) => context.push('/masana/${Uri.encodeComponent(id)}/profile'),
    );
  }
}

class MasanawaAccountRoute extends ConsumerWidget {
  const MasanawaAccountRoute({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    final account = session is SessionSignedIn ? session.user.id : '';
    final client = ref.read(apiClientProvider);
    return FanAccountScreen(
      key: ValueKey('fan-account-$account'),
      accountKey: account,
      repository: DioFanAccountRepository(
        dio: client.dio,
        accountKey: account,
        currentAccount: () {
          final next = ref.read(sessionProvider);
          return next is SessionSignedIn && next.user.id == account;
        },
      ),
      onSignIn: () => context.go('/phone-login'),
      onFollowing: () => context.push('/masana/discover'),
      onWallet: () => context.go(MasanawaTab.wallet.location),
      onSettings: () => context.push('/settings'),
    );
  }
}
