/// API client DTOs — Dart mirror of `packages/contracts` schemas.
///
/// Field names/types must stay in sync with the Zod schemas in
/// `packages/contracts/src/schemas/*.ts` (contract-first rule). A Dart client
/// codegen step (from the committed `openapi/openapi.json`) is a planned
/// hardening item; until then these are hand-maintained mirrors with the same
/// shapes. All money-free; nothing sensitive is stored in these models.
library;

/// Auth contract (U-p2-01/03).
/// OTP delivery channels. Mirrors `OtpChannel` in the API's otp.service.
enum OtpChannel { sms, email }

/// Request body for `POST /auth/otp` — exactly one channel, mirroring the
/// contract's `exactlyOneChannel` superRefine.
class OtpSendRequest {
  const OtpSendRequest({this.phone, this.email})
      : assert(phone != null || email != null, 'Provide exactly one of phone or email');

  final String? phone;
  final String? email;

  Map<String, dynamic> toJson() => {
        if (phone != null) 'phone': phone,
        if (email != null) 'email': email,
      };
}

class OtpSendResponse {
  const OtpSendResponse({this.phone, this.email, required this.resendInSeconds})
      : assert(phone != null || email != null, 'Provide exactly one of phone or email');

  factory OtpSendResponse.fromJson(Map<String, dynamic> json) => OtpSendResponse(
        phone: json['phone'] as String?,
        email: json['email'] as String?,
        resendInSeconds: json['resendInSeconds'] as int,
      );

  final String? phone;
  final String? email;
  final int resendInSeconds;

  /// The channel the code was sent on (derived from the present field).
  OtpChannel get channel => phone != null ? OtpChannel.sms : OtpChannel.email;

  /// The phone or email that received the code.
  String get identifier => phone ?? email!;
}

class OtpVerifyRequest {
  const OtpVerifyRequest({this.phone, this.email, required this.code, this.name})
      : assert(phone != null || email != null, 'Provide exactly one of phone or email');

  final String? phone;
  final String? email;
  final String code;
  final String? name;

  Map<String, dynamic> toJson() => {
        if (phone != null) 'phone': phone,
        if (email != null) 'email': email,
        'code': code,
        if (name != null) 'name': name,
      };
}

/// Password auth (U-auth-pw). The 6-digit device password replaces SMS OTP
/// for phone login; email keeps real OTP. The server owns registration and
/// device trust; the client fails closed when these endpoints are absent.
class AccountStatusResponse {
  const AccountStatusResponse({required this.registered, required this.deviceKnown});

  factory AccountStatusResponse.fromJson(Map<String, dynamic> json) =>
      AccountStatusResponse(
        registered: json['registered'] as bool? ?? false,
        deviceKnown: json['deviceKnown'] as bool? ?? false,
      );

  final bool registered;
  final bool deviceKnown;
}

class PasswordVerifyRequest {
  const PasswordVerifyRequest({
    required this.phone,
    required this.deviceId,
    required this.password,
  });

  final String phone;
  final String deviceId;
  final String password;

  Map<String, dynamic> toJson() => {
        'phone': phone,
        'deviceId': deviceId,
        'password': password,
      };
}

class PasswordSetupRequest {
  const PasswordSetupRequest({
    required this.phone,
    required this.deviceId,
    required this.password,
    required this.name,
    this.email,
  });

  final String phone;
  final String deviceId;
  final String password;
  final String name;
  final String? email;

  Map<String, dynamic> toJson() => {
        'phone': phone,
        'deviceId': deviceId,
        'password': password,
        'name': name,
        if (email != null) 'email': email,
      };
}

class AuthUser {
  const AuthUser({
    required this.id,
    required this.name,
    this.phone,
    this.email,
    required this.locale,
    required this.status,
    required this.role,
    required this.isNewUser,
    this.communityId,
    this.stateId,
    required this.createdAt,
  });

  factory AuthUser.fromJson(Map<String, dynamic> json) => AuthUser(
        id: json['id'] as String,
        name: json['name'] as String,
        phone: json['phone'] as String?,
        email: json['email'] as String?,
        locale: json['locale'] as String,
        status: json['status'] as String,
        role: json['role'] as String,
        isNewUser: json['isNewUser'] as bool,
        communityId: json['communityId'] as String?,
        stateId: json['stateId'] as String?,
        createdAt: json['createdAt'] as String,
      );

  final String id;
  final String name;
  final String? phone;
  final String? email;
  final String locale;
  final String status;
  final String role;
  final bool isNewUser;
  final String? communityId;
  final String? stateId;
  final String createdAt;

  bool get isActive => status == 'ACTIVE';

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'phone': phone,
        'email': email,
        'locale': locale,
        'status': status,
        'role': role,
        'isNewUser': isNewUser,
        'communityId': communityId,
        'stateId': stateId,
        'createdAt': createdAt,
      };
}

class AuthTokens {
  const AuthTokens({
    required this.accessToken,
    required this.refreshToken,
    required this.accessExpiresIn,
    required this.user,
  });

  factory AuthTokens.fromJson(Map<String, dynamic> json) => AuthTokens(
        accessToken: json['accessToken'] as String,
        refreshToken: json['refreshToken'] as String,
        accessExpiresIn: json['accessExpiresIn'] as int,
        user: AuthUser.fromJson(json['user'] as Map<String, dynamic>),
      );

  final String accessToken;
  final String refreshToken;
  final int accessExpiresIn;
  final AuthUser user;
}

/// Geo contract (U-p1-05, ward + polling-unit levels per U-p1-07).
class GeoNode {
  const GeoNode({
    required this.id,
    required this.type,
    required this.name,
    required this.slug,
    this.code,
    this.stateId,
    this.stateName,
    this.lgaId,
    this.lgaName,
    this.lgaCode,
    this.wardId,
    this.wardName,
    this.wardCode,
    this.pollingUnitId,
    this.communityId,
    required this.score,
  });

  factory GeoNode.fromJson(Map<String, dynamic> json) => GeoNode(
        id: json['id'] as String,
        type: json['type'] as String,
        name: json['name'] as String,
        slug: json['slug'] as String,
        code: json['code'] as String?,
        stateId: json['stateId'] as String?,
        stateName: json['stateName'] as String?,
        lgaId: json['lgaId'] as String?,
        lgaName: json['lgaName'] as String?,
        lgaCode: json['lgaCode'] as String?,
        wardId: json['wardId'] as String?,
        wardName: json['wardName'] as String?,
        wardCode: json['wardCode'] as String?,
        pollingUnitId: json['pollingUnitId'] as String?,
        communityId: json['communityId'] as String?,
        score: (json['score'] as num).toDouble(),
      );

  final String id;
  final String type;
  final String name;
  final String slug;
  final String? code;
  final String? stateId;
  final String? stateName;
  final String? lgaId;
  final String? lgaName;
  final String? lgaCode;
  final String? wardId;
  final String? wardName;
  final String? wardCode;
  final String? pollingUnitId;

  /// The joinable community: set on community nodes (self), ward nodes and
  /// polling-unit nodes (the linked INEC_REGISTER community).
  final String? communityId;
  final double score;
}

class GeoSearchResponse {
  const GeoSearchResponse({required this.query, required this.results});

  factory GeoSearchResponse.fromJson(Map<String, dynamic> json) =>
      GeoSearchResponse(
        query: json['query'] as String,
        results: (json['results'] as List<dynamic>)
            .map((e) => GeoNode.fromJson(e as Map<String, dynamic>))
            .toList(),
      );

  final String query;
  final List<GeoNode> results;
}

class CommunityRequest {
  const CommunityRequest({
    required this.userId,
    required this.name,
    required this.stateId,
    required this.lgaId,
    this.nearestCommunityId,
  });

  final String userId;
  final String name;
  final String stateId;
  final String lgaId;
  final String? nearestCommunityId;

  Map<String, dynamic> toJson() => {
        'userId': userId,
        'name': name,
        'stateId': stateId,
        'lgaId': lgaId,
        if (nearestCommunityId != null) 'nearestCommunityId': nearestCommunityId,
      };
}

class CommunityRequestResponse {
  const CommunityRequestResponse({
    required this.id,
    required this.name,
    required this.status,
    required this.stateId,
    required this.lgaId,
    this.nearestCommunityId,
    required this.createdAt,
  });

  factory CommunityRequestResponse.fromJson(Map<String, dynamic> json) =>
      CommunityRequestResponse(
        id: json['id'] as String,
        name: json['name'] as String,
        status: json['status'] as String,
        stateId: json['stateId'] as String,
        lgaId: json['lgaId'] as String,
        nearestCommunityId: json['nearestCommunityId'] as String?,
        createdAt: json['createdAt'] as String,
      );

  final String id;
  final String name;
  final String status;
  final String stateId;
  final String lgaId;
  final String? nearestCommunityId;
  final String createdAt;
}

/// Community + feed contract (U-p2-04). Mirrors `schemas/community.ts` and
/// `schemas/feed.ts`; see the header note on the hand-maintained mirror.
class PageMeta {
  const PageMeta({required this.nextCursor, required this.hasMore});

  factory PageMeta.fromJson(Map<String, dynamic> json) => PageMeta(
        nextCursor: json['nextCursor'] as String?,
        hasMore: json['hasMore'] as bool,
      );

  final String? nextCursor;
  final bool hasMore;
}

class CommunitySummary {
  const CommunitySummary({
    required this.id,
    required this.name,
    required this.slug,
    required this.stateId,
    required this.stateName,
    required this.lgaId,
    required this.lgaName,
    required this.memberCount,
    required this.joined,
    required this.status,
    required this.createdAt,
  });

  factory CommunitySummary.fromJson(Map<String, dynamic> json) => CommunitySummary(
        id: json['id'] as String,
        name: json['name'] as String,
        slug: json['slug'] as String,
        stateId: json['stateId'] as String,
        stateName: json['stateName'] as String,
        lgaId: json['lgaId'] as String,
        lgaName: json['lgaName'] as String,
        memberCount: json['memberCount'] as int,
        joined: json['joined'] as bool,
        status: json['status'] as String,
        createdAt: json['createdAt'] as String,
      );

