import 'dart:async';

import 'package:flutter/foundation.dart';

import '../agents/agent_shell.dart';
import '../core/live_voice_session.dart';

/// The single app-scoped microphone arbiter is passed to both public LiveKit
/// and private Assistant composition. In isolation U09 can fence its own calls;
/// R02/F12 must wire [setPublicAudioActive] to real Talk/DM capture events.
class VoiceFocusLease {
  VoiceFocusLease._(this._owner, this._id);
  final PrivateVoiceFocus _owner;
  final int _id;
  bool _released = false;

  Future<void> release() async {
    if (_released) return;
    _released = true;
    _owner._release(_id);
  }
}

class PrivateVoiceFocus {
  int _next = 0;
  int? _holder;
  bool _externalActive = false;
  Future<void> Function()? _preempt;

  bool get publicAudioActive => _externalActive;
  bool get privateAudioActive => _holder != null;

  VoiceFocusLease? acquire({required Future<void> Function() preempt}) {
    if (_externalActive || _holder != null) return null;
    final id = ++_next;
    _holder = id;
    _preempt = preempt;
    return VoiceFocusLease._(this, id);
  }

  void _release(int id) {
    if (_holder != id) return;
    _holder = null;
    _preempt = null;
  }

  Future<void> setPublicAudioActive(bool value) async {
    _externalActive = value;
    if (value) {
      // Synchronously invalidate the current lease, before awaiting any native
      // recorder teardown. A late release cannot free a newer holder.
      final stop = _preempt;
      _holder = null;
      _preempt = null;
      if (stop != null) await stop();
    }
  }
}

enum PrivateVoicePhase {
  idle,
  connecting,
  listening,
  speaking,
  interrupted,
  unavailable,
}

/// A voice proposal is *never* an approval. Even seemingly unambiguous spoken
/// amounts and recipients must be reviewed in the normal U02/U03 task flow.
class VoiceReviewDraft {
  const VoiceReviewDraft({
    required this.accountId,
    required this.characterId,
    required this.characterSessionId,
    required this.text,
    required this.version,
    required this.fromSpeech,
  });

  final String accountId;
  final String characterId;
  final String characterSessionId;
  final String text;
  final int version;
  final bool fromSpeech;
}

typedef VoiceSessionFactory = LiveVoiceSession Function({
  required AgentLiveVoiceGrant grant,
  required String characterName,
});

/// Uses the *existing* server-authorized Gemini grant and native PCM bridge.
/// This class does not issue an AI task or send a message until the user presses
/// Review/Send and the canonical Assistant callback accepts the same context.
class PrivateVoiceOperator extends ChangeNotifier {
  PrivateVoiceOperator({
    required AgentShellTransport shell,
    required PrivateVoiceFocus focus,
    VoiceSessionFactory? makeSession,
    DateTime Function()? now,
  }) : _shell = shell,
       _focus = focus,
       _makeSession = makeSession ??
           (({required grant, required characterName}) => LiveVoiceSession(
                 grant: grant,
                 characterName: characterName,
                 captureInputTranscription: false,
               )),
       _now = now ?? DateTime.now;

  final AgentShellTransport _shell;
  final PrivateVoiceFocus _focus;
  final VoiceSessionFactory _makeSession;
  final DateTime Function() _now;

  LiveVoiceSession? _live;
  VoiceFocusLease? _lease;
  StreamSubscription<LiveVoiceState>? _states;
  StreamSubscription<String>? _errors;
  StreamSubscription<String>? _modelSpeech;
  int _epoch = 0;
  bool _disposed = false;
  bool _opening = false;
  bool _muted = false;
  bool _submitting = false;
  bool _outcomeUnknown = false;
  PrivateVoicePhase _phase = PrivateVoicePhase.idle;
  String? _error;
  String? _lastAgentSpeech;
  String? _accountId;
  String? _characterId;
  String? _characterSessionId;
  String _draft = '';
  bool _speechDraft = false;
  int _draftVersion = 0;

