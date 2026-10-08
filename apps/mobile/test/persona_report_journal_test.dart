import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/screens/profile/persona_report_journal.dart';
import 'package:masanawa/src/talks/talk_safety.dart';

const request = PendingPersonaReport(
  userId: 'user-a',
  publicId: 'persona-a',
  clientRequestId: 'request-1',
  reason: TalkSafetyReportReason.harassment,
  detail: 'Repeated interruptions',
);

void main() {
  test('serialized journal restores one exact tenant-scoped report intent', () {
    final value = jsonEncode(request.toJson());
    final recovered = PendingPersonaReport.parse(
      value, userId: 'user-a', publicId: 'persona-a',
    );
    expect(recovered.clientRequestId, 'request-1');
    expect(recovered.reason, TalkSafetyReportReason.harassment);
    expect(recovered.detail, 'Repeated interruptions');
  });

  test('user switch and different persona cannot import someone else journal', () {
    final value = jsonEncode(request.toJson());
    expect(
      () => PendingPersonaReport.parse(
        value, userId: 'user-b', publicId: 'persona-a',
      ),
      throwsFormatException,
    );
    expect(
      () => PendingPersonaReport.parse(
        value, userId: 'user-a', publicId: 'persona-b',
      ),
      throwsFormatException,
    );
  });

  test('tampering with version, reason and id fails closed', () {
    for (final changed in <Map<String, dynamic>>[
      {...request.toJson(), 'version': 20},
      {...request.toJson(), 'reason': 'unknown'},
      {...request.toJson(), 'clientRequestId': ''},
      {...request.toJson(), 'detail': List<String>.filled(2001, 'x').join()},
    ]) {
      expect(
        () => PendingPersonaReport.parse(
          jsonEncode(changed), userId: 'user-a', publicId: 'persona-a',
        ),
        throwsFormatException,
      );
    }
  });
}
