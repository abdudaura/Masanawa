// GENERATED FILE — DO NOT EDIT.
// Source: packages/contracts/src/schemas/civic.ts

enum CivicObjectType {
  COMMUNITY,
  MESSAGE,
  DISCUSSION_THREAD,
  REPORT,
  ISSUE,
  REPORT_AUDIT_EVENT,
  REPORT_ASSIGNMENT,
  OFFICIAL_RESPONSE,
  ANNOUNCEMENT,
  ALERT,
  POLL,
  GUIDE,
  EMERGENCY_CONTACT,
  ORGANIZATION,
  NOTIFICATION,
  CONTRIBUTION_EVENT,
}

enum CivicTrustState {
  CITIZEN_REPORTED,
  UNREVIEWED,
  COMMUNITY_CORROBORATED,
  INSTITUTION_ACKNOWLEDGED,
  VERIFIED_PUBLISHER,
  DISPUTED,
}

enum CivicLifecycleStatus {
  DRAFT,
  PENDING,
  SUBMITTED,
  UNDER_REVIEW,
  APPROVED,
  REJECTED,
  REVOKED,
  PUBLISHED,
  ACTIVE,
  OPEN,
  RECEIVED,
  ASSIGNED,
  RESPONDING,
  IN_PROGRESS,
  RESOLVED,
  UNABLE_TO_RESOLVE,
  DISPUTED,
  REOPENED,
  CLOSED,
  EXPIRED,
  CORRECTED,
  WITHDRAWN,
  RETIRED,
}

enum CivicVisibility {
  PUBLIC,
  COMMUNITY,
  PRIVATE,
  RESTRICTED,
}

enum PublisherAuthority {
  CITIZEN,
  COMMUNITY_MODERATOR,
  VERIFIED_ORGANIZATION,
  PLATFORM_EDITOR,
  PLATFORM_ADMIN,
  AUTHORIZED_SAFETY_PUBLISHER,
  SYSTEM,
}

enum CivicSourceType {
  USER_SUBMISSION,
  FIRST_PARTY_OFFICIAL,
  VERIFIED_ORGANIZATION,
  AUTHORITATIVE_DATASET,
  ADMIN_REVIEWED_REFERENCE,
  SYSTEM_DERIVED,
}

enum JurisdictionLevel {
  NATIONAL,
  STATE,
  LGA,
  WARD,
  COMMUNITY,
  ORGANIZATION_SCOPE,
}

enum ProjectionAudienceScope {
  USER,
  COMMUNITY,
  LGA,
  STATE,
  NATIONAL,
}

enum ProjectionPriorityBand {
  SAFETY,
  REQUIRED_ACTION,
  MATERIAL_UPDATE,
  OBSERVATION,
  CLOSING_CONSULTATION,
  NOTICE,
  GUIDE,
  DISCUSSION_PREVIEW,
}

enum CivicDisplayReasonCode {
  ACTIVE_SAFETY_ALERT_FOR_COMMUNITY,
  REQUIRED_ACTION_FOR_USER,
  REPORT_STATUS_CHANGED,
  OFFICIAL_RESPONSE_FOR_LOCAL_REPORT,
  ISSUE_NEEDS_OBSERVATION,
  POLL_CLOSING_SOON,
  CURRENT_COMMUNITY_NOTICE,
  RELEVANT_REVIEWED_GUIDE,
  RECENT_COMMUNITY_DISCUSSION,
}

T _enumByName<T extends Enum>(List<T> values, Object? raw, String field) {
  if (raw is! String) throw FormatException('Missing or invalid $field');
  for (final value in values) {
    if (value.name == raw) return value;
  }
  throw FormatException('Unknown $field: $raw');
}

String? _stringOrNull(Object? value) => value is String ? value : null;
DateTime? _dateOrNull(Object? value) => value is String ? DateTime.tryParse(value) : null;

class CivicJurisdiction {
  const CivicJurisdiction({required this.level, required this.countryCode, this.stateId, this.lgaId, this.wardId, this.communityId, this.organizationId, this.label});
  final JurisdictionLevel level;
  final String countryCode;
  final String? stateId;
  final String? lgaId;
  final String? wardId;
  final String? communityId;
  final String? organizationId;
  final String? label;

  factory CivicJurisdiction.fromJson(Map<String, dynamic> json) => CivicJurisdiction(
    level: _enumByName(JurisdictionLevel.values, json['level'], 'level'),
    countryCode: json['countryCode'] is String ? json['countryCode'] as String : 'NG',
    stateId: _stringOrNull(json['stateId']), lgaId: _stringOrNull(json['lgaId']), wardId: _stringOrNull(json['wardId']),
    communityId: _stringOrNull(json['communityId']), organizationId: _stringOrNull(json['organizationId']), label: _stringOrNull(json['label']),
  );

