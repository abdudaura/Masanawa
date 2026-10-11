import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'masana_chat_api.dart';

enum ChatSendState { queued, sending, sent, failed }
class MasanaChatTurn {
  const MasanaChatTurn({
    required this.requestId, required this.text,
    required this.state, this.reply,
  });
  final String requestId;
  final String text;
  final ChatSendState state;
  final String? reply;
  MasanaChatTurn copy({ChatSendState? state, String? reply}) =>
      MasanaChatTurn(requestId: requestId, text: text,
        state: state ?? this.state, reply: reply ?? this.reply);
  Map<String, dynamic> toJson() => {
    'requestId': requestId, 'text': text,
    'state': state.name, if (reply != null) 'reply': reply,
  };
  static MasanaChatTurn? fromJson(Object? raw) {
    if (raw is! Map) return null;
    final id = raw['requestId'], text = raw['text'];
    if (id is! String || !id.startsWith('request_') ||
        text is! String || text.isEmpty || text.length > 32000) return null;
    final state = ChatSendState.values.where(
      (v) => v.name == raw['state'],
    ).firstOrNull;
    return MasanaChatTurn(
      requestId: id, text: text,
      state: state == ChatSendState.sent
          ? ChatSendState.sent : ChatSendState.queued,
      reply: raw['reply'] is String ? raw['reply'] as String : null,
    );
  }
}

/// Account and Masana are both part of the secure storage key.
class MasanaChatDraftStore {
  const MasanaChatDraftStore(this.storage);
  final FlutterSecureStorage storage;
  String _key(String a, String c) => 'masana.chat.v1:' + a + ':' + c;
  Future<Map<String, dynamic>?> read(String a, String c) async {
    final value = await storage.read(key: _key(a,c));
    if (value == null) return null;
    final decoded = jsonDecode(value);
    return decoded is Map<String, dynamic> ? decoded : null;
  }
  Future<void> write(String a, String c, Map<String, dynamic> data) =>
      storage.write(key: _key(a,c), value: jsonEncode(data));
  Future<void> clear(String a, String c) => storage.delete(key: _key(a,c));
}

/// FIFO: new sends may queue while the agent is replying. A failed turn blocks
/// subsequent turns until explicit retry with its ORIGINAL canonical request ID.
class MasanaChatController extends ChangeNotifier {
  MasanaChatController({
    required this.api, required this.drafts,
    required this.accountId, required this.characterId,
  });
  final MasanaChatApi api;
  final MasanaChatDraftStore drafts;
  final String accountId, characterId;
  final List<MasanaChatTurn> _turns = [];
  String? _sessionId;
  bool _busy = false, _disposed = false, _restored = false;
  int _generation = 0;
  Future<void>? _restorePending;
  Future<void> _writeTail = Future<void>.value();
  String? error;
  bool get busy => _busy;
  List<MasanaChatTurn> get turns => List.unmodifiable(_turns);
  void _notify() { if (!_disposed) notifyListeners(); }

