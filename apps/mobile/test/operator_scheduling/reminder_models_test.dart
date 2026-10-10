import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/operator_scheduling/reminder_models.dart';

void main() {
  test('rejects unknown statuses and invalid revisions', () {
    final valid = <String,dynamic>{
      'id':'00000000-0000-4000-8000-000000000001',
      'kind':'talk_reminder','referenceId':'talk_12345',
      'frequency':'daily','timezone':'Africa/Lagos',
      'state':'active','revision':2,'nextDueAt':'2026-10-10T15:00:00Z',
    };
    expect(ScheduledReminder.fromJson(valid).revision,2);
    expect(() => ScheduledReminder.fromJson({...valid,'state':'completed'}),
      throwsFormatException);
    expect(() => ScheduledReminder.fromJson({...valid,'revision':0}),
      throwsFormatException);
    expect(() => ScheduledReminder.fromJson({...valid,'nextDueAt':'bad'}),
      throwsFormatException);
  });

  test('secure request ID is v4 and deterministic only for supplied entropy', () {
    final id=secureReminderRequestId(List<int>.generate(16,(i)=>i));
    expect(id, '00010203-0405-4607-8809-0a0b0c0d0e0f');
    expect(() => secureReminderRequestId([1]),throwsArgumentError);
  });

  test('canonical payload key order supports safe retry reuse', () {
    expect(canonicalReminderSpec({'a':1,'b':2}),
      canonicalReminderSpec({'b':2,'a':1}));
  });
}