  Map<String, dynamic> toJson() => {'level': level.name, 'countryCode': countryCode, 'stateId': stateId, 'lgaId': lgaId, 'wardId': wardId, 'communityId': communityId, 'organizationId': organizationId, 'label': label};
}

class CivicProvenance {
  const CivicProvenance({required this.sourceType, required this.sourceName, this.sourceUrl, this.sourceReference, this.sourcePublishedAt, this.ingestedAt, this.reviewedAt, this.reviewedBy});
  final CivicSourceType sourceType;
  final String sourceName;
  final String? sourceUrl;
  final String? sourceReference;
  final DateTime? sourcePublishedAt;
  final DateTime? ingestedAt;
  final DateTime? reviewedAt;
  final String? reviewedBy;

  factory CivicProvenance.fromJson(Map<String, dynamic> json) {
    final sourceName = json['sourceName'];
    if (sourceName is! String || sourceName.isEmpty) throw const FormatException('Missing or invalid sourceName');
    return CivicProvenance(
      sourceType: _enumByName(CivicSourceType.values, json['sourceType'], 'sourceType'), sourceName: sourceName,
      sourceUrl: _stringOrNull(json['sourceUrl']), sourceReference: _stringOrNull(json['sourceReference']),
      sourcePublishedAt: _dateOrNull(json['sourcePublishedAt']), ingestedAt: _dateOrNull(json['ingestedAt']), reviewedAt: _dateOrNull(json['reviewedAt']), reviewedBy: _stringOrNull(json['reviewedBy']),
    );
  }

  Map<String, dynamic> toJson() => {'sourceType': sourceType.name, 'sourceName': sourceName, 'sourceUrl': sourceUrl, 'sourceReference': sourceReference, 'sourcePublishedAt': sourcePublishedAt?.toUtc().toIso8601String(), 'ingestedAt': ingestedAt?.toUtc().toIso8601String(), 'reviewedAt': reviewedAt?.toUtc().toIso8601String(), 'reviewedBy': reviewedBy};
}

class CivicCorrection {
  const CivicCorrection({this.correctionOf, this.correctedAt, this.withdrawnAt, this.correctionNote});
  final String? correctionOf;
  final DateTime? correctedAt;
  final DateTime? withdrawnAt;
  final String? correctionNote;

  factory CivicCorrection.fromJson(Map<String, dynamic> json) => CivicCorrection(correctionOf: _stringOrNull(json['correctionOf']), correctedAt: _dateOrNull(json['correctedAt']), withdrawnAt: _dateOrNull(json['withdrawnAt']), correctionNote: _stringOrNull(json['correctionNote']));
  Map<String, dynamic> toJson() => {'correctionOf': correctionOf, 'correctedAt': correctedAt?.toUtc().toIso8601String(), 'withdrawnAt': withdrawnAt?.toUtc().toIso8601String(), 'correctionNote': correctionNote};
}

class CivicPublicationEnvelope {
  const CivicPublicationEnvelope({required this.objectType, required this.objectId, this.communityId, required this.visibility, required this.trustState, required this.lifecycleStatus, this.publisherUserId, this.publisherOrganizationId, required this.publisherAuthority, required this.jurisdiction, this.publishedAt, this.effectiveFrom, this.expiresAt, this.recheckAt, this.verifiedAt, this.verifiedBy, this.discussionThreadId, this.lastMaterialEventAt, required this.provenance, required this.correction});
  final CivicObjectType objectType;
  final String objectId;
  final String? communityId;
  final CivicVisibility visibility;
  final CivicTrustState trustState;
  final CivicLifecycleStatus lifecycleStatus;
  final String? publisherUserId;
  final String? publisherOrganizationId;
  final PublisherAuthority publisherAuthority;
  final CivicJurisdiction jurisdiction;
  final DateTime? publishedAt;
  final DateTime? effectiveFrom;
  final DateTime? expiresAt;
  final DateTime? recheckAt;
  final DateTime? verifiedAt;
  final String? verifiedBy;
  final String? discussionThreadId;
  final DateTime? lastMaterialEventAt;
  final CivicProvenance provenance;
  final CivicCorrection correction;

