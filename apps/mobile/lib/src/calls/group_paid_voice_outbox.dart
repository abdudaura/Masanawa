import 'dart:async';
import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../core/network/api_client.dart';
import '../state/session_state.dart';
import '../state/wallet_state.dart';
import '../voice/paid_voice.dart';
import 'call_lifecycle_reporter.dart' show CallLifecycleOwner;

abstract interface class GroupPaidVoiceStore {
  Future<String?> read();
  Future<void> write(String value);
}

class SecureGroupPaidVoiceStore implements GroupPaidVoiceStore {
  const SecureGroupPaidVoiceStore();
  static const _storage = FlutterSecureStorage();
  static const _key = 'group_paid_voice_completion_v1';
  @override
  Future<String?> read() => _storage.read(key: _key);
  @override
  Future<void> write(String value) => _storage.write(key: _key, value: value);
}

class GroupPaidVoiceStartExpired implements Exception {
  const GroupPaidVoiceStartExpired();
}

typedef GroupPaidVoiceSend =
    Future<void> Function(
      CallLifecycleOwner owner,
      String admissionId,
      String outcome,
    );
typedef GroupPaidVoiceResolveStart =
    Future<PaidVoiceAdmission> Function(
      CallLifecycleOwner owner,
      String characterId,
      String quoteId,
    );

/// Journal consented starts before the canonical idempotent start endpoint and
/// reservations before media. Restart replays the same quote then completes
/// interrupted; it never opens a socket. No credential/audio reaches storage.
class GroupPaidVoiceOutbox {
  GroupPaidVoiceOutbox({
    required this.store,
    required this.readOwner,
    required this.send,
    this.resolveStart,
    this.capacity = 128,
    this.onCompleted,
  });
  final GroupPaidVoiceStore store;
  final CallLifecycleOwner? Function() readOwner;
  final GroupPaidVoiceSend send;
  final GroupPaidVoiceResolveStart? resolveStart;
  final int capacity;
  final void Function()? onCompleted;
  final List<Map<String, String>> _queue = [];
  final Set<String> _active = {};
  Future<void> _serial = Future.value();
  Future<void>? _flushing;
  bool _loaded = false, _flushAgain = false;
  String _key(String account, String id) => '$account/$id';
  String _entryKey(Map<String, String> e) => _key(
    e['accountId']!,
    e['kind'] == 'start' ? 'start:${e['quoteId']}' : e['admissionId']!,
  );
  bool _valid(String value) =>
      RegExp(r'^[A-Za-z0-9_-]{1,160}$').hasMatch(value);
  Future<T> _run<T>(Future<T> Function() action) {
    final next = _serial.then((_) => action());
    _serial = next.then<void>((_) {}, onError: (Object _, StackTrace _) {});
    return next;
  }

  Future<void> _load() async {
    if (_loaded) return;
    final raw = await store.read();
    if (raw != null) {
      final data = jsonDecode(raw);
      if (data is! List || data.length > capacity) {
        throw const FormatException('Invalid voice reconciliation storage');
      }
      final loaded = <Map<String, String>>[];
      for (final item in data) {
        if (item is! Map ||
            item['accountId'] is! String ||
            !_valid(item['accountId'] as String)) {
          throw const FormatException('Invalid voice reconciliation account');
        }
        if (item['kind'] == 'start') {
          if (item['characterId'] is! String ||
              item['quoteId'] is! String ||
              !_valid(item['characterId'] as String) ||
              !_valid(item['quoteId'] as String)) {
            throw const FormatException('Invalid voice start intent');
          }
          loaded.add({
            'kind': 'start',
            'accountId': item['accountId'] as String,
            'characterId': item['characterId'] as String,
            'quoteId': item['quoteId'] as String,
          });
        } else {
          if (item['admissionId'] is! String ||
              !_valid(item['admissionId'] as String) ||
              !const ['completed', 'interrupted'].contains(item['outcome'])) {
            throw const FormatException('Invalid voice completion');
          }
          loaded.add({
            'kind': 'complete',
            'accountId': item['accountId'] as String,
            'admissionId': item['admissionId'] as String,
            'outcome': item['outcome'] as String,
          });
        }
      }
      _queue.addAll(loaded);
    }
    _loaded = true;
  }

