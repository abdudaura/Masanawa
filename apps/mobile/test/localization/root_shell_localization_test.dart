import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/l10n/app_localizations.dart';
import 'package:masanawa/src/agents/agent_directory.dart';
import 'package:masanawa/src/agents/agent_presence_labels.dart';

AgentDirectoryEntry _agent(AgentPresence presence, {int count = 0}) =>
    AgentDirectoryEntry(
      characterId: 'agent-1',
      characterVersionId: 'v1',
      displayName: 'Gwani',
      roleLabel: 'Support',
      about: '',
      presence: presence,
      activeWorkCount: count,
    );

void main() {
  test('agent presence UI is translated from the authoritative enum', () async {
    for (final language in ['en', 'ha', 'ar', 'fr', 'es', 'pt']) {
      final strings = await AppLocalizations.delegate.load(Locale(language));
      expect(localizedAgentPresence(strings, _agent(AgentPresence.available)),
          strings.statusAvailable, reason: language);
      expect(localizedAgentPresence(strings, _agent(AgentPresence.listening)),
          strings.statusListening, reason: language);
      expect(localizedAgentPresence(strings, _agent(AgentPresence.onCall)),
          strings.statusOnCall, reason: language);
      expect(localizedAgentPresence(strings, _agent(AgentPresence.offline)),
          strings.statusOffline, reason: language);
      expect(localizedAgentPresence(strings, _agent(AgentPresence.unknown)),
          strings.statusUnverified, reason: language);
      expect(localizedAgentPresence(strings,
          _agent(AgentPresence.working, count: 0)),
          strings.statusWorking, reason: language);
    }
  });

  test('working task count observes locale plural grammar', () async {
    final english = await AppLocalizations.delegate.load(const Locale('en'));
    expect(
      localizedAgentPresence(english, _agent(AgentPresence.working, count: 1)),
      'Working · 1 task',
    );
    expect(
      localizedAgentPresence(english, _agent(AgentPresence.working, count: 3)),
      'Working · 3 tasks',
    );
    final arabic = await AppLocalizations.delegate.load(const Locale('ar'));
    expect(
      localizedAgentPresence(arabic, _agent(AgentPresence.working, count: 2)),
      contains('مهمتان'),
    );
  });

  test('non-working presence never accidentally claims active tasks', () async {
    final strings = await AppLocalizations.delegate.load(const Locale('en'));
    expect(
      localizedAgentPresence(strings,
          _agent(AgentPresence.unknown, count: 8)),
      strings.statusUnverified,
    );
    expect(
      localizedAgentPresence(strings,
          _agent(AgentPresence.offline, count: 5)),
      strings.statusOffline,
    );
  });

  test('translated error screens retain meaningful retry actions', () async {
    for (final code in ['en', 'ha', 'ar', 'fr', 'es', 'pt']) {
      final strings = await AppLocalizations.delegate.load(Locale(code));
      expect(strings.agentsLoadFailed.trim(), isNotEmpty);
      expect(strings.publicTwinsLoadFailed.trim(), isNotEmpty);
      expect(strings.retry.trim(), isNotEmpty);
      expect(strings.privateTwinTalkUnavailable('Amina Twin'),
          contains('Amina Twin'));
      final share = strings.twinShareText(
        'Amina Twin', 'https://masanawa.com/t/abc',
      );
      expect(share, contains('Amina Twin'));
      expect(share, contains('https://masanawa.com/t/abc'));

    }
  });
}
