import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/api/generated/civic_models.dart';
import 'package:masanawa/src/core/api/generated/discussion_models.dart';

void main() {
  test('parses canonical object thread contract', () {
    final thread = DiscussionThread.fromJson({
      'id': '55555555-5555-4555-8555-555555555555',
      'mode': 'OBJECT_THREAD',
      'communityId': '22222222-2222-4222-8222-222222222222',
      'objectType': 'REPORT',
      'objectId': '44444444-4444-4444-8444-444444444444',
      'readPermission': 'PUBLIC_READ',
      'writePermission': 'OBJECT_ELIGIBLE_WRITE',
      'createdAt': '2026-08-30T12:00:00.000Z',
      'closedAt': null,
    });

    expect(thread.mode, DiscussionThreadMode.OBJECT_THREAD);
    expect(thread.objectType, CivicObjectType.REPORT);
    expect(thread.writePermission, DiscussionPermission.OBJECT_ELIGIBLE_WRITE);
  });

  test('parses canonical civic detail reference', () {
    final detail = CanonicalCivicDetailRef.fromJson({
      'objectType': 'REPORT',
      'objectId': '44444444-4444-4444-8444-444444444444',
      'canonicalPath': '/reports/UN-2026-000001',
      'discussionThreadId': null,
    });

    expect(detail.objectType, CivicObjectType.REPORT);
    expect(detail.canonicalPath, '/reports/UN-2026-000001');
    expect(detail.discussionThreadId, isNull);
  });
}