  Future<void> _saveMutation(void Function() mutate) async {
    final previous = [..._queue];
    mutate();
    try {
      await store.write(jsonEncode(_queue));
    } catch (_) {
      _queue.clear();
      _queue.addAll(previous);
      rethrow;
    }
  }

  Future<void> prepareStart(
    String accountId,
    String characterId,
    String quoteId,
  ) => _run(() async {
    if (!_valid(accountId) || !_valid(characterId) || !_valid(quoteId)) {
      throw const FormatException('Invalid voice consent identity');
    }
    await _load();
    final key = _key(accountId, 'start:$quoteId');
    if (!_queue.any((e) => _entryKey(e) == key)) {
      if (_queue.length >= capacity) {
        throw StateError(
          'Resolve earlier voice calls before reserving another.',
        );
      }
      await _saveMutation(
        () => _queue.add({
          'kind': 'start',
          'accountId': accountId,
          'characterId': characterId,
          'quoteId': quoteId,
        }),
      );
    }
    _active.add(key);
  });
  Future<void> abandonStart(String accountId, String quoteId) async {
    await _run(() async {
      _active.remove(_key(accountId, 'start:$quoteId'));
    });
    unawaited(flush());
  }

  Future<void> register(
    String accountId,
    String admissionId, {
    String? quoteId,
  }) => _register(accountId, admissionId, quoteId: quoteId, active: true);
  Future<void> _register(
    String accountId,
    String admissionId, {
    String? quoteId,
    required bool active,
  }) => _run(() async {
    if (!_valid(accountId) || !_valid(admissionId)) {
      throw const FormatException('Invalid voice reservation identity');
    }
    await _load();
    final intent = quoteId == null
        ? -1
        : _queue.indexWhere(
            (e) =>
                e['kind'] == 'start' &&
                e['accountId'] == accountId &&
                e['quoteId'] == quoteId,
          );
    final existing = _queue.indexWhere(
      (e) =>
          e['kind'] != 'start' &&
          e['accountId'] == accountId &&
          e['admissionId'] == admissionId,
    );
    if (intent < 0 && existing < 0 && _queue.length >= capacity) {
      throw StateError('Voice reconciliation is full.');
    }
    final entry = {
      'kind': 'complete',
      'accountId': accountId,
      'admissionId': admissionId,
      'outcome': 'interrupted',
    };
    await _saveMutation(() {
      if (intent >= 0) _queue.removeAt(intent);
      if (existing < 0) _queue.add(entry);
    });
    if (quoteId != null) _active.remove(_key(accountId, 'start:$quoteId'));
    if (active) _active.add(_key(accountId, admissionId));
  });
  Future<void> complete(
    String accountId,
    String admissionId,
    String outcome,
  ) async {
    if (!const ['completed', 'interrupted'].contains(outcome)) {
      throw StateError('Invalid completion outcome.');
    }
    try {
      await _run(() async {
        await _load();
        final index = _queue.indexWhere(
          (e) =>
              e['kind'] != 'start' &&
              e['accountId'] == accountId &&
              e['admissionId'] == admissionId,
        );
        if (index < 0) throw StateError('Voice reservation was not persisted.');
        await _saveMutation(
          () => _queue[index] = {..._queue[index], 'outcome': outcome},
        );
      });
    } finally {
      _active.remove(_key(accountId, admissionId));
      unawaited(flush());
    }
  }

  Future<void> flush() {
    final active = _flushing;
    if (active != null) {
      _flushAgain = true;
      return active;
    }
    return _flushing = _flushAndRepeat();
  }

  Future<void> _flushAndRepeat() async {
    try {
      for (var pass = 0; pass < 2; pass++) {
        _flushAgain = false;
        await _drain();
        if (!_flushAgain) break;
      }
    } finally {
      _flushing = null;
    }
  }

