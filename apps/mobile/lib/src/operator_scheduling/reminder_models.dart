import 'dart:convert';

enum ReminderKind { talkReminder, lessonFollowup, artifactReady }

extension ReminderKindDetails on ReminderKind {
  String get wireName => switch (this) {
        ReminderKind.talkReminder => 'talk_reminder',
        ReminderKind.lessonFollowup => 'lesson_followup',
        ReminderKind.artifactReady => 'artifact_ready',
      };
  String get label => switch (this) {
        ReminderKind.talkReminder => 'Talk reminder',
        ReminderKind.lessonFollowup => 'Lesson follow-up',
        ReminderKind.artifactReady => 'Artifact update',
      };
}

class ReminderTarget {
  const ReminderTarget(this.kind, this.referenceId);
  final ReminderKind kind;
  final String referenceId;
}

class ScheduledReminder {
  const ScheduledReminder({
    required this.id,
    required this.kind,
    required this.referenceId,
    required this.frequency,
    required this.timezone,
    required this.state,
    required this.revision,
    required this.nextDueAt,
    this.localTime,
    this.dayOfWeek,
  });
  final String id;
  final ReminderKind kind;
  final String referenceId;
  final String frequency;
  final String timezone;
  final String state;
  final int revision;
  final DateTime? nextDueAt;
  final String? localTime;
  final int? dayOfWeek;

  factory ScheduledReminder.fromJson(Map<String, dynamic> data) {
    String field(String key) {
      final value = data[key];
      if (value is! String || value.isEmpty) {
        throw FormatException('Missing reminder $key');
      }
      return value;
    }
    final kindName = field('kind');
    final kinds = ReminderKind.values.where((k) => k.wireName == kindName);
    if (kinds.length != 1) throw const FormatException('Unknown reminder');
    final frequency = field('frequency');
    final state = field('state');
    if (!{'once', 'daily', 'weekly'}.contains(frequency) ||
        !{'active', 'paused', 'cancelled'}.contains(state)) {
      throw const FormatException('Invalid reminder state');
    }
    final revision = data['revision'];
    if (revision is! int || revision < 1) {
      throw const FormatException('Invalid reminder revision');
    }
    final rawDue = data['nextDueAt'];
    final due = rawDue is String ? DateTime.tryParse(rawDue)?.toUtc() : null;
    if (rawDue != null && due == null) {
      throw const FormatException('Invalid reminder date');
    }
    return ScheduledReminder(
      id: field('id'),
      kind: kinds.single,
      referenceId: field('referenceId'),
      frequency: frequency,
      timezone: field('timezone'),
      state: state,
      revision: revision,
      nextDueAt: due,
      localTime: data['localTime'] as String?,
      dayOfWeek: data['dayOfWeek'] as int?,
    );
  }
}

String canonicalReminderSpec(Map<String, dynamic> spec) {
  final keys = spec.keys.toList()..sort();
  return jsonEncode({for (final key in keys) key: spec[key]});
}

/// Correct v4 UUID from the OS CSPRNG (no timestamp or user ID encoded).
String secureReminderRequestId(List<int> bytes) {
  if (bytes.length != 16) throw ArgumentError('Expected 16 random bytes');
  final data = List<int>.of(bytes);
  data[6] = (data[6] & 0x0f) | 0x40;
  data[8] = (data[8] & 0x3f) | 0x80;
  final s = data.map((v) => v.toRadixString(16).padLeft(2, '0')).join();
  return '${s.substring(0, 8)}-${s.substring(8, 12)}-'
      '${s.substring(12, 16)}-${s.substring(16, 20)}-${s.substring(20)}';
}
