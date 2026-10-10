/// Consumer navigation is ordered by the owner's confirmed 2026-10-09 contract.
/// Tab indices are presentation only, never identity, authorization or money.
enum MasanawaRootTab {
  chats('chats'),
  rooms('rooms'),
  talks('talks'),
  gwani('gwani'),
  wallet('wallet');

  const MasanawaRootTab(this.queryValue);

  final String queryValue;

  /// Historic `talk` meant a PRIVATE AI conversation, not a published audio
  /// post. Historic `home` was public discovery, and `agents` was a directory.
  /// Do not decode old saved indices as the new five-tab order.
  static MasanawaRootTab fromQuery(String? value) => switch (value) {
        'chats' || 'messages' || 'agents' || 'masana' => MasanawaRootTab.chats,
        'rooms' => MasanawaRootTab.rooms,
        'talks' || 'home' => MasanawaRootTab.talks,
        'gwani' || 'assistant' || 'talk' => MasanawaRootTab.gwani,
        'wallet' => MasanawaRootTab.wallet,
        _ => MasanawaRootTab.talks,
      };

  /// Canonical Talks root omits the tab parameter. It is the cold-start
  /// default, while explicit deep links may still target another resource.
  String get location =>
      this == MasanawaRootTab.talks ? '/home' : '/home?tab=$queryValue';
}