  PrivateVoicePhase get phase => _phase;
  String? get error => _error;
  String? get lastAgentSpeech => _lastAgentSpeech;
  String get draftText => _draft;
  bool get isMuted => _muted;
  bool get isSubmitting => _submitting;
  bool get outcomeUnknown => _outcomeUnknown;
  bool get hasDraft => _draft.trim().isNotEmpty;
  bool get needsReview => hasDraft;
  bool get isConnected =>
      _phase == PrivateVoicePhase.listening ||
      _phase == PrivateVoicePhase.speaking ||
      _phase == PrivateVoicePhase.interrupted;

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  /// Start is user-gesture only. A paid/trial admission must already have been
  /// granted by the canonical paid-voice flow; this does not create quotes.
  Future<void> start({
    required String accountId,
    required String characterId,
    required String characterSessionId,
    required String characterName,
    required String admissionId,
  }) async {
    if (_disposed) return;
    if (accountId.trim().isEmpty ||
        characterId.trim().isEmpty ||
        characterSessionId.trim().isEmpty ||
        characterName.trim().isEmpty ||
        admissionId.trim().isEmpty) {
      throw ArgumentError('A current account, session and voice admission are required');
    }
    if (_opening) throw StateError('Voice is already connecting');
    final sameContext = _accountId == accountId &&
        _characterId == characterId &&
        _characterSessionId == characterSessionId;
    await stop(clearContext: !sameContext);
    final epoch = ++_epoch;
    _opening = true;
    _accountId = accountId;
    _characterId = characterId;
    _characterSessionId = characterSessionId;
    _phase = PrivateVoicePhase.connecting;
    _muted = false;
    _error = null;
    _notify();

    try {
      final lease = _focus.acquire(preempt: () => stop(clearContext: true));
      if (lease == null) throw StateError('End the other microphone session first');
      _lease = lease;
      final grant = await _shell.mintLiveVoiceGrant(
        characterId,
        admissionId: admissionId,
        purpose: 'conversation',
      );
      if (_disposed || _epoch != epoch) return;
      final uri = Uri.tryParse(grant.websocketUrl);
      if (uri == null ||
          uri.scheme != 'wss' ||
          uri.host != 'generativelanguage.googleapis.com' ||
          grant.token.isEmpty ||
          grant.expiresAt.isBefore(_now().add(const Duration(seconds: 15)))) {
        throw StateError('The secure voice grant is invalid or expired');
      }
      final session = _makeSession(grant: grant, characterName: characterName);
      _live = session;
      _states = session.states.listen((state) {
        if (_disposed || _epoch != epoch) return;
        switch (state) {
          case LiveVoiceState.connecting:
            _phase = PrivateVoicePhase.connecting;
          case LiveVoiceState.listening:
            _phase = PrivateVoicePhase.listening;
          case LiveVoiceState.speaking:
            _phase = PrivateVoicePhase.speaking;
          case LiveVoiceState.interrupted:
            _phase = PrivateVoicePhase.interrupted;
          case LiveVoiceState.idle:
          case LiveVoiceState.ended:
          case LiveVoiceState.failed:
            _phase = PrivateVoicePhase.unavailable;
            unawaited(stop(clearContext: false));
        }
        _notify();
      });
      _errors = session.errors.listen((message) {
        if (_epoch != epoch || _disposed) return;
        _error = message;
        _phase = PrivateVoicePhase.unavailable;
        _notify();
        unawaited(stop(clearContext: false));
      });
      // Gemini *output* transcripts are labels for what the AI said, not
      // what the user said. Never submit these as an instruction or action.
      _modelSpeech = session.transcripts.listen((text) {
        if (_epoch != epoch || _disposed) return;
        _lastAgentSpeech = text.length > 1200 ? text.substring(0, 1200) : text;
        _notify();
      });
      await session.start();
      await session.ready;
      if (_disposed || _epoch != epoch) return;
      _phase = PrivateVoicePhase.listening;
      _notify();
    } catch (_) {
      if (!_disposed && _epoch == epoch) {
        _error = 'Private voice could not start. Check your connection and permissions.';
        _phase = PrivateVoicePhase.unavailable;
        _notify();
      }
    } finally {
      if (_epoch == epoch) {
        _opening = false;
        if (_phase == PrivateVoicePhase.unavailable) {
          await stop(clearContext: false);
        }
      }
    }
  }

  /// Bind normal typed/tap Assistant even if the microphone is never started.
  Future<void> bindAssistantContext({
    required String accountId,
    required String characterId,
    required String characterSessionId,
  }) async {
    if (_disposed) return;
    if (_accountId == accountId && _characterId == characterId &&
        _characterSessionId == characterSessionId) return;
    await stop(clearContext: true);
    if (_disposed) return;
    _accountId = accountId;
    _characterId = characterId;
    _characterSessionId = characterSessionId;
    _notify();
  }

  /// Text, tap, and a *separate opt-in ASR integration* use the same draft.
  /// Gemini live output transcripts never enter this method automatically.
  void editDraft(String text, {bool recognizedSpeech = false}) {
    if (_outcomeUnknown) throw StateError('Reconcile or discard the uncertain draft first');
    if (_disposed || _accountId == null || _characterSessionId == null) {
      throw StateError('No active Assistant context');
    }
    if (text.length > 4000) throw ArgumentError('Draft is too long');
    _draft = text;
    _speechDraft = recognizedSpeech;
    _draftVersion++;
    _notify();
  }

