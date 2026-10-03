import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/api/generated/civic_models.dart';

void main() {
  test('generated civic envelope parses canonical trust/provenance state', () {
    final envelope = CivicPublicationEnvelope.fromJson({
      'objectType': 'ANNOUNCEMENT',
      'objectId': '11111111-1111-4111-8111-111111111111',
      'communityId': '22222222-2222-4222-8222-222222222222',
      'visibility': 'COMMUNITY',
      'trustState': 'UNREVIEWED',
      'lifecycleStatus': 'PUBLISHED',
      'publisherUserId': '33333333-3333-4333-8333-333333333333',
      'publisherOrganizationId': null,
      'publisherAuthority': 'COMMUNITY_MODERATOR',
      'jurisdiction': {
        'level': 'COMMUNITY',
        'countryCode': 'NG',
        'communityId': '22222222-2222-4222-8222-222222222222',
      },
      'publishedAt': '2026-08-30T10:00:00.000Z',
      'effectiveFrom': '2026-08-30T10:00:00.000Z',
      'lastMaterialEventAt': '2026-08-30T10:00:00.000Z',
      'provenance': {
        'sourceType': 'USER_SUBMISSION',
        'sourceName': 'Community moderator submission',
        'sourceReference': 'admin-review:announcement:11111111-1111-4111-8111-111111111111',
      },
      'correction': <String, dynamic>{},
    });

    expect(envelope.objectType, CivicObjectType.ANNOUNCEMENT);
    expect(envelope.trustState, CivicTrustState.UNREVIEWED);
    expect(envelope.publisherAuthority, PublisherAuthority.COMMUNITY_MODERATOR);
    expect(envelope.provenance.sourceType, CivicSourceType.USER_SUBMISSION);
    expect(envelope.toJson()['trustState'], 'UNREVIEWED');
  });

  test('generated projection preserves explainable civic reason', () {
    final projection = CivicProjection.fromJson({
      'projectionId': '55555555-5555-4555-8555-555555555555',
      'objectType': 'REPORT',
      'objectId': '66666666-6666-4666-8666-666666666666',
      'communityId': '22222222-2222-4222-8222-222222222222',
      'audienceScope': 'COMMUNITY',
      'priorityBand': 'MATERIAL_UPDATE',
      'displayReasonCode': 'REPORT_STATUS_CHANGED',
      'materialEventType': 'RESPONDING',
      'materialEventAt': '2026-08-30T12:00:00.000Z',
    });

    expect(projection.priorityBand, ProjectionPriorityBand.MATERIAL_UPDATE);
    expect(projection.displayReasonCode, CivicDisplayReasonCode.REPORT_STATUS_CHANGED);
    expect(projection.toJson()['objectType'], 'REPORT');
  });

  test('generated enums fail closed on unknown wire values', () {
    expect(
      () => CivicProjection.fromJson({
        'projectionId': '55555555-5555-4555-8555-555555555555',
        'objectType': 'SOCIAL_POST',
        'objectId': '66666666-6666-4666-8666-666666666666',
        'audienceScope': 'COMMUNITY',
        'priorityBand': 'MATERIAL_UPDATE',
        'displayReasonCode': 'REPORT_STATUS_CHANGED',
        'materialEventAt': '2026-08-30T12:00:00.000Z',
      }),
      throwsFormatException,
    );
  });
}
