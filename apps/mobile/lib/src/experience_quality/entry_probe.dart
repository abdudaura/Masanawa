import 'experience_metrics.dart';

/// An entry's generation token fences stale asynchronous completions.
/// The shell must call completeUsable ONLY after the relevant authentic
/// screen/data is usable; completing a loading placeholder is not evidence.
final class ExperienceEntryProbe {
  ExperienceEntryProbe(this.metrics);
  final ExperienceMetrics metrics;
  int _generation = 0;
  int? _active;
  ExperienceJourney? _journey;
  Stopwatch? _watch;

  int start(ExperienceJourney journey) {
    _generation += 1;
    _active = _generation;
    _journey = journey;
    _watch = Stopwatch()..start();
    return _generation;
  }

  /// Return false for an obsolete/revoked request without recording success.
  /// Unknown network response size stays null rather than becoming zero.
  bool completeUsable(int token, {int? responseBytes}) {
    if (_active != token || _journey == null || _watch == null) {
      return false;
    }
    _watch!.stop();
    metrics.record(_journey!,
        elapsedMicros: _watch!.elapsedMicroseconds,
        responseBytes: responseBytes);
    _revoke();
    return true;
  }

  void fail(int token) {
    if (_active == token) _revoke();
  }

  /// On auth transition, release unfinished work and all previous account
  /// measurements. Never cross account-scoped usability timing.
  void resetForAccountChange() {
    _revoke();
    metrics.clear();
  }

  void _revoke() {
    _watch?.stop();
    _active = null;
    _journey = null;
    _watch = null;
  }
}