  final String id;
  final String name;
  final String slug;
  final String stateId;
  final String stateName;
  final String lgaId;
  final String lgaName;
  final int memberCount;
  final bool joined;
  final String status;
  final String createdAt;

  CommunitySummary copyWith({bool? joined, int? memberCount}) => CommunitySummary(
        id: id,
        name: name,
        slug: slug,
        stateId: stateId,
        stateName: stateName,
        lgaId: lgaId,
        lgaName: lgaName,
        memberCount: memberCount ?? this.memberCount,
        joined: joined ?? this.joined,
        status: status,
        createdAt: createdAt,
      );
}

class CommunityListResponse {
  const CommunityListResponse({required this.communities, required this.meta});

  factory CommunityListResponse.fromJson(Map<String, dynamic> json) =>
      CommunityListResponse(
        communities: (json['communities'] as List<dynamic>)
            .map((e) => CommunitySummary.fromJson(e as Map<String, dynamic>))
            .toList(),
        meta: PageMeta.fromJson(json['meta'] as Map<String, dynamic>),
      );

  final List<CommunitySummary> communities;
  final PageMeta meta;
}

class CommunityDetail {
  const CommunityDetail({
    required this.id,
    required this.name,
    required this.slug,
    required this.stateId,
    required this.stateName,
    required this.lgaId,
    required this.lgaName,
    required this.memberCount,
    required this.joined,
    required this.status,
    required this.createdAt,
    required this.source,
    this.verifiedAt,
    this.wardName,
    this.cityName,
  });

  factory CommunityDetail.fromJson(Map<String, dynamic> json) => CommunityDetail(
        id: json['id'] as String,
        name: json['name'] as String,
        slug: json['slug'] as String,
        stateId: json['stateId'] as String,
        stateName: json['stateName'] as String,
        lgaId: json['lgaId'] as String,
        lgaName: json['lgaName'] as String,
        memberCount: json['memberCount'] as int,
        joined: json['joined'] as bool,
        status: json['status'] as String,
        createdAt: json['createdAt'] as String,
        source: json['source'] as String,
        verifiedAt: json['verifiedAt'] as String?,
        wardName: json['wardName'] as String?,
        cityName: json['cityName'] as String?,
      );

  final String id;
  final String name;
  final String slug;
  final String stateId;
  final String stateName;
  final String lgaId;
  final String lgaName;
  final int memberCount;
  final bool joined;
  final String status;
  final String createdAt;
  final String source;
  final String? verifiedAt;
  final String? wardName;
  final String? cityName;
}

class CommunityDetailResponse {
  const CommunityDetailResponse({required this.community});

  factory CommunityDetailResponse.fromJson(Map<String, dynamic> json) =>
      CommunityDetailResponse(
        community: CommunityDetail.fromJson(json['community'] as Map<String, dynamic>),
      );

  final CommunityDetail community;
}

class CommunityMember {
  const CommunityMember({
    required this.userId,
    required this.name,
    required this.role,
    required this.joinedAt,
  });

  factory CommunityMember.fromJson(Map<String, dynamic> json) => CommunityMember(
        userId: json['userId'] as String,
        name: json['name'] as String,
        role: json['role'] as String,
        joinedAt: json['joinedAt'] as String,
      );

  final String userId;
  final String name;
  final String role;
  final String joinedAt;
}

class CommunityMembersResponse {
  const CommunityMembersResponse({required this.members, required this.meta});

  factory CommunityMembersResponse.fromJson(Map<String, dynamic> json) =>
      CommunityMembersResponse(
        members: (json['members'] as List<dynamic>)
            .map((e) => CommunityMember.fromJson(e as Map<String, dynamic>))
            .toList(),
        meta: PageMeta.fromJson(json['meta'] as Map<String, dynamic>),
      );

  final List<CommunityMember> members;
  final PageMeta meta;
}

class JoinCommunityResponse {
  const JoinCommunityResponse({
    required this.communityId,
    required this.role,
    required this.alreadyMember,
  });

  factory JoinCommunityResponse.fromJson(Map<String, dynamic> json) =>
      JoinCommunityResponse(
        communityId: json['communityId'] as String,
        role: json['role'] as String,
        alreadyMember: json['alreadyMember'] as bool,
      );

  final String communityId;
  final String role;
  final bool alreadyMember;
}

class LeaveCommunityResponse {
  const LeaveCommunityResponse({required this.communityId, required this.wasMember});

  factory LeaveCommunityResponse.fromJson(Map<String, dynamic> json) =>
      LeaveCommunityResponse(
        communityId: json['communityId'] as String,
        wasMember: json['wasMember'] as bool,
      );

  final String communityId;
  final bool wasMember;
}

/// One feed item — discriminated on `type` exactly like `FeedItemSchema`.
sealed class FeedItem {
  const FeedItem({required this.type, required this.id, required this.createdAt});

  factory FeedItem.fromJson(Map<String, dynamic> json) => switch (json['type']) {
        'alert' => FeedAlertItem.fromJson(json),
        'issue' => FeedIssueItem.fromJson(json),
        'announcement' => FeedAnnouncementItem.fromJson(json),
        'poll' => FeedPollItem.fromJson(json),
        'post' => FeedPostItem.fromJson(json),
        _ => throw FormatException('Unknown feed item type: ${json['type']}'),
      };

  /// Serializes this item back to its contract shape (round-trips through
  /// [FeedItem.fromJson]); used by the offline feed cache (D10).
  Map<String, dynamic> toJson();

  final String type;
  final String id;
  final String createdAt;
}

class FeedAlertItem extends FeedItem {
  const FeedAlertItem({
    required super.id,
    required super.createdAt,
    required this.title,
    required this.body,
    required this.priority,
    required this.source,
    this.expiresAt,
  }) : super(type: 'alert');

  factory FeedAlertItem.fromJson(Map<String, dynamic> json) => FeedAlertItem(
        id: json['id'] as String,
        createdAt: json['createdAt'] as String,
        title: json['title'] as String,
        body: json['body'] as String,
        priority: json['priority'] as String,
        source: json['source'] as String,
        expiresAt: json['expiresAt'] as String?,
      );

  @override
  Map<String, dynamic> toJson() => {
        'type': type,
        'id': id,
        'createdAt': createdAt,
        'title': title,
        'body': body,
        'priority': priority,
        'source': source,
        if (expiresAt != null) 'expiresAt': expiresAt,
      };

  final String title;
  final String body;
  final String priority;
  final String source;
  final String? expiresAt;
}

class FeedIssueItem extends FeedItem {
  const FeedIssueItem({
    required super.id,
    required super.createdAt,
    required this.title,
    required this.category,
    required this.status,
    required this.priorityScore,
  }) : super(type: 'issue');

  factory FeedIssueItem.fromJson(Map<String, dynamic> json) => FeedIssueItem(
        id: json['id'] as String,
        createdAt: json['createdAt'] as String,
        title: json['title'] as String,
        category: json['category'] as String,
        status: json['status'] as String,
        priorityScore: (json['priorityScore'] as num).toDouble(),
      );

  @override
  Map<String, dynamic> toJson() => {
        'type': type,
        'id': id,
        'createdAt': createdAt,
        'title': title,
        'category': category,
        'status': status,
        'priorityScore': priorityScore,
      };

  final String title;
  final String category;
  final String status;
  final double priorityScore;
}

class FeedAnnouncementItem extends FeedItem {
  const FeedAnnouncementItem({
    required super.id,
    required super.createdAt,
    required this.kind,
    required this.title,
    required this.body,
    required this.pinned,
    this.authorOrgName,
    this.authorOrgLogoKey,
  }) : super(type: 'announcement');

  factory FeedAnnouncementItem.fromJson(Map<String, dynamic> json) =>
      FeedAnnouncementItem(
        id: json['id'] as String,
        createdAt: json['createdAt'] as String,
        kind: json['kind'] as String,
        title: json['title'] as String,
        body: json['body'] as String,
        pinned: json['pinned'] as bool,
        authorOrgName: json['authorOrgName'] as String?,
        authorOrgLogoKey: json['authorOrgLogoKey'] as String?,
      );

  final String kind;
  final String title;
  final String body;
  final bool pinned;
  final String? authorOrgName;
  final String? authorOrgLogoKey;

  @override
  Map<String, dynamic> toJson() => {
        'type': type,
        'id': id,
        'createdAt': createdAt,
        'kind': kind,
        'title': title,
        'body': body,
        'pinned': pinned,
        'authorOrgName': authorOrgName,
        'authorOrgLogoKey': authorOrgLogoKey,
      };
}

class FeedPollItem extends FeedItem {
  const FeedPollItem({
    required super.id,
    required super.createdAt,
    required this.title,
    this.closesAt,
    required this.status,
  }) : super(type: 'poll');

  factory FeedPollItem.fromJson(Map<String, dynamic> json) => FeedPollItem(
        id: json['id'] as String,
        createdAt: json['createdAt'] as String,
        title: json['title'] as String,
        closesAt: json['closesAt'] as String?,
        status: json['status'] as String,
      );

  @override
  Map<String, dynamic> toJson() => {
        'type': type,
        'id': id,
        'createdAt': createdAt,
        'title': title,
        if (closesAt != null) 'closesAt': closesAt,
        'status': status,
      };

  final String title;
  final String? closesAt;
  final String status;
}

/// Announcements contract (U-p6-03). Mirrors `schemas/announcement.ts`.
/// Two kinds, rendered distinctly: COMMUNITY = local moderator notice (brand
/// chrome), OFFICIAL = platform-authoritative (verified blue chrome).
class AnnouncementItem {
  const AnnouncementItem({
    required this.id,
    required this.communityId,
    required this.kind,
    required this.title,
    required this.pinned,
    required this.expiresAt,
    required this.createdAt,
    required this.authorName,
    required this.authorOrgName,
    required this.authorOrgLogoKey,
  });