  Future<void> _drain() async {
    try {
      for (var attempt = 0; attempt < 4; attempt++) {
        final owner = readOwner();
        if (owner == null || owner.accessToken.isEmpty) return;
        final entry = await _run<Map<String, String>?>(() async {
          await _load();
          for (final e in _queue) {
            if (e['accountId'] == owner.accountId &&
                !_active.contains(_entryKey(e))) {
              return Map.of(e);
            }
          }
          return null;
        });
        if (entry == null || readOwner()?.accountId != owner.accountId) return;
        if (entry['kind'] == 'start') {
          final resolver = resolveStart;
          if (resolver == null) return;
          late final PaidVoiceAdmission admission;
          try {
            admission = await resolver(
              owner,
              entry['characterId']!,
              entry['quoteId']!,
            ).timeout(const Duration(seconds: 12));
          } on GroupPaidVoiceStartExpired {
            await _run(() async {
              await _saveMutation(
                () => _queue.removeWhere(
                  (e) =>
                      e['kind'] == 'start' &&
                      e['accountId'] == entry['accountId'] &&
                      e['quoteId'] == entry['quoteId'],
                ),
              );
            });
            continue;
          }
          if (admission.characterId != entry['characterId'] ||
              admission.quoteId != entry['quoteId']) {
            throw const FormatException(
              'Voice recovery does not match consent',
            );
          }
          await _register(
            owner.accountId,
            admission.admissionId,
            quoteId: entry['quoteId'],
            active: false,
          );
          continue;
        }
        await send(
          owner,
          entry['admissionId']!,
          entry['outcome']!,
        ).timeout(const Duration(seconds: 12));
        if (readOwner()?.accountId != owner.accountId) return;
        await _run(() async {
          final index = _queue.indexWhere(
            (e) =>
                e['kind'] != 'start' &&
                e['accountId'] == entry['accountId'] &&
                e['admissionId'] == entry['admissionId'] &&
                e['outcome'] == entry['outcome'],
          );
          if (index >= 0) await _saveMutation(() => _queue.removeAt(index));
        });
        onCompleted?.call();
      }
    } catch (_) {
      /* Durable entries remain for the next matching session. */
    }
  }
}

final groupPaidVoiceOutboxProvider = Provider<GroupPaidVoiceOutbox>((ref) {
  CallLifecycleOwner? owner() {
    final session = ref.read(sessionProvider);
    if (session is! SessionSignedIn) return null;
    return CallLifecycleOwner(session.user.id, session.tokens.accessToken);
  }

  final dio = Dio(
    BaseOptions(
      baseUrl: kApiBaseUrl,
      connectTimeout: const Duration(seconds: 10),
      sendTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
      followRedirects: false,
    ),
  );
  final outbox = GroupPaidVoiceOutbox(
    store: const SecureGroupPaidVoiceStore(),
    readOwner: owner,
    onCompleted: () => unawaited(ref.read(walletProvider.notifier).refresh()),
    resolveStart: (owner, characterId, quoteId) async {
      late final Response<dynamic> result;
      try {
        result = await dio.post<dynamic>(
          '/agent/twin/voice/start',
          data: {
            'characterId': characterId,
            'quoteId': quoteId,
            'accepted': true,
          },
          options: Options(
            headers: {'Authorization': 'Bearer ${owner.accessToken}'},
          ),
        );
      } on DioException catch (error) {
        if (error.response?.statusCode == 410) {
          throw const GroupPaidVoiceStartExpired();
        }
        rethrow;
      }
      if (result.data is! Map) {
        throw const FormatException('Invalid voice recovery response');
      }
      return PaidVoiceAdmission.fromJson(
        (result.data as Map).cast<String, dynamic>(),
      );
    },
    send: (owner, id, outcome) async {
      await dio.post(
        '/agent/twin/voice/${Uri.encodeComponent(id)}/complete',
        data: {'outcome': outcome},
        options: Options(
          headers: {'Authorization': 'Bearer ${owner.accessToken}'},
        ),
      );
    },
  );
  ref.listen(sessionProvider, (_, _) => unawaited(outbox.flush()));
  final observer = _GroupPaidResumeObserver(outbox);
  WidgetsBinding.instance.addObserver(observer);
  final timer = Timer.periodic(const Duration(seconds: 30), (_) {
    final state = WidgetsBinding.instance.lifecycleState;
    if (state == null || state == AppLifecycleState.resumed) {
      unawaited(outbox.flush());
    }
  });
  ref.onDispose(() {
    timer.cancel();
    WidgetsBinding.instance.removeObserver(observer);
    dio.close();
  });
  unawaited(outbox.flush());
  return outbox;
});

class _GroupPaidResumeObserver extends WidgetsBindingObserver {
  _GroupPaidResumeObserver(this.outbox);
  final GroupPaidVoiceOutbox outbox;
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) unawaited(outbox.flush());
  }
}
