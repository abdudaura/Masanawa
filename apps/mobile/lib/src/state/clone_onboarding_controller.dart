import 'dart:async';

import '../agents/clone_onboarding.dart';
import '../core/request_id.dart';

/// One account/screen instance. Canonical drafts/confirmation live on the server.
class CloneOnboardingController {
  CloneOnboardingController({
    required this.transport,
    String Function()? requestId,
  }) : _requestId = requestId ?? createRequestId;
  final CloneOnboardingTransport transport;
  final String Function() _requestId;
  final _changes = StreamController<void>.broadcast(sync: true);
  Stream<void> get changes => _changes.stream;
  CloneOnboardingView? view;
  bool busy = false;
  bool needsReload = true;
  String? error;
  bool _disposed = false;
  int _generation = 0;
  String? _pendingRequestId;
  int? _pendingPreviewRevision;

  void _notify() {
    if (!_disposed) _changes.add(null);
  }

  Future<bool> _perform(
    Future<CloneOnboardingView> Function() operation,
  ) async {
    if (_disposed || busy) return false;
    busy = true;
    error = null;
    _notify();
    final generation = _generation;
    try {
      final result = await operation();
      if (_disposed || generation != _generation) return false;
      view = result;
      needsReload = false;
      if (result.confirmed) {
        _pendingRequestId = result.confirmationRequestId;
        _pendingPreviewRevision = result.confirmationPreviewRevision;
      } else if (result.state != 'preview' ||
          result.revision != _pendingPreviewRevision) {
        _pendingRequestId = null;
        _pendingPreviewRevision = null;
      }
      return true;
    } catch (_) {
      if (!_disposed && generation == _generation) {
        needsReload = true;
        error =
            'Setup could not be updated. Reload its saved status before continuing.';
      }
      return false;
    } finally {
      if (!_disposed && generation == _generation) {
        busy = false;
        _notify();
      }
    }
  }

  Future<bool> reload() => _perform(transport.read);
  Future<bool> save(Map<String, dynamic> profile) {
    if (needsReload || view?.confirmed == true) return Future.value(false);
    return _perform(
      () => transport.save(expectedRevision: view!.revision, profile: profile),
    );
  }

  Future<bool> preview() {
    final current = view;
    if (needsReload || current?.revision == null || current?.state != 'editing')
      return Future.value(false);
    return _perform(() => transport.preview(current!.revision!));
  }

  Future<bool> confirm() {
    final current = view;
    if (needsReload ||
        current == null ||
        !{'preview', 'confirmed'}.contains(current.state))
      return Future.value(false);
    final expected = current.confirmationPreviewRevision ?? current.revision!;
    if (_pendingPreviewRevision != expected) {
      _pendingPreviewRevision = expected;
      _pendingRequestId = current.confirmationRequestId ?? _requestId();
    }
    final id = current.confirmationRequestId ?? _pendingRequestId;
    if (id == null || !isCloneConfirmationRequestId(id))
      return Future.value(false);
    return _perform(
      () => transport.confirm(expectedPreviewRevision: expected, requestId: id),
    );
  }

  Future<bool> cancel() {
    final current = view;
    if (needsReload || current?.revision == null || current!.confirmed)
      return Future.value(false);
    return _perform(() => transport.cancel(current.revision!));
  }

  void dispose() {
    _disposed = true;
    _generation++;
    view = null;
    _pendingRequestId = null;
    _pendingPreviewRevision = null;
    _changes.close();
  }
}