  factory AnnouncementItem.fromJson(Map<String, dynamic> json) =>
      AnnouncementItem(
        id: json['id'] as String,
        communityId: json['communityId'] as String?,
        kind: json['kind'] as String,
        title: json['title'] as String,
        pinned: json['pinned'] as bool,
        expiresAt: json['expiresAt'] as String?,
        createdAt: json['createdAt'] as String,
        authorName: json['authorName'] as String?,
        authorOrgName: json['authorOrgName'] as String?,
        authorOrgLogoKey: json['authorOrgLogoKey'] as String?,
      );

  final String id;
  final String? communityId;
  final String kind;
  final String title;
  final bool pinned;
  final String? expiresAt;
  final String createdAt;
  final String? authorName;
  final String? authorOrgName;
  final String? authorOrgLogoKey;

  bool get isOfficial => kind == 'OFFICIAL';
}

class AnnouncementDetail extends AnnouncementItem {
  const AnnouncementDetail({
    required super.id,
    required super.communityId,
    required super.kind,
    required super.title,
    required super.pinned,
    required super.expiresAt,
    required super.createdAt,
    required super.authorName,
    required super.authorOrgName,
    required super.authorOrgLogoKey,
    required this.body,
  });

  factory AnnouncementDetail.fromJson(Map<String, dynamic> json) =>
      AnnouncementDetail(
        id: json['id'] as String,
        communityId: json['communityId'] as String?,
        kind: json['kind'] as String,
        title: json['title'] as String,
        pinned: json['pinned'] as bool,
        expiresAt: json['expiresAt'] as String?,
        createdAt: json['createdAt'] as String,
        authorName: json['authorName'] as String?,
        authorOrgName: json['authorOrgName'] as String?,
        authorOrgLogoKey: json['authorOrgLogoKey'] as String?,
        body: json['body'] as String,
      );

  final String body;
}

class AnnouncementListResponse {
  const AnnouncementListResponse({
    required this.communityId,
    required this.items,
    required this.meta,
  });

  factory AnnouncementListResponse.fromJson(Map<String, dynamic> json) =>
      AnnouncementListResponse(
        communityId: json['communityId'] as String?,
        items: (json['items'] as List<dynamic>)
            .whereType<Map>()
            .map((e) => AnnouncementItem.fromJson(e.cast<String, dynamic>()))
            .toList(),
        meta: PageMeta.fromJson(json['meta'] as Map<String, dynamic>),
      );

  final String? communityId;
  final List<AnnouncementItem> items;
  final PageMeta meta;
}

/// POST /announcements body (kind gating is server-side: COMMUNITY requires a
/// community MODERATOR/ADMIN membership, OFFICIAL requires PLATFORM_ADMIN).
class CreateAnnouncementBody {
  const CreateAnnouncementBody({
    required this.communityId,
    required this.kind,
    required this.title,
    required this.body,
    this.pinned = false,
    this.expiresAt,
  });

  Map<String, dynamic> toJson() => {
        'communityId': communityId,
        'kind': kind,
        'title': title,
        'body': body,
        'pinned': pinned,
        if (expiresAt != null) 'expiresAt': expiresAt,
      };

  final String communityId;
  final String kind;
  final String title;
  final String body;
  final bool pinned;
  final String? expiresAt;
}

/// PATCH /announcements/:id body — at least one field required.
class UpdateAnnouncementBody {
  const UpdateAnnouncementBody({this.pinned, this.expiresAt});

  Map<String, dynamic> toJson() => {
        if (pinned != null) 'pinned': pinned,
        if (expiresAt != null) 'expiresAt': expiresAt,
      };

  final bool? pinned;
  final String? expiresAt;
}

enum CivicAuthorType {
  aiNews,
  adminReport,
  approvedUser,
  approvedOrg,
  governmentAgency,
}

enum CivicBadge {
  official,
  admin,
  citizen,
  organization,
  government,
}

class CivicAuthor {
  const CivicAuthor({
    required this.name,
    required this.handle,
    required this.type,
    required this.badge,
    this.avatarUrl,
    this.locationLabel,
  });

  factory CivicAuthor.fromJson(Map<String, dynamic> json) => CivicAuthor(
        name: json['name'] as String,
        handle: json['handle'] as String,
        type: CivicAuthorType.values.firstWhere(
          (e) => e.name == json['type'],
          orElse: () => CivicAuthorType.approvedUser,
        ),
        badge: CivicBadge.values.firstWhere(
          (e) => e.name == json['badge'],
          orElse: () => CivicBadge.citizen,
        ),
        avatarUrl: json['avatarUrl'] as String?,
        locationLabel: json['locationLabel'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'name': name,
        'handle': handle,
        'type': type.name,
        'badge': badge.name,
        if (avatarUrl != null) 'avatarUrl': avatarUrl,
        if (locationLabel != null) 'locationLabel': locationLabel,
      };

  final String name;
  final String handle;
  final CivicAuthorType type;
  final CivicBadge badge;
  final String? avatarUrl;
  final String? locationLabel;
}

class FeedPostItem extends FeedItem {
  const FeedPostItem({
    required super.id,
    required super.createdAt,
    this.content,
    required this.authorName,
    required this.moderationStatus,
    this.communityId,
    this.author,
    this.headline,
    this.categoryLabel = 'NEWS',
    this.likeCount = 0,
    this.commentCount = 0,
    this.shareCount = 0,
    this.viewCount = 0,
    this.isLiked = false,
    this.isBookmarked = false,
    this.mediaUrl,
    this.mediaType,
    this.pollOptions,
    this.reportStatus,
  }) : super(type: 'post');

  factory FeedPostItem.fromJson(Map<String, dynamic> json) => FeedPostItem(
        id: json['id'] as String,
        createdAt: json['createdAt'] as String,
        content: json['content'] as String?,
        authorName: json['authorName'] as String? ?? 'UNigeria Citizen',
        moderationStatus: json['moderationStatus'] as String? ?? 'APPROVED',
        communityId: json['communityId'] as String?,
        author: json['author'] != null
            ? CivicAuthor.fromJson(json['author'] as Map<String, dynamic>)
            : null,
        headline: json['headline'] as String?,
        categoryLabel: json['categoryLabel'] as String? ?? 'NEWS',
        likeCount: (json['likeCount'] as num?)?.toInt() ?? 0,
        commentCount: (json['commentCount'] as num?)?.toInt() ?? 0,
        shareCount: (json['shareCount'] as num?)?.toInt() ?? 0,
        viewCount: (json['viewCount'] as num?)?.toInt() ?? 0,
        isLiked: json['isLiked'] as bool? ?? false,
        isBookmarked: json['isBookmarked'] as bool? ?? false,
        mediaUrl: json['mediaUrl'] as String?,
        mediaType: json['mediaType'] as String?,
        pollOptions: (json['pollOptions'] as List<dynamic>?)
            ?.map((e) => e as Map<String, dynamic>)
            .toList(),
        reportStatus: json['reportStatus'] as String?,
      );

  @override
  Map<String, dynamic> toJson() => {
        'type': type,
        'id': id,
        'createdAt': createdAt,
        if (content != null) 'content': content,
        'authorName': authorName,
        'moderationStatus': moderationStatus,
        if (communityId != null) 'communityId': communityId,
        if (author != null) 'author': author!.toJson(),
        if (headline != null) 'headline': headline,
        'categoryLabel': categoryLabel,
        'likeCount': likeCount,
        'commentCount': commentCount,
        'shareCount': shareCount,
        'viewCount': viewCount,
        'isLiked': isLiked,
        'isBookmarked': isBookmarked,
        if (mediaUrl != null) 'mediaUrl': mediaUrl,
        if (mediaType != null) 'mediaType': mediaType,
        if (pollOptions != null) 'pollOptions': pollOptions,
        if (reportStatus != null) 'reportStatus': reportStatus,
      };

  final String? content;
  final String authorName;
  final String moderationStatus;
  final String? communityId;
  final CivicAuthor? author;
  final String? headline;
  final String categoryLabel;
  final int likeCount;
  final int commentCount;
  final int shareCount;
  final int viewCount;
  final bool isLiked;
  final bool isBookmarked;
  final String? mediaUrl;
  final String? mediaType;
  final List<Map<String, dynamic>>? pollOptions;
  final String? reportStatus;

  FeedPostItem copyWith({
    bool? isLiked,
    int? likeCount,
    bool? isBookmarked,
    int? commentCount,
  }) =>
      FeedPostItem(
        id: id,
        createdAt: createdAt,
        content: content,
        authorName: authorName,
        moderationStatus: moderationStatus,
        communityId: communityId,
        author: author,
        headline: headline,
        categoryLabel: categoryLabel,
        likeCount: likeCount ?? this.likeCount,
        commentCount: commentCount ?? this.commentCount,
        shareCount: shareCount,
        viewCount: viewCount,
        isLiked: isLiked ?? this.isLiked,
        isBookmarked: isBookmarked ?? this.isBookmarked,
        mediaUrl: mediaUrl,
        mediaType: mediaType,
        pollOptions: pollOptions,
        reportStatus: reportStatus,
      );
}

class CivicGuideItem {
  const CivicGuideItem({
    required this.id,
    required this.title,
    required this.summary,
    required this.category,
    required this.categoryIcon,
    required this.readTimeMinutes,
    required this.steps,
    this.officialAgency,
    this.hotline,
  });

  final String id;
  final String title;
  final String summary;
  final String category;
  final String categoryIcon;
  final int readTimeMinutes;
  final List<String> steps;
  final String? officialAgency;
  final String? hotline;
}

class CivicNotificationItem {
  const CivicNotificationItem({
    required this.id,
    required this.title,
    required this.body,
    required this.category,
    required this.priority,
    required this.createdAt,
    required this.read,
    required this.viewCount,
    this.actionRoute,
    required this.source,
  });

