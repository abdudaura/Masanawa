import 'package:masanawa/src/localization/masanawa_localization.dart';
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/agents/agent_directory.dart';
import 'package:masanawa/src/agents/agent_directory_cache.dart';
import 'package:masanawa/src/core/api/models.dart';
import 'package:masanawa/src/core/providers.dart';
import 'package:masanawa/src/screens/settings/settings_screen.dart';
import 'package:masanawa/src/state/agent_directory_state.dart';
import 'package:masanawa/src/state/session_state.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';

const user = AuthUser(
  id: 'user-settings',
  name: 'Aisha',
  email: 'aisha@example.com',
  locale: 'en-NG',
  status: 'ACTIVE',
  role: 'USER',
  isNewUser: false,
  createdAt: '2026-10-05T00:00:00Z',
);

class SettingsSession extends SessionController {
  @override
  SessionState build() => SessionSignedIn(
    user,
    AuthTokens(
      accessToken: 'session',
      refreshToken: 'refresh',
      accessExpiresIn: 900,
      user: user,
    ),
  );
}

class SettingsCache implements AgentDirectoryCache {
  @override
  Future<List<AgentDirectoryEntry>?> read(String ownerId) async => null;
  @override
  Future<void> write(String ownerId, List<AgentDirectoryEntry> agents) async {}
  @override
  Future<void> clear() async {}
}

class SettingsDirectory implements AgentDirectoryTransport {
  String selected = 'gwani';
  Completer<void>? pendingWrite;
  bool failRead = false;
  int writes = 0;

  @override
  Future<List<AgentDirectoryEntry>> loadDirectory() async {
    if (failRead) throw StateError('No connection');
    AgentDirectoryEntry agent(String id) => AgentDirectoryEntry(
      characterId: id,
      characterVersionId: 'v-$id',
      displayName: id == 'gwani' ? 'Gwani' : 'Gwana',
      roleLabel: 'Support',
      about: 'Platform help',
      presence: AgentPresence.unknown,
      supportAgent: true,
      defaultPlatformAgent: id == selected,
    );
    return [agent('gwani'), agent('gwana')];
  }

  @override
  Future<void> setDefaultPlatformAgent(String characterId) async {
    writes += 1;
    if (pendingWrite != null) await pendingWrite!.future;
    selected = characterId;
  }
}

Future<void> mount(
  WidgetTester tester,
  SettingsDirectory transport,
) async {
  await tester.pumpWidget(ProviderScope(
    overrides: [
      sessionProvider.overrideWith(SettingsSession.new),
      agentDirectoryCacheProvider.overrideWithValue(SettingsCache()),
      agentDirectoryTransportProvider.overrideWithValue(transport),
    ],
    child: MaterialApp(localizationsDelegates: MasanawaLocalization.delegates, supportedLocales: MasanawaLocalization.supportedLocales, 
      theme: buildMasanawaTheme(brightness: Brightness.light),
      home: const SettingsScreen(),
    ),
  ));
  await tester.pumpAndSettle();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('support preference waits for authoritative readback to show success',
      (tester) async {
    final transport = SettingsDirectory()
      ..pendingWrite = Completer<void>();
    await mount(tester, transport);
    expect(find.byKey(const Key('settings-support-agent-gwana')), findsOneWidget);

    await tester.tap(find.byKey(const Key('settings-support-agent-gwana')));
    await tester.pump();

    expect(transport.writes, 1);
    expect(find.textContaining('is now your default'), findsNothing);
    transport.pendingWrite!.complete();
    await tester.pumpAndSettle();

    expect(find.textContaining('Gwana is now your default'), findsOneWidget);
    expect(transport.selected, 'gwana');
  });

  testWidgets('unverified preference offers refresh instead of false success',
      (tester) async {
    final transport = SettingsDirectory();
    await mount(tester, transport);
    transport.failRead = true;

    await tester.tap(find.byKey(const Key('settings-support-agent-gwana')));
    await tester.pumpAndSettle();

    expect(transport.writes, 1);
    expect(find.textContaining('is now your default'), findsNothing);
    expect(find.textContaining('Selection unverified'), findsOneWidget);
    expect(find.text('Refresh'), findsWidgets);
  });
}
