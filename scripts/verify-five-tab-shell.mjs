#!/usr/bin/env node
// F12 integration guard: static source invariants, NOT Flutter/runtime acceptance.
// Run after integrating the five-tab branch: node scripts/verify-five-tab-shell.mjs
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FILES = Object.freeze({
  tabs: 'apps/mobile/lib/src/screens/twin/shell_tab.dart',
  router: 'apps/mobile/lib/src/router/app_router.dart',
  shell: 'apps/mobile/lib/src/screens/twin/twin_home_shell.dart',
});

const expectedTabs = Object.freeze([
  ['talks', 'talks', '/talks'],
  ['chats', 'messages', '/messages'],
  ['assistant', 'assistant', '/assistant'],
  ['wallet', 'wallet', '/wallet'],
  ['agents', 'agents', '/agents'],
]);

// Ignore comment-only claims: an obsolete implementation must never pass
// because its documentation describes the intended five-tab architecture.
const codeOnly = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

export function auditFiveTabSources(input) {
  const tabs = codeOnly(input.tabs ?? '');
  const router = codeOnly(input.router ?? '');
  const shell = codeOnly(input.shell ?? '');
  const errors = [];
  const requireThat = (id, condition, detail) => {
    if (!condition) errors.push({ id, detail });
  };
  const enumBody = tabs.match(/enum\s+MasanawaRootTab\s*\{([\s\S]*?)\bconst\s+MasanawaRootTab\s*\(/)?.[1] ?? '';
  const actualTabs = [...enumBody.matchAll(/^\s*(\w+)\s*\(\s*'([^']+)'\s*,\s*'([^']+)'\s*\)\s*,?/gm)]
    .map(([, name, queryValue, location]) => [name, queryValue, location]);
  requireThat('ROOT_ORDER', JSON.stringify(actualTabs) === JSON.stringify(expectedTabs),
    'MasanawaRootTab must define exactly Talks, Chats, Assistant, Wallet, Agents in that order with distinct typed URLs.');
  requireThat('LEGACY_TALK', /'talk'\s*\|\|\s*'assistant'\s*=>\s*MasanawaRootTab\.assistant/.test(tabs),
    'Old home?tab=talk must remain private Assistant, not public Talks or human Chats.');
  requireThat('LEGACY_HOME', /'\/talks'\s*\|\|\s*'\/home'\s*=>\s*MasanawaRootTab\.talks/.test(tabs),
    'Old /home must retain public Talk discovery semantics.');
  requireThat('LEGACY_CHATS', /'\/assistant'\s*\|\|\s*'\/chats'\s*\|\|\s*'\/chat'\s*=>\s*MasanawaRootTab\.assistant/.test(tabs),
    'Historical /chat and /chats were private AI aliases, never human DMs.');

  const hasRoute = (path) => {
    const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`GoRoute\\(\\s*path:\\s*'${escaped}'`).test(router);
  };
  for (const path of ['/talks', '/messages', '/messages/new',
    '/messages/:conversationId', '/assistant', '/wallet', '/agents',
    '/chat/:id', '/talk/:id']) {
    requireThat('ROUTE_' + path, hasRoute(path),
      `Required canonical or backward-compatible route ${path} is missing.`);
  }
  requireThat('HUMAN_ROUTE', /HumanDmThreadScreen\s*\(/.test(router) &&
    /HumanNewMessageScreen\s*\(/.test(router),
    'Human thread and new-message routes must use human DM components, not AI chat.');
  requireThat('PERSONA_ROUTE', /AiChatScreen\s*\(/.test(router) &&
    /state\.pathParameters\['id'\]/.test(router),
    'Legacy /chat/:id must still resolve a character-specific AI conversation.');
  requireThat('HUMAN_AUTH', /path\s*==\s*'\/messages'/.test(router) &&
    /path\.startsWith\('\/messages\/'\)/.test(router) &&
    /!isSignedIn\s*&&\s*protected/.test(router),
    'Both human inbox and thread must remain protected by signed-in routing.');
  requireThat('AI_ALIAS_REDIRECT', /path\s*==\s*'\/chat'\s*\|\|\s*path\s*==\s*'\/chats'\)\s*return\s*'\/assistant'/.test(router),
    '/chat and /chats must redirect to private Assistant, not human Messages.');
  for (const [oldValue, target] of [['create','/talk/create'], ['activity','/activity'], ['you','/you']]) {
    requireThat('OLD_ACTION_' + oldValue,
      new RegExp(`'${oldValue}'\\s*=>\\s*'${target}'`).test(router),
      `Old home?tab=${oldValue} needs its original action destination.`);
  }

  requireThat('FIVE_VIEWS', /List\.generate\(\s*5\s*,/.test(shell) &&
    /clamp\(0,\s*4\)/.test(shell),
    'Shell must mount five correctly bounded roots.');
  const page = shell.match(/Widget\s+_page\(int\s+index\)\s*=>\s*switch\s*\(index\)\s*\{([\s\S]*?)\};/)?.[1] ?? '';
  requireThat('FIVE_VIEWS_ORDER',
    ['_home', '_chats', '_assistant', '_wallet', '_agents']
      .every((name, i) => new RegExp(`\\b${i}\\s*=>\\s*${name}\\s*\\(`).test(page)),
    'Shell page indices must match Talks/Chats/Assistant/Wallet/Agents.');
  const destinationSource = shell.match(/destinations:\s*\[([\s\S]*?)\n\s*\],/)?.[1] ?? '';
  const labels = [...destinationSource.matchAll(/NavigationDestination\([\s\S]*?label:\s*strings\.(\w+)\s*,\s*\)/g)]
    .map((match) => match[1]);
  requireThat('NAV_LABEL_ORDER',
    JSON.stringify(labels) === JSON.stringify(['talksTab','chatsTab','assistantTab','wallet','agents']),
    'Navigation must have exactly five correctly ordered destinations, including center Assistant.');
  requireThat('HUMAN_ASSISTANT_ISOLATION',
    /Widget\s+_chats\(\)\s*=>\s*HumanDmInboxScreen\s*\(/.test(shell) &&
    /Widget\s+_assistant\(\)[\s\S]*?return\s+AssistantWorkspaceScreen\s*\(/.test(shell),
    'Human Chats and AI Assistant must mount different, domain-specific implementations.');
  requireThat('NO_IDLE_ASSISTANT',
    /index\s*!=\s*2\s*\|\|\s*_index\s*==\s*2/.test(shell),
    'Inactive Assistant must unmount instead of retaining an unattended microphone/session.');
  requireThat('TALK_ONLY_FAB',
    /floatingActionButton:\s*_index\s*==\s*0\s*&&/.test(shell) &&
    /onPressed:\s*\(\)\s*=>\s*context\.push\('\/talk\/create'\)/.test(shell),
    'Public Create Talk FAB must be visible on Talks only, without auto-starting a paid/live action.');
  return { ok: errors.length === 0, errors };
}

export function auditFiveTabRoot(root) {
  const input = {};
  for (const [name, file] of Object.entries(FILES)) {
    try { input[name] = readFileSync(join(root, file), 'utf8'); }
    catch (error) { return { ok: false, errors: [{ id: 'FILE_' + name, detail: `${file}: ${error.message}` }] }; }
  }
  return auditFiveTabSources(input);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..'));
  const result = auditFiveTabRoot(root);
  if (!result.ok) {
    for (const error of result.errors) console.error(`FAIL [${error.id}] ${error.detail}`);
    console.error(`F12 five-tab static readiness: FAIL (${result.errors.length} checks). Flutter and device checks remain separate.`);
    process.exitCode = 1;
  } else {
    console.log('F12 five-tab static readiness: PASS (source invariants only; not runtime/device evidence).');
  }
}
