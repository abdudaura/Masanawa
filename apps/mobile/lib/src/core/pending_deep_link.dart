import 'shell_deep_link.dart';

/// Keeps the latest user-selected destination through startup and sign-in.
class PendingDeepLink {
  Uri? _pending;

  void offer(Uri uri) {
    if (shellDeepLinkRoute(uri) != null) _pending = uri;
  }

  Uri? take({required bool ready}) {
    if (!ready) return null;
    final value = _pending;
    _pending = null;
    return value;
  }

  void clear() => _pending = null;
}
