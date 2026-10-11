/// Canonical consumer root tabs: Chats · Status · Wallet · Calls · Rooms.
///
/// Route identifiers are a navigation contract (query values stay stable for
/// deep links); they are not service categories or permissions.
enum MasanawaRootTab {
  chats('chats'),
  status('status'),
  wallet('wallet'),
  calls('calls'),
  rooms('rooms');

  const MasanawaRootTab(this.queryValue);

  final String queryValue;

  static MasanawaRootTab fromQuery(String? value) => switch (value) {
        'status' => MasanawaRootTab.status,
        'wallet' => MasanawaRootTab.wallet,
        'calls' => MasanawaRootTab.calls,
        'rooms' => MasanawaRootTab.rooms,
        _ => MasanawaRootTab.chats,
      };

  String get location =>
      this == MasanawaRootTab.chats ? '/home' : '/home?tab=$queryValue';
}
