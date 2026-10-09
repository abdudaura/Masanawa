import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/agents/agent_shell.dart';
import 'package:masanawa/src/core/live_voice_session.dart';
import 'package:masanawa/src/operator_voice/private_voice_operator.dart';
import 'package:mocktail/mocktail.dart';

class _Shell extends Mock implements AgentShellTransport {}
class _Live extends Mock implements LiveVoiceSession {}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('public Talk microphone preempts private lease and prevents overlap',
      () async {
    final focus = PrivateVoiceFocus();
    var cancelled = 0;
    final lease = focus.acquire(preempt: () async { cancelled++; });
    expect(lease, isNotNull);
    expect(focus.privateAudioActive, isTrue);
    await focus.setPublicAudioActive(true);
    expect(cancelled, 1);
    expect(focus.privateAudioActive, isFalse);
    expect(focus.acquire(preempt: () async {}), isNull);
    await lease!.release();
    await focus.setPublicAudioActive(false);
    final newLease = focus.acquire(preempt: () async {});
    expect(newLease, isNotNull);
    await lease.release(); // stale lease cannot revoke new session
    expect(focus.privateAudioActive, isTrue);
    await newLease!.release();
  });

  test('typing works with no voice grant and identity switching purges draft',
      () async {
    final shell = _Shell();
    final voice = PrivateVoiceOperator(shell: shell, focus: PrivateVoiceFocus());
    await voice.bindAssistantContext(
        accountId: 'a', characterId: 'gwani', characterSessionId: 'session-a');
    voice.editDraft('Call me later');
    expect(voice.review()!.text, 'Call me later');
    await voice.bindAssistantContext(
        accountId: 'b', characterId: 'gwana', characterSessionId: 'session-b');
    expect(voice.review(), isNull);
    verifyNever(() => shell.mintLiveVoiceGrant(any(),
        admissionId: any(named: 'admissionId'), purpose: any(named: 'purpose')));
    voice.dispose();
  });

  test('stale review after edit, logout or session switch never sends',
      () async {
    final voice = PrivateVoiceOperator(
        shell: _Shell(), focus: PrivateVoiceFocus());
    await voice.bindAssistantContext(
        accountId: 'a', characterId: 'gwani', characterSessionId: 'session-a');
    voice.editDraft('Send 100 to B', recognizedSpeech: true);
    final previous = voice.review()!;
    voice.editDraft('I want to ask about a bill');
    var sends = 0;
    expect(await voice.submitReviewed(
      reviewed: previous,
      currentAccountId: 'a',
      currentCharacterSessionId: 'session-a',
      submitToAssistant: (_) async { sends++; },
    ), isFalse);
    expect(sends, 0);
    final current = voice.review()!;
    await voice.bindAssistantContext(
        accountId: 'a', characterId: 'gwani', characterSessionId: 'session-b');
    expect(await voice.submitReviewed(
      reviewed: current,
      currentAccountId: 'a',
      currentCharacterSessionId: 'session-b',
      submitToAssistant: (_) async { sends++; },
    ), isFalse);
    expect(sends, 0);
    voice.dispose();
  });

  test('ambiguous send never replays and retains review draft', () async {
    final voice = PrivateVoiceOperator(
        shell: _Shell(), focus: PrivateVoiceFocus());
    await voice.bindAssistantContext(
        accountId: 'a', characterId: 'gwani', characterSessionId: 'session-a');
    voice.editDraft('Make a payment');
    var sends = 0;
    final reviewed = voice.review()!;
    final accepted = await voice.submitReviewed(
      reviewed: reviewed,
      currentAccountId: 'a',
      currentCharacterSessionId: 'session-a',
      submitToAssistant: (_) async {
        sends++;
        throw StateError('server outcome unknown');
      },
    );
    expect(accepted, isFalse);
    expect(sends, 1);
    expect(voice.review()?.text, 'Make a payment');
    expect(voice.outcomeUnknown, isTrue);
    expect(voice.error, contains('Check Assistant task status'));
    expect(await voice.submitReviewed(
      reviewed: reviewed,
      currentAccountId: 'a',
      currentCharacterSessionId: 'session-a',
      submitToAssistant: (_) async { sends++; },
    ), isFalse);
    expect(sends, 1); // an unknown external write must not replay
    voice.discardUncertainDraft();
    expect(voice.review(), isNull);
    voice.dispose();
  });

  test('double approval taps are single-flight', () async {
    final voice = PrivateVoiceOperator(
        shell: _Shell(), focus: PrivateVoiceFocus());
    await voice.bindAssistantContext(
        accountId: 'a', characterId: 'gwani', characterSessionId: 'session-a');
    voice.editDraft('Find nearby Talks');
    final review = voice.review()!;
    final completer = Completer<void>();
    var submits = 0;
    Future<void> dispatch(VoiceReviewDraft _) async {
      submits++;
      await completer.future;
    }
    final first = voice.submitReviewed(
      reviewed: review, currentAccountId: 'a',
      currentCharacterSessionId: 'session-a', submitToAssistant: dispatch,
    );
    final second = await voice.submitReviewed(
      reviewed: review, currentAccountId: 'a',
      currentCharacterSessionId: 'session-a', submitToAssistant: dispatch,
    );
    expect(second, isFalse);
    expect(submits, 1);
    completer.complete();
    expect(await first, isTrue);
    voice.dispose();
  });

  test('rejects untrusted or expired voice WebSocket grant before media start',
      () async {
    final shell = _Shell();
    final session = _Live();
    var constructed = 0;
    final focus = PrivateVoiceFocus();
    final voice = PrivateVoiceOperator(
      shell: shell,
      focus: focus,
      makeSession: ({required grant, required characterName}) {
        constructed++;
        return session;
      },
    );
    when(() => shell.mintLiveVoiceGrant('gwani',
        admissionId: 'approved', purpose: 'conversation')).thenAnswer(
      (_) async => AgentLiveVoiceGrant(
        token: 'example',
        websocketUrl: 'wss://malicious.example.com/v1/voice',
        model: 'fake',
        voiceName: 'Bodi',
        expiresAt: DateTime.now().add(const Duration(minutes: 5)),
      ),
    );
    await voice.start(
      accountId: 'a', characterId: 'gwani',
      characterSessionId: 'session-a', characterName: 'Gwani',
      admissionId: 'approved',
    );
    expect(constructed, 0);
    expect(voice.phase, PrivateVoicePhase.idle);
    expect(focus.privateAudioActive, isFalse);
    voice.dispose();
  });

  test('Gemini agent-output captions are never automatic instructions',
      () async {
    final shell = _Shell();
    final session = _Live();
    final output = StreamController<String>.broadcast(sync: true);
    final states = StreamController<LiveVoiceState>.broadcast(sync: true);
    when(() => session.states).thenAnswer((_) => states.stream);
    when(() => session.errors).thenAnswer((_) => const Stream<String>.empty());
    when(() => session.transcripts).thenAnswer((_) => output.stream);
    when(() => session.start()).thenAnswer((_) async {});
    when(() => session.ready).thenAnswer((_) async {});
    when(() => session.close()).thenAnswer((_) async {});
    when(() => shell.mintLiveVoiceGrant('gwani',
        admissionId: 'approved', purpose: 'conversation')).thenAnswer(
      (_) async => AgentLiveVoiceGrant(
        token: 'short-lived-token',
        websocketUrl:
          'wss://generativelanguage.googleapis.com/ws/generative?access_token=redacted',
        model: 'gemini-live',
        voiceName: 'Bodi',
        expiresAt: DateTime.now().add(const Duration(minutes: 5)),
      ),
    );
    final voice = PrivateVoiceOperator(
      shell: shell,
      focus: PrivateVoiceFocus(),
      makeSession: ({required grant, required characterName}) => session,
    );
    await voice.start(accountId: 'a', characterId: 'gwani',
        characterSessionId: 'session-a', characterName: 'Gwani',
        admissionId: 'approved');
    output.add('I will send the payment now');
    expect(voice.lastAgentSpeech, contains('send the payment'));
    expect(voice.review(), isNull); // no unsolicited task proposal
    await voice.stop();
    await output.close();
    await states.close();
    voice.dispose();
  });
}