  factory CivicNotificationItem.fromJson(Map<String, dynamic> json) {
    final data = json['data'] as Map<String, dynamic>? ?? {};
    final kind = (json['kind'] as String?) ?? 'SYSTEM';
    // Derive actionRoute from notification kind + data
    String? route;
    if (kind == 'REPORT_UPDATE' && data['publicRef'] != null) {
      route = '/track/${data['publicRef']}';
    } else if (kind == 'POLL' && data['pollId'] != null) {
      route = '/polls/${data['pollId']}';
    } else if (kind == 'ANNOUNCEMENT' && data['announcementId'] != null) {
      route = '/announcements/${data['announcementId']}';
    }

    return CivicNotificationItem(
      id: json['id'] as String,
      title: json['title'] as String,
      body: (json['body'] as String?) ?? '',
      category: kind,
      priority: (json['priority'] as String?) ?? 'NORMAL',
      createdAt: json['createdAt'] as String,
      read: json['readAt'] != null,
      viewCount: 0,
      actionRoute: route,
      source: 'UNigeria',
    );
  }

  final String id;
  final String title;
  final String body;
  final String category;
  final String priority;
  final String createdAt;
  final bool read;
  final int viewCount;
  final String? actionRoute;
  final String source;
}

class ListNotificationsResponse {
  const ListNotificationsResponse({required this.data});

  factory ListNotificationsResponse.fromJson(Map<String, dynamic> json) {
    final list = (json['data'] as List<dynamic>?) ?? [];
    return ListNotificationsResponse(
      data: list
          .cast<Map<String, dynamic>>()
          .map(CivicNotificationItem.fromJson)
          .toList(),
    );
  }

  final List<CivicNotificationItem> data;
}

/// Chat contract (U-p3-01/03). Mirrors `schemas/chat.ts`; see the header note
/// on the hand-maintained mirror. One message envelope shared by REST and WS.
class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.communityId,
    required this.senderId,
    required this.senderName,
    this.senderAvatarKey,
    required this.type,
    this.content,
    this.replyToId,
    this.replyPreview,
    this.attachmentId,
    this.durationMs,
    this.pollId,
    this.reportId,
    required this.moderationStatus,
    this.editedAt,
    this.deletedAt,
    required this.createdAt,
    required this.reactionSummary,
    required this.convertible,
    this.convertCategory,
  });

  factory ChatMessage.fromJson(Map<String, dynamic> json) => ChatMessage(
        id: json['id'] as String,
        communityId: json['communityId'] as String,
        senderId: json['senderId'] as String,
        senderName: json['senderName'] as String,
        senderAvatarKey: json['senderAvatarKey'] as String?,
        type: json['type'] as String,
        content: json['content'] as String?,
        replyToId: json['replyToId'] as String?,
        replyPreview: json['replyPreview'] as String?,
        attachmentId: json['attachmentId'] as String?,
        durationMs: json['durationMs'] as int?,
        pollId: json['pollId'] as String?,
        reportId: json['reportId'] as String?,
        moderationStatus: json['moderationStatus'] as String,
        editedAt: json['editedAt'] as String?,
        deletedAt: json['deletedAt'] as String?,
        createdAt: json['createdAt'] as String,
        reactionSummary: (json['reactionSummary'] as Map<String, dynamic>?)
                ?.map((k, v) => MapEntry(k, v as int)) ??
            const {},
        convertible: json['convertible'] as bool? ?? false,
        convertCategory: json['convertCategory'] as String?,
      );

  final String id;
  final String communityId;
  final String senderId;
  final String senderName;
  final String? senderAvatarKey;
  final String type;
  final String? content;
  final String? replyToId;
  final String? replyPreview;
  final String? attachmentId;
  final int? durationMs;
  final String? pollId;
  final String? reportId;
  final String moderationStatus;
  final String? editedAt;
  final String? deletedAt;
  final String createdAt;
  final Map<String, int> reactionSummary;
  final bool convertible;
  final String? convertCategory;

  /// Same-writer "is this mine" check for bubble alignment.
  bool isFrom(String userId) => senderId == userId;

  ChatMessage copyWith({
    String? id,
    String? communityId,
    String? senderId,
    String? senderName,
    String? senderAvatarKey,
    String? type,
    String? content,
    String? replyToId,
    String? replyPreview,
    String? attachmentId,
    int? durationMs,
    String? pollId,
    String? reportId,
    String? moderationStatus,
    String? editedAt,
    String? deletedAt,
    String? createdAt,
    Map<String, int>? reactionSummary,
    bool? convertible,
    String? convertCategory,
  }) =>
      ChatMessage(
        id: id ?? this.id,
        communityId: communityId ?? this.communityId,
        senderId: senderId ?? this.senderId,
        senderName: senderName ?? this.senderName,
        senderAvatarKey: senderAvatarKey ?? this.senderAvatarKey,
        type: type ?? this.type,
        content: content ?? this.content,
        replyToId: replyToId ?? this.replyToId,
        replyPreview: replyPreview ?? this.replyPreview,
        attachmentId: attachmentId ?? this.attachmentId,
        durationMs: durationMs ?? this.durationMs,
        pollId: pollId ?? this.pollId,
        reportId: reportId ?? this.reportId,
        moderationStatus: moderationStatus ?? this.moderationStatus,
        editedAt: editedAt ?? this.editedAt,
        deletedAt: deletedAt ?? this.deletedAt,
        createdAt: createdAt ?? this.createdAt,
        reactionSummary: reactionSummary ?? this.reactionSummary,
        convertible: convertible ?? this.convertible,
        convertCategory: convertCategory ?? this.convertCategory,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'communityId': communityId,
        'senderId': senderId,
        'senderName': senderName,
        'senderAvatarKey': senderAvatarKey,
        'type': type,
        'content': content,
        'replyToId': replyToId,
        'replyPreview': replyPreview,
        'attachmentId': attachmentId,
        'durationMs': durationMs,
        'pollId': pollId,
        'reportId': reportId,
        'moderationStatus': moderationStatus,
        'editedAt': editedAt,
        'deletedAt': deletedAt,
        'createdAt': createdAt,
        'reactionSummary': reactionSummary,
        'convertible': convertible,
        'convertCategory': convertCategory,
      };
}

class MessageListResponse {
  const MessageListResponse({required this.messages, required this.meta});

  factory MessageListResponse.fromJson(Map<String, dynamic> json) =>
      MessageListResponse(
        messages: (json['messages'] as List<dynamic>)
            .map((e) => ChatMessage.fromJson(e as Map<String, dynamic>))
            .toList(),
        meta: PageMeta.fromJson(json['meta'] as Map<String, dynamic>),
      );

  final List<ChatMessage> messages;
  final PageMeta meta;
}

/// POST body for sending a chat message (TEXT | IMAGE | VOICE).
class SendMessageRequest {
  const SendMessageRequest({
    this.type,
    this.content,
    this.replyToId,
    this.clientId,
    this.attachmentId,
    this.durationMs,
  });

  final String? type;
  final String? content;
  final String? replyToId;
  final String? clientId;
  final String? attachmentId;
  final int? durationMs;

  Map<String, dynamic> toJson() => {
        if (type != null) 'type': type,
        if (content != null) 'content': content,
        if (replyToId != null) 'replyToId': replyToId,
        if (clientId != null) 'clientId': clientId,
        if (attachmentId != null) 'attachmentId': attachmentId,
        if (durationMs != null) 'durationMs': durationMs,
      };
}

class SetReactionResponse {
  const SetReactionResponse({
    required this.messageId,
    required this.emoji,
    required this.count,
    required this.added,
  });

  factory SetReactionResponse.fromJson(Map<String, dynamic> json) =>
      SetReactionResponse(
        messageId: json['messageId'] as String,
        emoji: json['emoji'] as String,
        count: json['count'] as int,
        added: json['added'] as bool,
      );

  final String messageId;
  final String emoji;
  final int count;
  final bool added;
}

class DeleteMessageResponse {
  const DeleteMessageResponse({required this.messageId, required this.deletedAt});

  factory DeleteMessageResponse.fromJson(Map<String, dynamic> json) =>
      DeleteMessageResponse(
        messageId: json['messageId'] as String,
        deletedAt: json['deletedAt'] as String,
      );

  final String messageId;
  final String deletedAt;
}

/// Media upload contract (U-p3-03 + U-p4-01, §74). Mirrors `schemas/upload.ts`.
class PresignUploadRequest {
  const PresignUploadRequest({
    required this.kind,
    required this.mimeType,
    required this.sizeBytes,
    this.durationMs,
    this.scope = 'chat',
  });

  final String kind;
  final String mimeType;
  final int sizeBytes;
  final int? durationMs;

  /// Object-key namespace: `chat` (message attachmentId) or `report`
  /// (report attachment). Chat sends stay on the default; the report flow
  /// mints `reports/{userId}/...` keys the create-report seam accepts.
  final String scope;

  Map<String, dynamic> toJson() => {
        'kind': kind,
        'scope': scope,
        'mimeType': mimeType,
        'sizeBytes': sizeBytes,
        if (durationMs != null) 'durationMs': durationMs,
      };
}

class PresignUploadResponse {
  const PresignUploadResponse({
    required this.uploadUrl,
    required this.method,
    required this.headers,
    required this.storageKey,
    required this.publicUrl,
    required this.kind,
    required this.expiresIn,
  });

  factory PresignUploadResponse.fromJson(Map<String, dynamic> json) =>
      PresignUploadResponse(
        uploadUrl: json['uploadUrl'] as String,
        method: json['method'] as String,
        headers: (json['headers'] as Map<String, dynamic>)
            .map((k, v) => MapEntry(k, v as String)),
        storageKey: json['storageKey'] as String,
        publicUrl: json['publicUrl'] as String,
        kind: json['kind'] as String,
        expiresIn: json['expiresIn'] as int,
      );

  final String uploadUrl;
  final String method;
  final Map<String, String> headers;
  final String storageKey;
  final String publicUrl;
  final String kind;
  final int expiresIn;
}

