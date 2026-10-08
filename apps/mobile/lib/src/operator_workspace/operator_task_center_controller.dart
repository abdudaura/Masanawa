import 'package:flutter/foundation.dart';

import 'operator_task_contract.dart';

/// Server-authoritative, account-fenced U03 task list. This controller has no
/// executor, approval-token storage, wallet provider or independent chat state.
/// C07 remains the sole Gwani/Gwana message/persona controller.
class OperatorTaskCenterController extends ChangeNotifier {
  OperatorTaskCenterController({
    required String tenantId,
    required String userId,
    required OperatorTaskTransport transport,
  })  : _tenantId = tenantId,
        _userId = userId,
        _transport = transport;

  static const pageSize = 25;
  OperatorTaskTransport _transport;
  String _tenantId;
  String _userId;
  int _generation = 0;
  bool _disposed = false;
  bool busy = false;
  bool loadingMore = false;
  bool acting = false;
  bool hasMore = true;
  bool initialized = false;
  String? error;
  String? notice;
  String? selectedId;
  String? _before;
  List<OperatorTaskSnapshot> tasks = const [];
  List<OperatorTaskEvent> selectedEvents = const [];
  final Set<String> _busyTasks = <String>{};

  String get userId => _userId;
  String get tenantId => _tenantId;
  bool get isBound => _tenantId.isNotEmpty && _userId.isNotEmpty;
  bool taskBusy(String id) => _busyTasks.contains(id);
  OperatorTaskSnapshot? get selected {
    for (final task in tasks) {
      if (task.taskId == selectedId) return task;
    }
    return null;
  }

  List<OperatorTaskSnapshot> get active => List.unmodifiable(tasks.where(
      (task) => !task.isTerminal && !task.needsApproval));
  List<OperatorTaskSnapshot> get needsApproval => List.unmodifiable(
      tasks.where((task) => task.needsApproval));
  List<OperatorTaskSnapshot> get history =>
      List.unmodifiable(tasks.where((task) => task.isTerminal));

  bool _current(int generation) => !_disposed && _generation == generation;
  void _emit() {
    if (!_disposed) notifyListeners();
  }

  /// Old in-flight reads never populate the next account's UI. No local disk
  /// projection survives signout; the host injects a new authenticated
  /// transport when changing the network session.
  void changeOwner({required String tenantId, required String userId,
      required OperatorTaskTransport transport}) {
    if (_disposed) return;
    ++_generation;
    _tenantId = tenantId;
    _userId = userId;
    _transport = transport; // Never reuse the previous account's authenticated client.
    _reset();
    _emit();
  }

  void _reset() {
    tasks = const [];
    selectedEvents = const [];
    selectedId = null;
    _before = null;
    _busyTasks.clear();
    initialized = false;
    hasMore = true;
    busy = false;
    acting = false;
    loadingMore = false;
    error = null;
    notice = null;
  }

  void _assertOwned(OperatorTaskSnapshot task) {
    if (task.tenantId != _tenantId || task.userId != _userId) {
      throw const FormatException('Task owner did not match session');
    }
  }

  List<OperatorTaskSnapshot> _validatePage(
      List<OperatorTaskSnapshot> rows) {
    if (rows.length > pageSize) {
      throw const FormatException('Task page exceeded requested limit');
    }
    final ids = <String>{};
    for (final row in rows) {
      _assertOwned(row);
      if (!ids.add(row.taskId)) {
        throw const FormatException('Duplicate task in server page');
      }
    }
    return rows;
  }

  void _mergeTask(OperatorTaskSnapshot row) {
    _assertOwned(row);
    final old = tasks.where((task) => task.taskId == row.taskId).toList();
    if (old.isNotEmpty && row.version < old.single.version) return;
    if (old.isNotEmpty && row.version == old.single.version &&
        (row.phase != old.single.phase ||
         row.receiptRef != old.single.receiptRef ||
         row.operationId != old.single.operationId ||
         row.errorCode != old.single.errorCode)) {
      throw const FormatException('Same revision has conflicting state');
    }
    final merged = <String, OperatorTaskSnapshot>{
      for (final task in tasks) task.taskId: task,
      row.taskId: row,
    };
    final ordered = merged.values.toList()
      ..sort((a, b) {
        final time = b.createdAt.compareTo(a.createdAt);
        return time != 0 ? time : b.taskId.compareTo(a.taskId);
      });
    tasks = List.unmodifiable(ordered);
  }

  /// Always refetches authoritative recent tasks after restart/resume.
  Future<void> refresh() async {
    if (_disposed || !isBound || busy || acting) return;
    final generation = ++_generation;
    busy = true;
    error = null;
    _emit();
    try {
      final rows = _validatePage(await _transport.list(limit: pageSize));
      if (!_current(generation)) return;
      tasks = List.unmodifiable(rows);
      initialized = true;
      hasMore = rows.length == pageSize;
      _before = rows.isEmpty ? null : rows.last.taskId; // U02 before=taskId.
      selectedEvents = const [];
      if (!tasks.any((task) => task.taskId == selectedId)) {
        selectedId = null;
      }
    } catch (_) {
      if (!_current(generation)) return;
      // An offline error does not convert any task into a success.
      error = 'Tasks could not be refreshed. Reconnect and try again.';
      initialized = true;
    } finally {
      if (_current(generation)) {
        busy = false;
        _emit();
      }
    }
  }

