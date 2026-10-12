import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../agents/masanawa_transport.dart';
import '../state/session_state.dart';

class CallLifecycleOwner {
  const CallLifecycleOwner(this.accountId, this.accessToken);
  final String accountId;
  final String accessToken;
}

abstract interface class CallLifecycleStore {
  Future<String?> read();
  Future<void> write(String value);
}

class SecureCallLifecycleStore implements CallLifecycleStore {
  const SecureCallLifecycleStore();
  static const _storage = FlutterSecureStorage();
  static const _key = 'native_call_history_outbox_v1';
  @override
  Future<String?> read() => _storage.read(key: _key);
  @override
  Future<void> write(String value) => _storage.write(key: _key, value: value);
}

typedef CallLifecycleSend =
    Future<void> Function(
      CallLifecycleOwner owner,
      String callId,
      String event,
    );

/// Only account identifiers, call identifiers and lifecycle events reach disk.
/// A private transport pins each request's bearer and has no auth interceptor.
class CallLifecycleReporter {
  CallLifecycleReporter({
    required this.store,
    required this.readOwner,
    required this.send,
    this.onHistoryChanged,
    this.capacity = 128,
  });
  final CallLifecycleStore store;
  final CallLifecycleOwner? Function() readOwner;
  final CallLifecycleSend send;
  final void Function()? onHistoryChanged;
  final int capacity;
  final List<Map<String, String>> _queue = [];
  static final _validId = RegExp(r'^[A-Za-z0-9_-]{1,160}$');
  bool _valid(String value) => _validId.hasMatch(value);
  String _now() => DateTime.now().toUtc().toIso8601String();
  bool _fresh(Map<String, String> event) {
    final created = DateTime.tryParse(event['createdAt'] ?? '');
    return created != null &&
        DateTime.now().toUtc().difference(created) < const Duration(hours: 24);
  }

  Future<void> _serial = Future<void>.value();
  bool _loaded = false;
  CallLifecycleOwner? captureOwner() => readOwner();
  CallLifecycleBinding bind(CallLifecycleOwner owner, String? callId) =>
      CallLifecycleBinding._(this, owner, callId);

  Future<void> _run(Future<void> Function() action) {
    final next = _serial.then((_) => action());
    // Storage/network failure never escapes into audio setup or teardown.
    _serial = next.catchError((Object _) {});
    return _serial;
  }

  Future<void> _load() async {
    if (_loaded) return;
    final raw = await store.read();
    if (raw != null) {
      try {
        final decoded = jsonDecode(raw);
        if (decoded is List) {
          for (final item in decoded.take(capacity)) {
            if (item is Map &&
                item['accountId'] is String &&
                item['callId'] is String &&
                _valid(item['accountId']) &&
                _valid(item['callId']) &&
                (item['event'] == 'connected' || item['event'] == 'end')) {
              _queue.add({
                'accountId': item['accountId'],
                'callId': item['callId'],
                'event': item['event'],
                'createdAt': item['createdAt'] is String
                    ? item['createdAt']
                    : _now(),
              });
            }
          }
        }
      } catch (_) {
        /* Corrupt metadata is advisory, never audio authority. */
      }
    }
    _loaded = true;
  }

  Future<void> _save() => store.write(jsonEncode(_queue));
  Future<void> report(
    CallLifecycleOwner owner,
    String callId,
    String event,
  ) => _run(() async {
    await _load();
    if (!_valid(owner.accountId) || !_valid(callId)) return;
    if (!_queue.any(
      (e) =>
          e['accountId'] == owner.accountId &&
          e['callId'] == callId &&
          e['event'] == event,
    )) {
      // Evict a whole old call, preserving connected/end ordering for survivors.
      while (_queue.length >= capacity && _queue.isNotEmpty) {
        final oldest = _queue.first;
        _queue.removeWhere(
          (e) =>
              e['accountId'] == oldest['accountId'] &&
              e['callId'] == oldest['callId'],
        );
      }
      _queue.add({
        'accountId': owner.accountId,
        'callId': callId,
        'event': event,
        'createdAt': _now(),
      });
      await _save();
    }
    await _flush();
  });
  Future<void> flush() => _run(() async {
    await _load();
    await _flush();
  });

