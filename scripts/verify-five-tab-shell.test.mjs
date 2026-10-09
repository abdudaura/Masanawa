import test from 'node:test';
import assert from 'node:assert/strict';
import { auditFiveTabSources } from './verify-five-tab-shell.mjs';

// Minimal source fixtures intentionally exercise the *actual* Dart syntax in
// the unmerged F12 implementation, not a duplicate JS navigation implementation.
const valid = {
  tabs: `
enum MasanawaRootTab {
  talks('talks', '/talks'),
  chats('messages', '/messages'),
  assistant('assistant', '/assistant'),
  wallet('wallet', '/wallet'),
  agents('agents', '/agents');
  const MasanawaRootTab(this.queryValue, this.location);
  static MasanawaRootTab fromQuery(String? value) => switch (value) {
    'talk' || 'assistant' => MasanawaRootTab.assistant,
    _ => MasanawaRootTab.talks,
  };
  static MasanawaRootTab? fromLocation(String path) => switch(path) {
    '/talks' || '/home' => MasanawaRootTab.talks,
    '/assistant' || '/chats' || '/chat' => MasanawaRootTab.assistant,
    _ => null,
  };
}`,
  router: `
String? legacyShellDestination(String? tab) => switch(tab) {
  'create' => '/talk/create',
  'activity' => '/activity',
  'you' => '/you',
  _ => null,
};
if (path == '/chat' || path == '/chats') return '/assistant';
final protected = path == '/messages' || path.startsWith('/messages/');
if (!isSignedIn && protected) return '/phone-login';
GoRoute(path: '/talks', builder: (_, _) => Talks());
GoRoute(path: '/messages', builder: (_, _) => Inbox());
GoRoute(path: '/messages/new', builder: (_, _) => HumanNewMessageScreen());
GoRoute(path: '/messages/:conversationId', builder: (_, _) => HumanDmThreadScreen());
GoRoute(path: '/assistant', builder: (_, _) => Assistant());
GoRoute(path: '/wallet', builder: (_, _) => Wallet());
GoRoute(path: '/agents', builder: (_, _) => Agents());
GoRoute(path: '/talk/:id', builder: (_, _) => PublicTalk());
GoRoute(path: '/chat/:id', builder: (_, state) => AiChatScreen(characterId: state.pathParameters['id']));
`,
  shell: `
_index = widget.initialIndex.clamp(0, 4).toInt();
Widget _chats() => HumanDmInboxScreen();
Widget _assistant() {
  return AssistantWorkspaceScreen();
}
Widget _page(int index) => switch (index) {
  0 => _home(),
  1 => _chats(),
  2 => _assistant(),
  3 => _wallet(),
  4 => _agents(),
  _ => const SizedBox.shrink(),
};
body: IndexedStack(children: List.generate(5, (index) =>
  (index != 2 || _index == 2) ? _page(index) : const SizedBox.shrink())),
floatingActionButton: _index == 0 &&
    MediaQuery.viewInsetsOf(context).bottom == 0
  ? FloatingActionButton(onPressed: () => context.push('/talk/create')) : null,
bottomNavigationBar: NavigationBar(
  destinations: [
    NavigationDestination(label: strings.talksTab,),
    NavigationDestination(label: strings.chatsTab,),
    NavigationDestination(label: strings.assistantTab,),
    NavigationDestination(label: strings.wallet,),
    NavigationDestination(label: strings.agents,),
  ],
),
`,
};
const ids = (sources) => auditFiveTabSources(sources).errors.map((x) => x.id);
const edit = (key, before, after) => ({
  ...valid,
  [key]: valid[key].replace(before, after),
});

test('valid five-tab and separated human/AI source passes static contract', () => {
  assert.deepEqual(auditFiveTabSources(valid), {ok: true, errors: []});
});
test('old or out-of-order tabs cannot masquerade as five-tab integration', () => {
  assert.ok(ids(edit('tabs', "chats('messages', '/messages'),", '')).includes('ROOT_ORDER'));
  assert.ok(ids(edit('tabs', "assistant('assistant', '/assistant'),", '')).includes('ROOT_ORDER'));
});
test('old /chats link must never point to a human inbox', () => {
  assert.ok(ids(edit('router', "return '/assistant';", "return '/messages';")).includes('AI_ALIAS_REDIRECT'));
  assert.ok(ids(edit('tabs', "'/assistant' || '/chats' || '/chat'", "'/assistant' || '/messages' || '/chat'"))
    .includes('LEGACY_CHATS'));
});
test('human DM routes must remain protected and separate from AI personas', () => {
  assert.ok(ids(edit('router', "path.startsWith('/messages/')", "path.startsWith('/assistant/')")).includes('HUMAN_AUTH'));
  assert.ok(ids(edit('router', 'HumanDmThreadScreen()', 'AiChatScreen()')).includes('HUMAN_ROUTE'));
});
test('Talk FAB cannot silently move to Chats', () => {
  assert.ok(ids(edit('shell', 'floatingActionButton: _index == 0 &&', 'floatingActionButton: _index == 1 &&'))
    .includes('TALK_ONLY_FAB'));
});
test('Assistant isolation, navigation labels and mount count are independently guarded', () => {
  assert.ok(ids(edit('shell', 'index != 2 || _index == 2', 'index != 4 || _index == 4'))
    .includes('NO_IDLE_ASSISTANT'));
  assert.ok(ids(edit('shell', 'List.generate(5,', 'List.generate(4,')).includes('FIVE_VIEWS'));
  assert.ok(ids(edit('shell', 'label: strings.assistantTab', 'label: strings.talksTab'))
    .includes('NAV_LABEL_ORDER'));
});
test('comment-only claims cannot conceal missing runtime shell behavior', () => {
  const bad = edit('shell', 'List.generate(5,', 'List.generate(4,');
  bad.shell += '\n// List.generate(5,';
  assert.ok(ids(bad).includes('FIVE_VIEWS'));
});