class FeedResponse {
  const FeedResponse({required this.communityId, required this.items, required this.meta});

  /// A signed-out / community-less user sees an empty feed, never an error.
  const FeedResponse.empty()
      : communityId = null,
        items = const [],
        meta = const PageMeta(nextCursor: null, hasMore: false);

  factory FeedResponse.fromJson(Map<String, dynamic> json) => FeedResponse(
        communityId: json['communityId'] as String?,
        items: (json['items'] as List<dynamic>)
            .map((e) => FeedItem.fromJson(e as Map<String, dynamic>))
            .toList(),
        meta: PageMeta.fromJson(json['meta'] as Map<String, dynamic>),
      );

  final String? communityId;
  final List<FeedItem> items;
  final PageMeta meta;
}

// ---- Trust & safety (U-p3-04, §51) ----

/// Valid reasons a member can flag a message with.
const List<String> kMessageReportReasons = [
  'SPAM',
  'HARASSMENT',
  'SCAM',
  'IMPERSONATION',
  'VIOLENCE',
  'ABUSE',
  'INAPPROPRIATE',
  'OTHER',
];

class BlockUserResponse {
  const BlockUserResponse({
    required this.status,
    required this.blockerId,
    required this.blockedId,
    required this.createdAt,
  });

  factory BlockUserResponse.fromJson(Map<String, dynamic> json) =>
      BlockUserResponse(
        status: json['status'] as String,
        blockerId: json['blockerId'] as String,
        blockedId: json['blockedId'] as String,
        createdAt: json['createdAt'] as String,
      );

  final String status;
  final String blockerId;
  final String blockedId;
  final String createdAt;

  /// Idempotent replay outcome (already blocked before this call).
  bool get alreadyBlocked => status == 'already_blocked';
}

class UnblockUserResponse {
  const UnblockUserResponse({required this.status});
  factory UnblockUserResponse.fromJson(Map<String, dynamic> json) =>
      UnblockUserResponse(status: json['status'] as String);

  final String status;
  bool get wasBlocked => status == 'unblocked';
}

class BlockedUser {
  const BlockedUser({
    required this.userId,
    required this.name,
    this.avatarKey,
    required this.blockedAt,
  });

  factory BlockedUser.fromJson(Map<String, dynamic> json) => BlockedUser(
        userId: json['userId'] as String,
        name: json['name'] as String,
        avatarKey: json['avatarKey'] as String?,
        blockedAt: json['blockedAt'] as String,
      );

  final String userId;
  final String name;
  final String? avatarKey;
  final String blockedAt;
}

class BlockedUsersResponse {
  const BlockedUsersResponse({required this.blocked});
  factory BlockedUsersResponse.fromJson(Map<String, dynamic> json) =>
      BlockedUsersResponse(
        blocked: (json['blocked'] as List<dynamic>)
            .map((e) => BlockedUser.fromJson(e as Map<String, dynamic>))
            .toList(),
      );

  final List<BlockedUser> blocked;
}

class MuteUserResponse {
  const MuteUserResponse({
    required this.status,
    required this.userId,
    required this.communityId,
    this.until,
    required this.active,
  });

  factory MuteUserResponse.fromJson(Map<String, dynamic> json) =>
      MuteUserResponse(
        status: json['status'] as String,
        userId: json['userId'] as String,
        communityId: json['communityId'] as String,
        until: json['until'] as String?,
        active: json['active'] as bool,
      );

  final String status;
  final String userId;
  final String communityId;
  final String? until;
  final bool active;
}

class UnmuteUserResponse {
  const UnmuteUserResponse({required this.status});
  factory UnmuteUserResponse.fromJson(Map<String, dynamic> json) =>
      UnmuteUserResponse(status: json['status'] as String);

  final String status;
  bool get wasMuted => status == 'unmuted';
}

class FlagMessageResponse {
  const FlagMessageResponse({
    required this.status,
    required this.messageId,
    required this.reportId,
    required this.reportStatus,
  });

  factory FlagMessageResponse.fromJson(Map<String, dynamic> json) =>
      FlagMessageResponse(
        status: json['status'] as String,
        messageId: json['messageId'] as String,
        reportId: json['reportId'] as String,
        reportStatus: json['reportStatus'] as String,
      );

  final String status;
  final String messageId;
  final String reportId;
  final String reportStatus;
}

// ---- Reports (U-p4-01, §19) ----

/// Canonical citizen-facing categories (§19 step 1). These exact labels are
/// the single vocabulary the whole product speaks — rendered verbatim by the
/// 7-step flow. Mirrors `REPORT_CATEGORIES` in `schemas/report.ts`.
const List<String> kReportCategories = [
  'Security',
  'Fire',
  'Flooding',
  'Roads',
  'Power',
  'Water',
  'Waste',
  'Health',
  'Infrastructure',
  'Education',
  'Environment',
  'Public transport',
  'Corruption & misconduct',
  'Community services',
  'Other',
];

/// Severity ladder (§19 step 5). EMERGENCY escalates with dedicated language.
const List<String> kReportSeverities = ['NORMAL', 'URGENT', 'EMERGENCY'];

/// Visibility (§27/§28). Sensitive categories are forced PRIVATE server-side;
/// the client never widens them.
const List<String> kReportVisibilities = ['PRIVATE', 'COMMUNITY', 'PUBLIC'];

/// Categories that are always PRIVATE on the wire, never widened (§27).
/// Mirrors FORCED_PRIVATE_CATEGORIES in report-create.service.ts.
const Set<String> kForcedPrivateCategories = {'Security', 'Corruption & misconduct'};

/// An attachment reference from the presign seam (U-p4-01 step 4). The object
/// is already uploaded to R2; this points the report at it. `kind` is the
/// UPPERCASE wire kind (IMAGE|VIDEO|VOICE|DOCUMENT) — distinct from the
/// lowercase `PresignUploadRequest.kind`.
class ReportAttachmentInput {
  const ReportAttachmentInput({
    required this.kind,
    required this.storageKey,
    required this.publicUrl,
    required this.mimeType,
    required this.sizeBytes,
    this.durationMs,
  });

  factory ReportAttachmentInput.fromJson(Map<String, dynamic> json) =>
      ReportAttachmentInput(
        kind: json['kind'] as String,
        storageKey: json['storageKey'] as String,
        publicUrl: json['publicUrl'] as String,
        mimeType: json['mimeType'] as String,
        sizeBytes: json['sizeBytes'] as int,
        durationMs: json['durationMs'] as int?,
      );

  final String kind;
  final String storageKey;
  final String publicUrl;
  final String mimeType;
  final int sizeBytes;
  final int? durationMs;

  Map<String, dynamic> toJson() => {
        'kind': kind,
        'storageKey': storageKey,
        'publicUrl': publicUrl,
        'mimeType': mimeType,
        'sizeBytes': sizeBytes,
        if (durationMs != null) 'durationMs': durationMs,
      };
}

/// Location model (U-p4-01 step 3). Exact coordinates never travel the wire
/// contract (§47) — only geography references + a free-text place description.
class ReportLocation {
  const ReportLocation({
    this.communityId,
    this.lgaId,
    this.stateId,
    this.locationDesc,
  });

  factory ReportLocation.fromJson(Map<String, dynamic> json) => ReportLocation(
        communityId: json['communityId'] as String?,
        lgaId: json['lgaId'] as String?,
        stateId: json['stateId'] as String?,
        locationDesc: json['locationDesc'] as String?,
      );

  final String? communityId;
  final String? lgaId;
  final String? stateId;
  final String? locationDesc;

  Map<String, dynamic> toJson() => {
        'communityId': communityId,
        'lgaId': lgaId,
        'stateId': stateId,
        if (locationDesc != null) 'locationDesc': locationDesc,
      };
}

/// POST body for POST /reports — submit a report from the 7-step flow. The
/// client submits the resolved state of a local draft (never silently lost).
class CreateReportBody {
  const CreateReportBody({
    required this.category,
    required this.description,
    required this.location,
    required this.attachments,
    required this.severity,
    required this.visibility,
    this.sourceCommunityId,
  });

  final String category;
  final String description;
  final ReportLocation location;
  final List<ReportAttachmentInput> attachments;
  final String severity;
  final String visibility;
  final String? sourceCommunityId;

  Map<String, dynamic> toJson() => {
        'category': category,
        'description': description,
        'location': location.toJson(),
        'attachments': [for (final a in attachments) a.toJson()],
        'severity': severity,
        'visibility': visibility,
        if (sourceCommunityId != null) 'sourceCommunityId': sourceCommunityId,
      };
}

/// A report as returned when it is created. The public reference
/// (`UN-YYYY-NNNNNN`) is the citizen-facing id used everywhere outside the API.
class ReportSummary {
  const ReportSummary({
    required this.id,
    required this.publicRef,
    required this.category,
    required this.description,
    this.communityId,
    required this.severity,
    required this.status,
    required this.visibility,
    required this.createdAt,
  });

  factory ReportSummary.fromJson(Map<String, dynamic> json) => ReportSummary(
        id: json['id'] as String,
        publicRef: json['publicRef'] as String,
        category: json['category'] as String,
        description: json['description'] as String,
        communityId: json['communityId'] as String?,
        severity: json['severity'] as String,
        status: json['status'] as String,
        visibility: json['visibility'] as String,
        createdAt: json['createdAt'] as String,
      );

  final String id;
  final String publicRef;
  final String category;
  final String description;
  final String? communityId;
  final String severity;
  final String status;
  final String visibility;
  final String createdAt;
}

class CreateReportResponse {
  const CreateReportResponse({required this.report});

  factory CreateReportResponse.fromJson(Map<String, dynamic> json) =>
      CreateReportResponse(
        report: ReportSummary.fromJson(json['report'] as Map<String, dynamic>),
      );

  final ReportSummary report;
}

