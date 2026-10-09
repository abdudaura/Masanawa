/// Canonical, permanent mobile root destinations. Indices are presentation only;
/// neither persona nor person identities can be inferred from tab indices.
enum MasanawaRootTab {
  talks('talks', '/talks'),
  chats('messages', '/messages'),
  assistant('assistant', '/assistant'),
  wallet('wallet', '/wallet'),
  agents('agents', '/agents');

  const MasanawaRootTab(this.queryValue, this.location);

  final String queryValue;
  final String location;

  /// Historical 'talk' was PRIVATE AI; 'home' was public discovery.
  /// Use typed route paths for new links, this parser only for old URLs.
  static MasanawaRootTab fromQuery(String? value) => switch (value) {
        'messages' || 'chats' => MasanawaRootTab.chats,
        'talk' || 'assistant' => MasanawaRootTab.assistant,
        'wallet' => MasanawaRootTab.wallet,
        'agents' || 'masana' => MasanawaRootTab.agents,
        _ => MasanawaRootTab.talks,
      };

  static MasanawaRootTab? fromLocation(String path) => switch (path) {
        '/talks' || '/home' => MasanawaRootTab.talks,
        '/messages' => MasanawaRootTab.chats,
        '/assistant' || '/chats' || '/chat' => MasanawaRootTab.assistant,
        '/wallet' => MasanawaRootTab.wallet,
        '/agents' || '/masana' => MasanawaRootTab.agents,
        _ => null,
      };
}

