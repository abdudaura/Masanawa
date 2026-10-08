/// Canonical consumer root tabs. Route identifiers are a navigation contract:
/// they are not service categories or permissions.
enum MasanawaRootTab {
  home('home'),
  agents('agents'),
  wallet('wallet'),
  talk('talk');

  const MasanawaRootTab(this.queryValue);

  final String queryValue;

  static MasanawaRootTab fromQuery(String? value) => switch (value) {
        'agents' => MasanawaRootTab.agents,
        'wallet' => MasanawaRootTab.wallet,
        'talk' => MasanawaRootTab.talk,
        _ => MasanawaRootTab.home,
      };

  String get location =>
      this == MasanawaRootTab.home ? '/home' : '/home?tab=$queryValue';
}