/// A stored report attachment (U-p4-02 track screen) — mirrors
/// ReportAttachmentInput but with the server-owned tier/scan fields.
class ReportAttachment {
  const ReportAttachment({
    required this.id,
    required this.kind,
    required this.tier,
    required this.storageKey,
    required this.publicUrl,
    required this.mimeType,
    required this.sizeBytes,
    this.durationMs,
  });

  factory ReportAttachment.fromJson(Map<String, dynamic> json) =>
      ReportAttachment(
        id: json['id'] as String,
        kind: json['kind'] as String,
        tier: json['tier'] as String,
        storageKey: json['storageKey'] as String,
        publicUrl: json['publicUrl'] as String,
        mimeType: json['mimeType'] as String,
        sizeBytes: json['sizeBytes'] as int,
        durationMs: json['durationMs'] as int?,
      );

  final String id;
  final String kind;
  final String tier;
  final String storageKey;
  final String publicUrl;
  final String mimeType;
  final int sizeBytes;
  final int? durationMs;
}

/// One §57 audit-trail entry. `status` is the report status REACHED by the
/// transition — the timeline reads as: Submitted → Received → … (U-p4-02).
class ReportTimelineEntry {
  const ReportTimelineEntry({
    required this.id,
    required this.status,
    this.note,
    this.actorLabel,
    required this.createdAt,
  });

  factory ReportTimelineEntry.fromJson(Map<String, dynamic> json) =>
      ReportTimelineEntry(
        id: json['id'] as String,
        status: json['status'] as String,
        note: json['note'] as String?,
        actorLabel: json['actorLabel'] as String?,
        createdAt: json['createdAt'] as String,
      );

  final String id;
  final String status;
  final String? note;
  final String? actorLabel;
  final String createdAt;
}

/// Full detail from GET /reports/:publicRef (track screen, U-p4-02).
class ReportDetail {
  const ReportDetail({
    required this.report,
    required this.location,
    required this.attachments,
    this.updatedAt,
    required this.timeline,
  });

  factory ReportDetail.fromJson(Map<String, dynamic> json) => ReportDetail(
        report: ReportSummary.fromJson(json['report'] as Map<String, dynamic>),
        location: ReportLocation.fromJson(json['location'] as Map<String, dynamic>),
        attachments: [
          for (final a in json['attachments'] as List<dynamic>)
            ReportAttachment.fromJson(a as Map<String, dynamic>),
        ],
        updatedAt: json['updatedAt'] as String?,
        timeline: [
          for (final e in json['timeline'] as List<dynamic>)
            ReportTimelineEntry.fromJson(e as Map<String, dynamic>),
        ],
      );

  final ReportSummary report;
  final ReportLocation location;
  final List<ReportAttachment> attachments;
  final String? updatedAt;
  final List<ReportTimelineEntry> timeline;
}

/// Response of GET /reports/mine — the caller's own reports, newest first,
/// with an opaque keyset cursor (null when there are no more pages).
class ListMyReportsResponse {
  const ListMyReportsResponse({required this.reports, this.cursor});

  factory ListMyReportsResponse.fromJson(Map<String, dynamic> json) =>
      ListMyReportsResponse(
        reports: [
          for (final r in json['reports'] as List<dynamic>)
            ReportSummary.fromJson(r as Map<String, dynamic>),
        ],
        cursor: json['cursor'] as String?,
      );

  final List<ReportSummary> reports;
  final String? cursor;
}

// ---------------------------------------------------------------------------
// Polls (U-p6-02) — mirrors `packages/contracts/src/schemas/polls.ts`.
// ---------------------------------------------------------------------------

/// A poll card in list responses (PollCardSchema): scope/type/status are wire
/// values ('GLOBAL' | 'STATES' | 'COMMUNITIES', 'SINGLE' | 'MULTI' | 'YESNO' |
/// 'RATING', 'ACTIVE' | 'CLOSED').
class PollCard {
  const PollCard({
    required this.id,
    required this.title,
    required this.type,
    required this.scope,
    required this.status,
    required this.voteCount,
    required this.targetCount,
    required this.createdAt,
    this.closesAt,
  });

  factory PollCard.fromJson(Map<String, dynamic> json) => PollCard(
        id: json['id'] as String,
        title: json['title'] as String,
        type: json['type'] as String,
        scope: json['scope'] as String,
        status: json['status'] as String,
        closesAt: json['closesAt'] as String?,
        voteCount: json['voteCount'] as int,
        targetCount: json['targetCount'] as int,
        createdAt: json['createdAt'] as String,
      );

  final String id;
  final String title;
  final String type;
  final String scope;
  final String status;
  final String? closesAt;
  final int voteCount;
  final int targetCount;
  final String createdAt;
}

class PollListResponse {
  const PollListResponse({required this.items, required this.meta, this.communityId});

  factory PollListResponse.fromJson(Map<String, dynamic> json) => PollListResponse(
        communityId: json['communityId'] as String?,
        items: [
          for (final p in json['items'] as List<dynamic>)
            PollCard.fromJson(p as Map<String, dynamic>),
        ],
        meta: PageMeta.fromJson(json['meta'] as Map<String, dynamic>),
      );

  final String? communityId;
  final List<PollCard> items;
  final PageMeta meta;
}

class PollOptionResult {
  const PollOptionResult({
    required this.id,
    required this.label,
    required this.order,
    required this.voteCount,
  });

  factory PollOptionResult.fromJson(Map<String, dynamic> json) => PollOptionResult(
        id: json['id'] as String,
        label: json['label'] as String,
        order: json['order'] as int,
        voteCount: json['voteCount'] as int,
      );

  final String id;
  final String label;
  final int order;
  final int voteCount;
}

class PollParticipation {
  const PollParticipation({required this.voters, required this.members});

  factory PollParticipation.fromJson(Map<String, dynamic> json) =>
      PollParticipation(
        voters: json['voters'] as int,
        members: json['members'] as int,
      );

  /// Distinct citizens who voted (one submission, final).
  final int voters;
  final int members;
}

class PollResults {
  const PollResults({
    required this.totalVotes,
    required this.options,
    required this.participation,
  });

  factory PollResults.fromJson(Map<String, dynamic> json) => PollResults(
        totalVotes: json['totalVotes'] as int,
        options: [
          for (final o in json['options'] as List<dynamic>)
            PollOptionResult.fromJson(o as Map<String, dynamic>),
        ],
        participation: PollParticipation.fromJson(json['participation'] as Map<String, dynamic>),
      );

  final int totalVotes;
  final List<PollOptionResult> options;
  final PollParticipation participation;
}

/// Full poll detail (PollDetailSchema): live results + the caller's own vote.
class PollDetail {
  const PollDetail({
    required this.id,
    required this.title,
    required this.type,
    required this.scope,
    required this.scopeLabel,
    required this.status,
    required this.createdAt,
    required this.options,
    required this.myOptionIds,
    required this.totalVotes,
    required this.participation,
    this.closesAt,
  });

  factory PollDetail.fromJson(Map<String, dynamic> json) => PollDetail(
        id: json['id'] as String,
        title: json['title'] as String,
        type: json['type'] as String,
        scope: json['scope'] as String,
        scopeLabel: json['scopeLabel'] as String,
        status: json['status'] as String,
        closesAt: json['closesAt'] as String?,
        createdAt: json['createdAt'] as String,
        options: [
          for (final o in json['options'] as List<dynamic>)
            PollOptionResult.fromJson(o as Map<String, dynamic>),
        ],
        myOptionIds: [
          for (final id in json['myOptionIds'] as List<dynamic>) id as String,
        ],
        totalVotes: json['totalVotes'] as int,
        participation: PollParticipation.fromJson(json['participation'] as Map<String, dynamic>),
      );

  final String id;
  final String title;
  final String type;
  final String scope;
  final String scopeLabel;
  final String status;
  final String? closesAt;
  final String createdAt;
  final List<PollOptionResult> options;
  final List<String> myOptionIds;
  final int totalVotes;
  final PollParticipation participation;

  /// Whether the caller has already submitted (votes are final — no switching).
  bool get hasVoted => myOptionIds.isNotEmpty;
}

class VotePollBody {
  const VotePollBody({required this.optionIds});

  final List<String> optionIds;

  Map<String, dynamic> toJson() => {'optionIds': optionIds};
}

class VotePollResponse {
  const VotePollResponse({
    required this.pollId,
    required this.optionIds,
    required this.results,
  });

  factory VotePollResponse.fromJson(Map<String, dynamic> json) =>
      VotePollResponse(
        pollId: json['pollId'] as String,
        optionIds: [
          for (final id in json['optionIds'] as List<dynamic>) id as String,
        ],
        results: PollResults.fromJson(json['results'] as Map<String, dynamic>),
      );

  final String pollId;
  final List<String> optionIds;
  final PollResults results;
}

/// Admin poll queue item (AdminPollItemSchema = PollCard + optionCount).
class AdminPollItem {
  const AdminPollItem({
    required this.id,
    required this.title,
    required this.type,
    required this.scope,
    required this.status,
    required this.voteCount,
    required this.targetCount,
    required this.optionCount,
    required this.createdAt,
    this.closesAt,
  });

  factory AdminPollItem.fromJson(Map<String, dynamic> json) => AdminPollItem(
        id: json['id'] as String,
        title: json['title'] as String,
        type: json['type'] as String,
        scope: json['scope'] as String,
        status: json['status'] as String,
        closesAt: json['closesAt'] as String?,
        voteCount: json['voteCount'] as int,
        targetCount: json['targetCount'] as int,
        optionCount: json['optionCount'] as int,
        createdAt: json['createdAt'] as String,
      );

  final String id;
  final String title;
  final String type;
  final String scope;
  final String status;
  final String? closesAt;
  final int voteCount;
  final int targetCount;
  final int optionCount;
  final String createdAt;
}

class AdminPollListResponse {
  const AdminPollListResponse({required this.items, required this.meta});

  factory AdminPollListResponse.fromJson(Map<String, dynamic> json) =>
      AdminPollListResponse(
        items: [
          for (final p in json['items'] as List<dynamic>)
            AdminPollItem.fromJson(p as Map<String, dynamic>),
        ],
        meta: PageMeta.fromJson(json['meta'] as Map<String, dynamic>),
      );