  Future<void> loadMore() async {
    if (_disposed || !isBound || busy || acting ||
        loadingMore || !hasMore || _before == null) return;
    final generation = _generation;
    final cursor = _before;
    loadingMore = true;
    error = null;
    _emit();
    try {
      final rows = _validatePage(
          await _transport.list(limit: pageSize, before: cursor));
      if (!_current(generation)) return;
      if (rows.isNotEmpty && rows.last.taskId == cursor) {
        throw const FormatException('Nonadvancing task cursor');
      }
      // Historical page must not roll back a task updated concurrently.
      for (final row in rows) {
        _mergeTask(row);
      }
      hasMore = rows.length == pageSize;
      _before = rows.isEmpty ? null : rows.last.taskId;
    } catch (_) {
      if (_current(generation)) {
        error = 'Older tasks are unavailable. Your current tasks were kept.';
      }
    } finally {
      if (_current(generation)) {
        loadingMore = false;
        _emit();
      }
    }
  }

  Future<OperatorTaskSnapshot?> readback(String taskId) async {
    if (_disposed || !isBound || taskId.isEmpty ||
        _busyTasks.contains(taskId)) return null;
    final generation = _generation;
    _busyTasks.add(taskId);
    acting = true;
    error = null;
    _emit();
    try {
      final result = await _transport.read(taskId);
      if (!_current(generation)) return null;
      if (result.taskId != taskId) throw const FormatException('Wrong task ID');
      _mergeTask(result);
      notice = result.isUncertain
          ? 'Outcome is still uncertain. Status was checked, not resubmitted.'
          : 'Latest server status received.';
      return result;
    } catch (_) {
      if (_current(generation)) {
        error = 'Cannot verify task status. No operation was retried.';
      }
      return null;
    } finally {
      if (_current(generation)) {
        _busyTasks.remove(taskId);
        acting = _busyTasks.isNotEmpty;
        _emit();
      }
    }
  }

  /// Only an explicit user action may ask U02 to cancel a pending,
  /// reversible task; never infer cancellation on Back/persona change.
  Future<bool> cancel(String taskId) async {
    if (_disposed || !isBound || _busyTasks.contains(taskId)) return false;
    final task = tasks.where((row) => row.taskId == taskId).toList();
    if (task.length != 1 || !task.single.mayRequestCancel) return false;
    final generation = _generation;
    _busyTasks.add(taskId);
    acting = true;
    error = null;
    _emit();
    try {
      final result = await _transport.cancel(taskId,
          expectedVersion: task.single.version);
      if (!_current(generation)) return false;
      if (result.taskId != taskId || result.version < task.single.version) {
        throw const FormatException('Invalid cancel readback');
      }
      _mergeTask(result);
      notice = result.phase == OperatorTaskPhase.cancelled
          ? 'Server confirmed cancellation.'
          : 'The server did not confirm cancellation. Check status.';
      return result.phase == OperatorTaskPhase.cancelled;
    } catch (_) {
      if (_current(generation)) {
        error = 'Cancellation was not confirmed. Check the task status.';
      }
      return false;
    } finally {
      if (_current(generation)) {
        _busyTasks.remove(taskId);
        acting = _busyTasks.isNotEmpty;
        _emit();
      }
    }
  }

  Future<void> inspect(String taskId) async {
    if (_disposed || !isBound) return;
    selectedId = taskId;
    selectedEvents = const [];
    _emit();
    final task = await readback(taskId);
    if (task == null || selectedId != taskId) return;
    final generation = _generation;
    try {
      final rows = await _transport.events(taskId,
          afterVersion: 0, limit: 50);
      if (!_current(generation) || selectedId != taskId) return;
      var expected = 1;
      for (final event in rows) {
        if (event.taskId != taskId || event.version != expected++) {
          throw const FormatException('Untrusted event history');
        }
      }
      selectedEvents = List.unmodifiable(rows);
      _emit();
    } catch (_) {
      if (_current(generation) && selectedId == taskId) {
        error = 'Task loaded, but its event history is unavailable.';
        _emit();
      }
    }
  }

  void closeDetails() {
    if (_disposed) return;
    selectedId = null;
    selectedEvents = const [];
    _emit();
  }

  /// Fetch fresh authoritative status before external secure review. This
  /// never returns or manufactures an approval token from a model response.
  Future<OperatorTaskSnapshot?> getApprovalReview(String taskId) async {
    final task = await readback(taskId);
    if (task == null || !task.needsApproval) return null;
    if (task.approvalExpiresAt != null &&
        !task.approvalExpiresAt!.isAfter(DateTime.now().toUtc())) {
      error = 'Approval expired. Ask the server for new terms.';
      _emit();
      return null;
    }
    return task;
  }

  @override
  void dispose() {
    _disposed = true;
    ++_generation;
    super.dispose();
  }
}
