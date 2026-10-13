import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

/// Debug/profile-only milestones for a *single process launch*.
/// No user IDs, tokens, URLs, messages or other account data are logged.
/// Android's ActivityManager Displayed/fully-drawn measurements must also be
/// collected: this clock starts only after Dart main(), not at process launch.
class MasanawaStartupMetrics {
  MasanawaStartupMetrics._();

  static final Stopwatch _clock = Stopwatch()..start();
  static final Set<String> _emitted = <String>{};
  static final Set<String> _scheduled = <String>{};

  static void mark(String milestone) {
    if (kReleaseMode || !_emitted.add(milestone)) return;
    debugPrint(
      'MASANAWA_STARTUP milestone=$milestone dartElapsedMs=${_clock.elapsedMilliseconds}',
    );
  }

  static void afterFrame(String milestone) {
    if (kReleaseMode || _emitted.contains(milestone) ||
        !_scheduled.add(milestone)) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _scheduled.remove(milestone);
      mark(milestone);
    });
  }
}