  final List<AdminPollItem> items;
  final PageMeta meta;
}

/// One deployment target with its resolved display name (admin edit form).
class AdminPollTarget {
  const AdminPollTarget({
    required this.kind,
    required this.targetId,
    required this.name,
  });

  factory AdminPollTarget.fromJson(Map<String, dynamic> json) => AdminPollTarget(
        kind: json['kind'] as String,
        targetId: json['targetId'] as String,
        name: json['name'] as String,
      );

  final String kind;
  final String targetId;
  final String name;

  PollTargetInput toInput() => PollTargetInput(kind: kind, targetId: targetId);
}

/// Full poll for the admin edit form: everything the update payload can touch,
/// live option counts (voted options are not editable/removable), resolved
/// targets. Participation is deliberately absent (no community context).
class AdminPollDetail {
  const AdminPollDetail({
    required this.id,
    required this.title,
    required this.type,
    required this.scope,
    required this.status,
    required this.createdAt,
    required this.options,
    required this.targets,
    required this.totalVotes,
    this.closesAt,
  });

  factory AdminPollDetail.fromJson(Map<String, dynamic> json) => AdminPollDetail(
        id: json['id'] as String,
        title: json['title'] as String,
        type: json['type'] as String,
        scope: json['scope'] as String,
        status: json['status'] as String,
        closesAt: json['closesAt'] as String?,
        createdAt: json['createdAt'] as String,
        options: [
          for (final o in json['options'] as List<dynamic>)
            PollOptionResult.fromJson(o as Map<String, dynamic>),
        ],
        targets: [
          for (final t in json['targets'] as List<dynamic>)
            AdminPollTarget.fromJson(t as Map<String, dynamic>),
        ],
        totalVotes: json['totalVotes'] as int,
      );

  final String id;
  final String title;
  final String type;
  final String scope;
  final String status;
  final String? closesAt;
  final String createdAt;
  final List<PollOptionResult> options;
  final List<AdminPollTarget> targets;
  final int totalVotes;
}

/// One option in an admin create/update payload. `id` present = edit an
/// existing option; absent = create a new one.
class AdminPollOptionInput {
  const AdminPollOptionInput({
    required this.label,
    required this.order,
    this.id,
  });

  final String? id;
  final String label;
  final int order;

  Map<String, dynamic> toJson() => {
        if (id != null) 'id': id,
        'label': label,
        'order': order,
      };
}

/// One deployment target: kind STATE (state-scope polls) or COMMUNITY
/// (community-scope polls). Never mixed (service rejects invalid pairs).
class PollTargetInput {
  const PollTargetInput({required this.kind, required this.targetId});

  final String kind;
  final String targetId;

  Map<String, dynamic> toJson() => {'kind': kind, 'targetId': targetId};
}

/// POST /admin/polls (AdminPollCreateBodySchema). Community-scope polls need
/// >= 1 target; states may pass none (= all states); GLOBAL must pass none.
class CreatePollBody {
  const CreatePollBody({
    required this.title,
    required this.type,
    required this.scope,
    required this.options,
    this.targets = const [],
    this.closesAt,
    this.status = 'ACTIVE',
  });

  final String title;
  final String type;
  final String scope;
  final List<PollTargetInput> targets;
  final List<AdminPollOptionInput> options;
  final String? closesAt;
  final String status;

  Map<String, dynamic> toJson() => {
        'title': title,
        'type': type,
        'scope': scope,
        'targets': [for (final t in targets) t.toJson()],
        'options': [for (final o in options) o.toJson()],
        if (closesAt != null) 'closesAt': closesAt,
        'status': status,
      };
}

/// PATCH /admin/polls/:pollId — at least one field required (contract refine).
class UpdatePollBody {
  const UpdatePollBody({
    this.title,
    this.type,
    this.scope,
    this.targets,
    this.options,
    this.closesAt,
    this.status,
  });

  final String? title;
  final String? type;
  final String? scope;
  final List<PollTargetInput>? targets;
  final List<AdminPollOptionInput>? options;
  final String? closesAt;
  final String? status;

  Map<String, dynamic> toJson() => {
        if (title != null) 'title': title,
        if (type != null) 'type': type,
        if (scope != null) 'scope': scope,
        if (targets != null)
          'targets': [for (final t in targets!) t.toJson()],
        if (options != null)
          'options': [for (final o in options!) o.toJson()],
        if (closesAt != null) 'closesAt': closesAt,
        if (status != null) 'status': status,
      };
}

class DeletePollResponse {
  const DeletePollResponse({required this.pollId, required this.deleted});

  factory DeletePollResponse.fromJson(Map<String, dynamic> json) =>
      DeletePollResponse(
        pollId: json['pollId'] as String,
        deleted: json['deleted'] as bool,
      );

  final String pollId;
  final bool deleted;
}

// ---------------------------------------------------------------------------
// App config (U-p6-02) — mirrors `packages/contracts/src/schemas/app-config.ts`.
// ---------------------------------------------------------------------------

/// The 2027 election timetable served by the API (never hardcoded client-side;
/// the seeded `election.2027` AppConfig row is the single source of truth).
class AppConfigElection {
  const AppConfigElection({
    required this.presidentialDate,
    required this.governorshipDate,
    required this.presidentialLabel,
    required this.governorshipLabel,
    required this.source,
    required this.updatedAt,
    this.electionPollId,
  });

  factory AppConfigElection.fromJson(Map<String, dynamic> json) =>
      AppConfigElection(
        presidentialDate: json['presidentialDate'] as String,
        governorshipDate: json['governorshipDate'] as String,
        presidentialLabel: json['presidentialLabel'] as String,
        governorshipLabel: json['governorshipLabel'] as String,
        source: json['source'] as String,
        updatedAt: json['updatedAt'] as String,
        electionPollId: json['electionPollId'] as String?,
      );

  final String presidentialDate;
  final String governorshipDate;
  final String presidentialLabel;
  final String governorshipLabel;
  final String source;
  final String updatedAt;

  /// Deep-link target for the home countdown banner → election poll detail.
  final String? electionPollId;
}

class AppConfigResponse {
  const AppConfigResponse({this.election});

  factory AppConfigResponse.fromJson(Map<String, dynamic> json) =>
      AppConfigResponse(
        election: json['election'] == null
            ? null
            : AppConfigElection.fromJson(json['election'] as Map<String, dynamic>),
      );

  final AppConfigElection? election;
}

// ---------------------------------------------------------------------------
// Issues (U-p4-04, §33/§34/§69) — mirrors
// `packages/contracts/src/schemas/issue.ts`. An Issue is the DEDUPLICATED,
// citizen-confirmable container for reports about the same problem (§69);
// confirmations are unique per user per issue (anti-inflation, §34).
// ---------------------------------------------------------------------------

/// An issue as listed on the priority board (IssueItemSchema). Status wire
/// values: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'.
class IssueItem {
  const IssueItem({
    required this.id,
    required this.title,
    required this.category,
    required this.status,
    required this.priorityScore,
    required this.confirmations,
    required this.reports,
    required this.canonicalReportId,
    required this.createdAt,
    this.communityId,
  });

  factory IssueItem.fromJson(Map<String, dynamic> json) => IssueItem(
        id: json['id'] as String,
        title: json['title'] as String,
        category: json['category'] as String,
        status: json['status'] as String,
        communityId: json['communityId'] as String?,
        priorityScore: (json['priorityScore'] as num).toDouble(),
        confirmations: json['confirmations'] as int,
        reports: json['reports'] as int,
        canonicalReportId: json['canonicalReportId'] as String,
        createdAt: json['createdAt'] as String,
      );

  final String id;
  final String title;
  final String category;
  final String status;

  /// Community the issue belongs to (null = no community context).
  final String? communityId;

  /// Computed priority (confirmations × severity weight × recency decay);
  /// the ordering key of the §33 board.
  final double priorityScore;

  /// Unique citizen confirmations (anti-inflation: one per user per issue).
  final int confirmations;

  /// Reports grouped into this issue (includes the canonical report).
  final int reports;

  /// The first report that seeded the issue (1:1 with the issue).
  final String canonicalReportId;

  final String createdAt;
}

/// Full issue — detail view (IssueDetailSchema): canonical description +
/// location context added to the list-item shape.
class IssueDetail extends IssueItem {
  const IssueDetail({
    required super.id,
    required super.title,
    required super.category,
    required super.status,
    required super.priorityScore,
    required super.confirmations,
    required super.reports,
    required super.canonicalReportId,
    required super.createdAt,
    required this.description,
    required this.updatedAt,
    super.communityId,
    this.lgaId,
    this.stateId,
  });

  factory IssueDetail.fromJson(Map<String, dynamic> json) => IssueDetail(
        id: json['id'] as String,
        title: json['title'] as String,
        category: json['category'] as String,
        status: json['status'] as String,
        communityId: json['communityId'] as String?,
        priorityScore: (json['priorityScore'] as num).toDouble(),
        confirmations: json['confirmations'] as int,
        reports: json['reports'] as int,
        canonicalReportId: json['canonicalReportId'] as String,
        createdAt: json['createdAt'] as String,
        description: json['description'] as String,
        lgaId: json['lgaId'] as String?,
        stateId: json['stateId'] as String?,
        updatedAt: json['updatedAt'] as String,
      );

  /// Canonical report description (the first report's text).
  final String description;
  final String? lgaId;
  final String? stateId;
  final String updatedAt;
}

/// Issue list for a community (priority board).
class IssueListResponse {
  const IssueListResponse({
    required this.items,
    required this.meta,
    this.communityId,
  });

  factory IssueListResponse.fromJson(Map<String, dynamic> json) =>
      IssueListResponse(
        communityId: json['communityId'] as String?,
        items: [
          for (final i in json['items'] as List<dynamic>)
            IssueItem.fromJson(i as Map<String, dynamic>),
        ],
        meta: PageMeta.fromJson(json['meta'] as Map<String, dynamic>),
      );