  VoiceReviewDraft? review() {
    if (!hasDraft ||
        _accountId == null ||
        _characterId == null ||
        _characterSessionId == null) return null;
    return VoiceReviewDraft(
      accountId: _accountId!,
      characterId: _characterId!,
      characterSessionId: _characterSessionId!,
      text: _draft.trim(),
      version: _draftVersion,
      fromSpeech: _speechDraft,
    );
  }

  /// The caller must show review and use the canonical user-authenticated
  /// Assistant send/task confirmation; no implicit send from recognition.
  Future<bool> submitReviewed({
    required VoiceReviewDraft reviewed,
    required String currentAccountId,
    required String currentCharacterSessionId,
    required Future<void> Function(VoiceReviewDraft) submitToAssistant,
  }) async {
    if (_disposed ||
        reviewed.accountId != currentAccountId ||
        reviewed.characterSessionId != currentCharacterSessionId ||
        reviewed.accountId != _accountId ||
        reviewed.characterId != _characterId ||
        reviewed.characterSessionId != _characterSessionId ||
        reviewed.version != _draftVersion ||
        reviewed.text != _draft.trim() ||
        !hasDraft || _submitting || _outcomeUnknown) return false;
    _submitting = true;
    _notify();
    try {
      await submitToAssistant(reviewed);
      // If the canonical transport reports an ambiguous outcome, it MUST throw
      // and reconcile by request ID; never replay a financial/DM side effect.
      if (_disposed || reviewed.version != _draftVersion ||
          reviewed.accountId != _accountId) return false;
      _draft = '';
      _speechDraft = false;
      _outcomeUnknown = false;
      _draftVersion++;
      _notify();
      return true;
    } catch (_) {
      _outcomeUnknown = true;
      _error = 'Result uncertain. Check Assistant task status; do not retry this draft.';
      _notify();
      return false;
    } finally {
      _submitting = false;
      _notify();
    }
  }

  /// Discard the local uncertain draft only; never claim the server action
  /// was cancelled. A fresh task must use a new canonical request identity.
  void discardUncertainDraft() {
    if (!_outcomeUnknown || _submitting) return;
    _draft = '';
    _speechDraft = false;
    _outcomeUnknown = false;
    _draftVersion++;
    _notify();
  }

  /// Explicit microphone mute while retaining Gemini Live session context.
  Future<void> setMuted(bool muted) async {
    final live = _live;
    if (live == null || !isConnected || _disposed) return;
    final epoch = _epoch;
    try {
      await live.mute(muted);
      if (epoch != _epoch || _disposed) return;
      _muted = muted;
      _notify();
    } catch (_) {
      // A failed native mute cannot be treated as privacy success.
      _error = 'Could not change the microphone. Voice was stopped.';
      _notify();
      await stop(clearContext: false);
    }
  }

  /// Reconcile by the *canonical authenticated turn status*, never replay an
  /// uncertain voice-derived side effect. A switched account drops readback.
  Future<AgentTurnStatus?> readbackTurn({
    required String accountId,
    required String requestId,
  }) async {
    if (_disposed || _accountId != accountId || _characterId == null ||
        requestId.trim().isEmpty) return null;
    final epoch = _epoch;
    final characterId = _characterId!;
    final status = await _shell.turnStatus(characterId, requestId);
    if (_disposed || epoch != _epoch || _accountId != accountId ||
        _characterId != characterId) return null;
    return status;
  }

  Future<void> stop({bool clearContext = false}) async {
    ++_epoch; // invalidates late WebSocket grant and transcription callbacks
    _opening = false;
    final live = _live;
    _live = null;
    final lease = _lease;
    _lease = null;
    final states = _states;
    _states = null;
    final errors = _errors;
    _errors = null;
    final modelSpeech = _modelSpeech;
    _modelSpeech = null;
    await states?.cancel();
    await errors?.cancel();
    await modelSpeech?.cancel();
    try {
      await live?.close();
    } finally {
      await lease?.release();
    }
    if (clearContext) {
      _accountId = null;
      _characterId = null;
      _characterSessionId = null;
      _draft = '';
      _speechDraft = false;
      _outcomeUnknown = false;
      _draftVersion++;
      _lastAgentSpeech = null;
      _error = null;
    }
    _muted = false;
    _phase = PrivateVoicePhase.idle;
    _notify();
  }

  Future<void> onAccountChanged() => stop(clearContext: true);
  Future<void> onPublicAudioStarting() => _focus.setPublicAudioActive(true);
  Future<void> onPublicAudioEnded() => _focus.setPublicAudioActive(false);

  @override
  void dispose() {
    _disposed = true;
    ++_epoch;
    unawaited(stop(clearContext: true));
    super.dispose();
  }
}
