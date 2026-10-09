import 'dart:math' as math;

/// Lightweight opt-in local measurements; no identifiers, messages, raw HTTP
/// payloads, token strings, telemetry upload or benchmark fabrication.
enum ExperienceJourney { cachedChatsEntry, assistantEntry, talksEntry }

final class ExperienceSample {
  const ExperienceSample({required this.elapsedMicros, this.responseBytes});
  final int elapsedMicros;
  /// Null = size not measured; 0 = verified empty body.
  final int? responseBytes;
}

final class ExperienceDistribution {
  const ExperienceDistribution({
    required this.count,
    required this.p50Micros,
    required this.p95Micros,
    required this.totalResponseBytes,
    required this.measuredResponseCount,
  });

  final int count;
  /// Null when count is zero, never a fabricated "zero latency".
  final int? p50Micros;
  final int? p95Micros;
  final int totalResponseBytes;
  final int measuredResponseCount;

  bool get hasLatencyEvidence => count > 0;
  bool get hasNetworkEvidence => measuredResponseCount > 0;
}

final class ExperienceMetrics {
  ExperienceMetrics({this.maxSamplesPerJourney = 120}) {
    if (maxSamplesPerJourney < 1 || maxSamplesPerJourney > 2000) {
      throw RangeError.range(maxSamplesPerJourney, 1, 2000, 'maxSamplesPerJourney');
    }
  }
  final int maxSamplesPerJourney;
  final Map<ExperienceJourney, List<ExperienceSample>> _samples = {};

  /// Caller must only pass real measured bytes for a completed response.
  /// This records no URL/headers/body nor any account identifier.
  void record(
    ExperienceJourney journey, {
    required int elapsedMicros,
    int? responseBytes,
  }) {
    if (elapsedMicros < 0 || responseBytes != null && responseBytes < 0) {
      throw ArgumentError('Measurement values must be nonnegative');
    }
    final values = _samples.putIfAbsent(journey, () => <ExperienceSample>[]);
    values.add(ExperienceSample(
      elapsedMicros: elapsedMicros,
      responseBytes: responseBytes,
    ));
    if (values.length > maxSamplesPerJourney) {
      values.removeAt(0);
    }
  }

  /// Measures only successfully resolved work. Exceptions are rethrown; a
  /// failed request is not silently counted as a usable screen.
  Future<T> measure<T>(
    ExperienceJourney journey,
    Future<T> Function() work, {
    int? Function(T value)? responseSize,
  }) async {
    final watch = Stopwatch()..start();
    try {
      final result = await work();
      watch.stop();
      final bytes = responseSize?.call(result);
      record(journey, elapsedMicros: watch.elapsedMicroseconds,
          responseBytes: bytes);
      return result;
    } catch (_) {
      watch.stop();
      rethrow;
    }
  }

  ExperienceDistribution summarize(ExperienceJourney journey) {
    final values = _samples[journey] ?? const <ExperienceSample>[];
    if (values.isEmpty) {
      return const ExperienceDistribution(count: 0, p50Micros: null,
          p95Micros: null, totalResponseBytes: 0, measuredResponseCount: 0);
    }
    final ordered = values.map((v) => v.elapsedMicros).toList()..sort();
    int percentile(double p) =>
        ordered[math.max(0, (p * ordered.length).ceil() - 1)];
    var bytes = 0;
    var measured = 0;
    for (final sample in values) {
      if (sample.responseBytes != null) {
        measured += 1;
        bytes += sample.responseBytes!;
      }
    }
    return ExperienceDistribution(count: ordered.length,
        p50Micros: percentile(0.50), p95Micros: percentile(0.95),
        totalResponseBytes: bytes, measuredResponseCount: measured);
  }

  /// Explicitly clear on logout, account switch or benchmark completion.
  void clear() => _samples.clear();
}