  final String? communityId;
  final List<IssueItem> items;
  final PageMeta meta;
}

/// Result of confirming an issue (ConfirmIssueResponseSchema). `alreadyConfirmed`
/// is true on an idempotent replay — the count never inflates (§34).
class ConfirmIssueResponse {
  const ConfirmIssueResponse({
    required this.issueId,
    required this.alreadyConfirmed,
    required this.confirmations,
    required this.priorityScore,
  });

  factory ConfirmIssueResponse.fromJson(Map<String, dynamic> json) =>
      ConfirmIssueResponse(
        issueId: json['issueId'] as String,
        alreadyConfirmed: json['alreadyConfirmed'] as bool,
        confirmations: json['confirmations'] as int,
        priorityScore: (json['priorityScore'] as num).toDouble(),
      );

  final String issueId;
  final bool alreadyConfirmed;
  final int confirmations;
  final double priorityScore;
}

/// Citizen rating of a resolved report's outcome (FeedbackOutcomeSchema, §44/§128).
enum FeedbackOutcome { yes, partially, no }

/// Extension: enum value → the wire string the API expects.
extension FeedbackOutcomeCode on FeedbackOutcome {
  String get code => switch (this) {
        FeedbackOutcome.yes => 'YES',
        FeedbackOutcome.partially => 'PARTIALLY',
        FeedbackOutcome.no => 'NO',
      };
}

/// POST /reports/{reportId}/feedback body (FeedbackBodySchema).
class FeedbackBody {
  const FeedbackBody({required this.outcome, this.note});

  factory FeedbackBody.fromOutcome(FeedbackOutcome outcome, {String? note}) =>
      FeedbackBody(outcome: outcome, note: note);

  final FeedbackOutcome outcome;
  final String? note;

  Map<String, dynamic> toJson() => {
        'outcome': outcome.code,
        if (note != null) 'note': note,
      };
}

/// Result of submitting citizen feedback (FeedbackResponseSchema). `alreadyFeedback`
/// is true on an idempotent replay — the citizen can never rate twice (§128).
class FeedbackResponse {
  const FeedbackResponse({
    required this.reportId,
    required this.alreadyFeedback,
    required this.outcome,
    required this.createdAt,
  });

  factory FeedbackResponse.fromJson(Map<String, dynamic> json) => FeedbackResponse(
        reportId: json['reportId'] as String,
        alreadyFeedback: json['alreadyFeedback'] as bool,
        outcome: FeedbackOutcome.values.firstWhere(
          (o) => o.code == json['outcome'],
          orElse: () => FeedbackOutcome.no,
        ),
        createdAt: json['createdAt'] as String,
      );

  final String reportId;
  final bool alreadyFeedback;
  final FeedbackOutcome outcome;
  final String createdAt;
}

// ---------------------------------------------------------------------------
// Organizations & verification (U-p5-01, §54/§55/§56/§137–§140)
//
// C6 (never self-declare): `applyOrg` always lands PENDING/SUBMITTED — only a
// PLATFORM_ADMIN can advance a claim. Mirrors `schemas/org.ts`.
// ---------------------------------------------------------------------------

/// Organization types (directory categories — §54).
enum OrgType { security, emergency, road, health, government, ngo }

/// Extension: enum value → the wire string the API expects.
extension OrgTypeCode on OrgType {
  String get code => switch (this) {
        OrgType.security => 'Security',
        OrgType.emergency => 'Emergency',
        OrgType.road => 'Road',
        OrgType.health => 'Health',
        OrgType.government => 'Government',
        OrgType.ngo => 'NGO',
      };
}

/// Organization list/detail item (public directory + apply result).
class OrgSummary {
  const OrgSummary({
    required this.id,
    required this.name,
    required this.type,
    required this.description,
    required this.verificationStatus,
    required this.verifiedAt,
    required this.createdAt,
  });

  factory OrgSummary.fromJson(Map<String, dynamic> json) => OrgSummary(
        id: json['id'] as String,
        name: json['name'] as String,
        type: json['type'] as String,
        description: json['description'] as String?,
        verificationStatus: json['verificationStatus'] as String,
        verifiedAt: json['verifiedAt'] as String?,
        createdAt: json['createdAt'] as String,
      );

  final String id;
  final String name;
  final String type;
  final String? description;

  /// Lifecycle of the claim: PENDING | SUBMITTED | APPROVED | REJECTED | REVOKED.
  final String verificationStatus;
  final String? verifiedAt;
  final String createdAt;

  bool get isVerified => verificationStatus == 'APPROVED';
}

/// POST /orgs/apply — self-serve verification claim. C6: the body carries NO
/// status field; the server always lands PENDING + SUBMITTED.
class OrgApplyBody {
  const OrgApplyBody({
    required this.name,
    required this.type,
    this.description,
    this.officialDomain,
    this.role,
    this.authorizationRef,
  });

  final String name;
  final OrgType type;
  final String? description;
  final String? officialDomain;
  final String? role;
  final String? authorizationRef;

  Map<String, dynamic> toJson() => {
        'name': name,
        'type': type.code,
        if (description != null) 'description': description,
        if (officialDomain != null) 'officialDomain': officialDomain,
        if (role != null) 'role': role,
        if (authorizationRef != null) 'authorizationRef': authorizationRef,
      };
}

/// Result of a verification claim — always PENDING/SUBMITTED (C6).
class OrgApplyResponse {
  const OrgApplyResponse({required this.org, required this.verification});

  factory OrgApplyResponse.fromJson(Map<String, dynamic> json) =>
      OrgApplyResponse(
        org: OrgSummary.fromJson(json['org'] as Map<String, dynamic>),
        verification: OrgVerification.fromJson(
            json['verification'] as Map<String, dynamic>),
      );

  final OrgSummary org;
  final OrgVerification verification;
}

/// The verification record returned from an apply (id/status/submittedAt).
class OrgVerification {
  const OrgVerification({
    required this.id,
    required this.status,
    required this.createdAt,
  });

  factory OrgVerification.fromJson(Map<String, dynamic> json) =>
      OrgVerification(
        id: json['id'] as String,
        status: json['status'] as String,
        createdAt: json['createdAt'] as String,
      );

  final String id;
  final String status;
  final String createdAt;
}

/// Public view of an organization's service scope (no escalation/SLA internals).
class OrgScopeView {
  const OrgScopeView({
    required this.stateIds,
    required this.lgaIds,
    required this.communityIds,
    required this.categories,
    required this.emergencyAvailable,
    this.operatingHours,
  });

  factory OrgScopeView.fromJson(Map<String, dynamic> json) => OrgScopeView(
        stateIds: [for (final s in json['stateIds'] as List<dynamic>) s as String],
        lgaIds: [for (final s in json['lgaIds'] as List<dynamic>) s as String],
        communityIds: [
          for (final s in json['communityIds'] as List<dynamic>) s as String,
        ],
        categories: [
          for (final c in json['categories'] as List<dynamic>) c as String,
        ],
        operatingHours: json['operatingHours'] as Map<String, dynamic>?,
        emergencyAvailable: json['emergencyAvailable'] as bool,
      );

  final List<String> stateIds;
  final List<String> lgaIds;
  final List<String> communityIds;
  final List<String> categories;
  final Map<String, dynamic>? operatingHours;
  final bool emergencyAvailable;
}

/// GET /orgs/:orgId — public detail of a verified org (scope included).
class OrgDetail extends OrgSummary {
  const OrgDetail({
    required super.id,
    required super.name,
    required super.type,
    required super.description,
    required super.verificationStatus,
    required super.verifiedAt,
    required super.createdAt,
    required this.scope,
  });

  factory OrgDetail.fromJson(Map<String, dynamic> json) => OrgDetail(
        id: json['id'] as String,
        name: json['name'] as String,
        type: json['type'] as String,
        description: json['description'] as String?,
        verificationStatus: json['verificationStatus'] as String,
        verifiedAt: json['verifiedAt'] as String?,
        createdAt: json['createdAt'] as String,
        scope: json['scope'] == null
            ? null
            : OrgScopeView.fromJson(json['scope'] as Map<String, dynamic>),
      );

  final OrgScopeView? scope;
}

/// GET /orgs — verified-only public directory (newest first, cursor).
class OrgListResponse {
  const OrgListResponse({required this.items, required this.meta});

  factory OrgListResponse.fromJson(Map<String, dynamic> json) =>
      OrgListResponse(
        items: [
          for (final i in json['items'] as List<dynamic>)
            OrgSummary.fromJson(i as Map<String, dynamic>),
        ],
        meta: PageMeta.fromJson(json['meta'] as Map<String, dynamic>),
      );

  final List<OrgSummary> items;
  final PageMeta meta;
}

// ---------------------------------------------------------------------------
// Voice reporting (U-p4-06, §65) — mirrors `schemas/voice.ts`.
// Record → upload (presign scope report) → transcribe → REVIEW (editable) →
// submit. Transcript is ALWAYS editable; submit blocked until review.
// ---------------------------------------------------------------------------

/// POST /voice/transcribe body.
class TranscribeVoiceBody {
  const TranscribeVoiceBody({required this.storageKey, this.language});

  final String storageKey;
  final String? language;

  Map<String, dynamic> toJson() => {
        'storageKey': storageKey,
        if (language != null) 'language': language,
      };
}

/// POST /voice/transcribe response — editable transcript for review.
class TranscribeVoiceResponse {
  const TranscribeVoiceResponse({
    required this.transcript,
    required this.language,
    this.confidence,
  });

  factory TranscribeVoiceResponse.fromJson(Map<String, dynamic> json) =>
      TranscribeVoiceResponse(
        transcript: json['transcript'] as String,
        language: json['language'] as String,
        confidence: json['confidence'] == null ? null : (json['confidence'] as num).toDouble(),
      );

  final String transcript;
  final String language;
  final double? confidence;
}