  factory CivicPublicationEnvelope.fromJson(Map<String, dynamic> json) {
    final objectId = json['objectId'];
    if (objectId is! String || objectId.isEmpty) throw const FormatException('Missing or invalid objectId');
    final jurisdiction = json['jurisdiction'];
    final provenance = json['provenance'];
    final correction = json['correction'];
    if (jurisdiction is! Map<String, dynamic> || provenance is! Map<String, dynamic> || correction is! Map<String, dynamic>) throw const FormatException('Invalid civic envelope nested object');
    return CivicPublicationEnvelope(
      objectType: _enumByName(CivicObjectType.values, json['objectType'], 'objectType'), objectId: objectId, communityId: _stringOrNull(json['communityId']),
      visibility: _enumByName(CivicVisibility.values, json['visibility'], 'visibility'), trustState: _enumByName(CivicTrustState.values, json['trustState'], 'trustState'),
      lifecycleStatus: _enumByName(CivicLifecycleStatus.values, json['lifecycleStatus'], 'lifecycleStatus'), publisherUserId: _stringOrNull(json['publisherUserId']),
      publisherOrganizationId: _stringOrNull(json['publisherOrganizationId']), publisherAuthority: _enumByName(PublisherAuthority.values, json['publisherAuthority'], 'publisherAuthority'),
      jurisdiction: CivicJurisdiction.fromJson(jurisdiction), publishedAt: _dateOrNull(json['publishedAt']), effectiveFrom: _dateOrNull(json['effectiveFrom']), expiresAt: _dateOrNull(json['expiresAt']),
      recheckAt: _dateOrNull(json['recheckAt']), verifiedAt: _dateOrNull(json['verifiedAt']), verifiedBy: _stringOrNull(json['verifiedBy']), discussionThreadId: _stringOrNull(json['discussionThreadId']),
      lastMaterialEventAt: _dateOrNull(json['lastMaterialEventAt']), provenance: CivicProvenance.fromJson(provenance), correction: CivicCorrection.fromJson(correction),
    );
  }

  Map<String, dynamic> toJson() => {'objectType': objectType.name, 'objectId': objectId, 'communityId': communityId, 'visibility': visibility.name, 'trustState': trustState.name, 'lifecycleStatus': lifecycleStatus.name, 'publisherUserId': publisherUserId, 'publisherOrganizationId': publisherOrganizationId, 'publisherAuthority': publisherAuthority.name, 'jurisdiction': jurisdiction.toJson(), 'publishedAt': publishedAt?.toUtc().toIso8601String(), 'effectiveFrom': effectiveFrom?.toUtc().toIso8601String(), 'expiresAt': expiresAt?.toUtc().toIso8601String(), 'recheckAt': recheckAt?.toUtc().toIso8601String(), 'verifiedAt': verifiedAt?.toUtc().toIso8601String(), 'verifiedBy': verifiedBy, 'discussionThreadId': discussionThreadId, 'lastMaterialEventAt': lastMaterialEventAt?.toUtc().toIso8601String(), 'provenance': provenance.toJson(), 'correction': correction.toJson()};
}

class CivicProjection {
  const CivicProjection({required this.projectionId, required this.objectType, required this.objectId, this.communityId, required this.audienceScope, required this.priorityBand, required this.displayReasonCode, this.materialEventType, required this.materialEventAt, this.expiresAt, this.suppressedAt});
  final String projectionId;
  final CivicObjectType objectType;
  final String objectId;
  final String? communityId;
  final ProjectionAudienceScope audienceScope;
  final ProjectionPriorityBand priorityBand;
  final CivicDisplayReasonCode displayReasonCode;
  final String? materialEventType;
  final DateTime materialEventAt;
  final DateTime? expiresAt;
  final DateTime? suppressedAt;

  factory CivicProjection.fromJson(Map<String, dynamic> json) {
    final projectionId = json['projectionId']; final objectId = json['objectId']; final materialEventAt = _dateOrNull(json['materialEventAt']);
    if (projectionId is! String || objectId is! String || materialEventAt == null) throw const FormatException('Invalid civic projection identity/time');
    return CivicProjection(projectionId: projectionId, objectType: _enumByName(CivicObjectType.values, json['objectType'], 'objectType'), objectId: objectId, communityId: _stringOrNull(json['communityId']), audienceScope: _enumByName(ProjectionAudienceScope.values, json['audienceScope'], 'audienceScope'), priorityBand: _enumByName(ProjectionPriorityBand.values, json['priorityBand'], 'priorityBand'), displayReasonCode: _enumByName(CivicDisplayReasonCode.values, json['displayReasonCode'], 'displayReasonCode'), materialEventType: _stringOrNull(json['materialEventType']), materialEventAt: materialEventAt, expiresAt: _dateOrNull(json['expiresAt']), suppressedAt: _dateOrNull(json['suppressedAt']));
  }

  Map<String, dynamic> toJson() => {'projectionId': projectionId, 'objectType': objectType.name, 'objectId': objectId, 'communityId': communityId, 'audienceScope': audienceScope.name, 'priorityBand': priorityBand.name, 'displayReasonCode': displayReasonCode.name, 'materialEventType': materialEventType, 'materialEventAt': materialEventAt.toUtc().toIso8601String(), 'expiresAt': expiresAt?.toUtc().toIso8601String(), 'suppressedAt': suppressedAt?.toUtc().toIso8601String()};
}