  Future<void> _flush() async {
    _queue.removeWhere((event) => !_fresh(event));
    await _save();
    while (true) {
      final owner = readOwner();
      if (owner == null) return;
      final index = _queue.indexWhere((e) => e['accountId'] == owner.accountId);
      if (index < 0) return;
      final event = _queue[index];
      try {
        await send(
          owner,
          event['callId']!,
          event['event']!,
        ).timeout(const Duration(seconds: 15));
      } on DioException catch (error) {
        final status = error.response?.statusCode;
        if (status != 403 && status != 404 && status != 410) return;
        if (readOwner()?.accountId != owner.accountId) return;
        _queue.removeWhere(
          (e) =>
              e['accountId'] == owner.accountId &&
              e['callId'] == event['callId'],
        );
        await _save();
        continue;
      } catch (_) {
        return;
      }
      // A response arriving after logout/switch cannot mutate another account.
      if (readOwner()?.accountId != owner.accountId) return;
      _queue.removeAt(index);
      await _save();
      try {
        onHistoryChanged?.call();
      } catch (_) {}
    }
  }
}

class CallLifecycleBinding {
  CallLifecycleBinding._(this._reporter, this.owner, this.callId);
  final CallLifecycleReporter _reporter;
  final CallLifecycleOwner owner;
  final String? callId;
  bool _connected = false;
  bool _closed = false;
  Future<void> connected() async {
    if (_connected || _closed || callId == null) return;
    _connected = true;
    await _reporter.report(owner, callId!, 'connected');
  }

  Future<void> closed() async {
    if (_closed || callId == null) return;
    _closed = true;
    await _reporter.report(owner, callId!, 'end');
  }
}

final callHistoryRevisionProvider = StateProvider<int>((ref) => 0);
final callLifecycleReporterProvider = Provider<CallLifecycleReporter>((ref) {
  CallLifecycleOwner? owner() {
    final session = ref.read(sessionProvider);
    if (session is! SessionSignedIn || session.tokens.accessToken.isEmpty) {
      return null;
    }
    return CallLifecycleOwner(session.user.id, session.tokens.accessToken);
  }

  final dio = Dio(
    BaseOptions(
      baseUrl: kAgentBaseUrl,
      connectTimeout: const Duration(seconds: 10),
      sendTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 15),
      followRedirects: false,
    ),
  );
  final reporter = CallLifecycleReporter(
    store: const SecureCallLifecycleStore(),
    readOwner: owner,
    send: (owner, callId, event) async {
      await dio.post(
        '/v1/calls/${Uri.encodeComponent(callId)}/$event',
        data: {},
        options: Options(
          headers: {'Authorization': 'Bearer ${owner.accessToken}'},
        ),
      );
    },
    onHistoryChanged: () =>
        ref.read(callHistoryRevisionProvider.notifier).state++,
  );
  ref.listen(sessionProvider, (_, __) {
    unawaited(reporter.flush());
  });
  final observer = _ResumeObserver(reporter);
  WidgetsBinding.instance.addObserver(observer);
  final retry = Timer.periodic(const Duration(seconds: 30), (_) {
    final state = WidgetsBinding.instance.lifecycleState;
    if (state == null || state == AppLifecycleState.resumed) {
      unawaited(reporter.flush());
    }
  });
  ref.onDispose(() {
    WidgetsBinding.instance.removeObserver(observer);
    retry.cancel();
    dio.close();
  });
  unawaited(reporter.flush());
  return reporter;
});

class _ResumeObserver extends WidgetsBindingObserver {
  _ResumeObserver(this.reporter);
  final CallLifecycleReporter reporter;
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) unawaited(reporter.flush());
  }
}