  // Coalesce initial load: two synchronous callers must never overwrite a
  // freshly queued bubble with a second stale storage read.
  Future<void> restore() {
    if (_restored || _disposed) return Future<void>.value();
    return _restorePending ??= _loadSaved();
  }
  Future<void> _loadSaved() async {
    final generation = _generation;
    try {
      final saved = await drafts.read(accountId, characterId);
      if (_disposed || generation != _generation) return;
      final session = saved?['sessionId'];
      if (session is String && session.startsWith('character-session_')) {
        _sessionId = session;
      }
      final list = saved?['turns'];
      if (list is List) {
        _turns.clear();
        for (final value in list.take(100)) {
          final item = MasanaChatTurn.fromJson(value);
          if (item != null) _turns.add(item);
        }
      }
      _restored = true;
      _notify();
      unawaited(_drain());
    } catch (_) {
      if (_disposed || generation != _generation) return;
      error = 'Saved messages could not be read. Please retry.';
      _notify();
    } finally {
      _restorePending = null;
    }
  }
  Future<void> send(String raw) async {
    await restore();
    if (!_restored) return;
    final text = raw.trim();
    if (_disposed || text.isEmpty || text.length > 32000) return;
    _turns.add(MasanaChatTurn(
      requestId: newMasanaRequestId(),
      text: text, state: ChatSendState.queued,
    ));
    _notify();
    if (!await _persist()) return;
    unawaited(_drain());
  }
  Future<void> retry(String requestId) async {
    final i = _turns.indexWhere((v) =>
        v.requestId == requestId && v.state == ChatSendState.failed);
    if (i < 0) return;
    _turns[i] = _turns[i].copy(state: ChatSendState.queued);
    error = null;
    _notify();
    await _persist();
    unawaited(_drain());
  }
  // Serialize physical writes. Otherwise concurrent enqueue and completion
  // snapshots can finish out of order and silently lose an outbox entry.
  Future<bool> _persist() async {
    final snapshot = <String, dynamic>{
      'sessionId': _sessionId,
      'turns': _turns.map((v) => v.toJson()).toList(growable:false),
    };
    final write = _writeTail.then((_) =>
        drafts.write(accountId, characterId, snapshot));
    _writeTail = write.then<void>((_) {}, onError: (Object _, StackTrace __) {});
    try {
      await write;
      return true;
    } catch (_) {
      error = 'Offline messages cannot be saved on this device.';
      _notify();
      return false;
    }
  }
  Future<void> _drain() async {
    if (_busy || _disposed || !_restored) return;
    final generation = _generation;
    _busy = true;
    _notify();
    try {
      for (var i = 0; i < _turns.length; i++) {
        if (_disposed || generation != _generation ||
            _turns[i].state == ChatSendState.failed) break;
        if (_turns[i].state != ChatSendState.queued) continue;
        try {
          _sessionId ??= await api.open(characterId);
          if (_disposed || generation != _generation) return;
          if (!await _persist()) break;
          if (_disposed || generation != _generation) return;
          _turns[i] = _turns[i].copy(state: ChatSendState.sending);
          _notify();
          final reply = await api.turn(
            characterId:characterId,sessionId:_sessionId!,
            text:_turns[i].text,requestId:_turns[i].requestId,
          );
          if (_disposed || generation != _generation) return;
          _turns[i] = _turns[i].copy(state:ChatSendState.sent,reply:reply);
          error = null;
          if (!await _persist()) break;
          _notify();
        } catch (_) {
          if (_disposed || generation != _generation) return;
          _turns[i] = _turns[i].copy(state: ChatSendState.failed);
          error = 'Message not delivered. Check your connection and retry.';
          await _persist();
          _notify();
          break;
        }
      }
    } finally {
      _busy = false; _notify();
    }
  }
  Future<void> clearForAccountSwitch() async {
    _generation++;
    final session = _sessionId;
    _turns.clear(); _sessionId = null;
    // Drain earlier queued snapshot writes before deletion: a delayed save
    // must never resurrect messages after an account switch.
    await _writeTail;
    await drafts.clear(accountId, characterId);
    if (session != null) {
      try { await api.close(characterId,session); } catch (_) { /* expires */ }
    }
    _notify();
  }
  @override
  void dispose() { _disposed = true; super.dispose(); }
}

/// UUIDv7, compatible with canonical request_ IDs and stable across retries.
String newMasanaRequestId() {
  final random = Random.secure();
  final b = List<int>.generate(10, (_) => random.nextInt(256));
  final t = DateTime.now().millisecondsSinceEpoch.toRadixString(16).padLeft(12,'0');
  String h(int n,int size) => n.toRadixString(16).padLeft(size,'0');
  final third = '7' + h(((b[0]&15)<<8)|b[1],3);
  final fourth = h(0x8000|((b[2]&63)<<8)|b[3],4);
  final fifth = b.skip(4).map((v)=>h(v,2)).join();
  return 'request_' + t.substring(0,8) + '-' + t.substring(8) +
      '-' + third + '-' + fourth + '-' + fifth;
}
