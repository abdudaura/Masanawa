import 'package:dio/dio.dart';

import '../api/models.dart';
import '../api/billing_models.dart';
import '../api/account_deletion_models.dart';

/// Masanawa production Gateway. A build may override this for staging, but
/// users never configure runtime URLs or credentials inside the app.
const String kApiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'https://masanawa-gateway-production.up.railway.app',
);

/// Thrown for contract-level / transport failures with a message safe to show.
class ApiException implements Exception {
  const ApiException(this.message, {this.statusCode, this.code});
  final String message;
  final int? statusCode;

  /// Contract error code from the API error envelope (e.g. `OTP_LOCKED`).
  final String? code;

  @override
  String toString() => message;
}

/// Typed API client. Pure Dio transport + contract-shaped DTOs; no UI, no
/// state. Auth and geo surfaces per `packages/contracts`.
class ApiClient {
  ApiClient({required this.dio}) {
    // Base URL applied here so tests can pass their own Dio without touching
    // the global default.
    if (dio.options.baseUrl.isEmpty) {
      dio.options.baseUrl = kApiBaseUrl;
    }

    // Auth interceptor: (1) attaches the bearer token to every request from
    // `accessToken` (single source of truth — callers never set the header
    // themselves); (2) on a 401, asks [onUnauthorized] for a fresh token
    // (the session controller rotates the refresh token), retries the request
    // once, and otherwise lets the 401 surface as a normal session-expired
    // error. Refresh/OTP endpoints never self-trigger a refresh (a dead
    // refresh token must propagate so the session clears).
    dio.interceptors.add(
      QueuedInterceptorsWrapper(
        onRequest: (options, handler) {
          // A retry retains the original epoch. A queued request from A must
          // never be dispatched using B's bearer after an account switch.
          if (_isProtected(options.path)) {
            final expected = options.extra.putIfAbsent(
              _requestEpochKey, () => _sessionEpoch,
            );
            if (expected != _sessionEpoch) {
              handler.reject(_accountChanged(options));
              return;
            }
          }
          final token = accessToken;
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          } else {
            options.headers.remove('Authorization');
          }
          handler.next(options);
        },
        onResponse: (response, handler) {
          if (_isStale(response.requestOptions)) {
            handler.reject(_accountChanged(response.requestOptions));
          } else {
            handler.next(response);
          }
        },
        onError: (e, handler) async {
          final options = e.requestOptions;
          if (_isStale(options)) {
            handler.reject(_accountChanged(options));
            return;
          }
          final path = options.path;
          final canRefresh = onUnauthorized != null &&
              _isProtected(path) &&
              options.headers['Authorization'] is String &&
              !path.contains('/auth/refresh') &&
              !path.contains('/auth/otp') &&
              !path.contains('/auth/verify');
          if (e.response?.statusCode == 401 &&
              canRefresh &&
              options.extra['masanawaAuthRetried'] != true) {
            final originalEpoch = _sessionEpoch;
            try {
              // Another in-session request may already have refreshed the
              // token. Reuse its result rather than rotating refresh twice.
              final sentBearer = options.headers['Authorization'];
              final current = accessToken;
              final rotated = current != null &&
                      sentBearer != 'Bearer $current'
                  ? current
                  : await refreshAuthorization();
              if (originalEpoch != _sessionEpoch) {
                handler.reject(_accountChanged(options));
                return;
              }
              if (rotated != null && rotated.isNotEmpty) {
                // The session controller usually persists this; the transport
                // also supports its existing direct callback contract.
                _accessToken = rotated;
                options.headers['Authorization'] = 'Bearer $rotated';
                options.extra['masanawaAuthRetried'] = true;
                final retried = await dio.fetch(options);
                if (originalEpoch != _sessionEpoch) {
                  handler.reject(_accountChanged(options));
                  return;
                }
                handler.resolve(retried);
                return;
              }
            } catch (_) {
              if (originalEpoch != _sessionEpoch) {
                handler.reject(_accountChanged(options));
                return;
              }
              // Preserve the original 401; do not replay uncertain writes.
            }
          }
          handler.next(e);
        },
      ),
    );
  }

  static const _requestEpochKey = 'masanawaAuthenticatedRequestEpoch';
  final Dio dio;
  Future<String?>? _authorizationRefresh;
  int? _refreshEpoch;
  int _sessionEpoch = 0;
  String? _accountId;
  String? _accessToken;

  /// Session identity comes only from the canonical session controller. It is
  /// not derived from caller headers, claims, or the request. Logout/re-login
  /// (even to the same fan) invalidates every earlier private response.
  String? get authenticatedAccountId => _accountId;
  set authenticatedAccountId(String? id) {
    if (_accountId == id && id != null) return;
    _accountId = id;
    _sessionEpoch++;
    _authorizationRefresh = null;
    _refreshEpoch = null;
  }

  /// Existing agent/channel transports keep reading this current bearer.
  /// Direct token replacement without a bound session is conservatively
  /// treated as a different authorization context.
  String? get accessToken => _accessToken;
  set accessToken(String? token) {
    if (_accessToken == token) return;
    _accessToken = token;
    if (_accountId == null) {
      _sessionEpoch++;
      _authorizationRefresh = null;
      _refreshEpoch = null;
    }
  }

  Future<String?> Function()? onUnauthorized;

  bool _isProtected(String path) =>
      !path.startsWith('/auth/') && !path.startsWith('/v1/auth/');

  bool _isStale(RequestOptions request) =>
      _isProtected(request.path) &&
      request.extra[_requestEpochKey] != null &&
      request.extra[_requestEpochKey] != _sessionEpoch;

  DioException _accountChanged(RequestOptions request) => DioException(
        requestOptions: request,
        type: DioExceptionType.cancel,
        error: const ApiException(
          'Account changed. Please open this page again.',
          code: 'ACCOUNT_CHANGED',
        ),
      );

  /// Rotate once within the same session. An old refresh result is never
  /// returned for a new account, including A→B→A replacements.
  Future<String?> refreshAuthorization() {
    final epoch = _sessionEpoch;
    final active = _authorizationRefresh;
    if (active != null && _refreshEpoch == epoch) return active;
    final callback = onUnauthorized;
    if (callback == null) return Future<String?>.value(null);
    final future = Future<String?>.sync(callback).then(
      (token) => _sessionEpoch == epoch ? token : null,
    );
    _authorizationRefresh = future;
    _refreshEpoch = epoch;
    return future.whenComplete(() {
      if (identical(_authorizationRefresh, future)) {
        _authorizationRefresh = null;
        _refreshEpoch = null;
      }
    });
  }

  // ---- Auth (U-p2-01) ----

  Future<List<OtpChannel>> authOtpChannels() async {
    final data = await _get('/auth/capabilities');
    final raw = data['otpChannels'];
    if (raw is! List) {
      throw const ApiException(
        'Sign-in methods are unavailable right now.',
        code: 'AUTH_UNAVAILABLE',
      );
    }
    final channels = <OtpChannel>[];
    for (final value in raw) {
      if (value == 'email' && !channels.contains(OtpChannel.email)) {
        channels.add(OtpChannel.email);
      } else if (value == 'sms' && !channels.contains(OtpChannel.sms)) {
        channels.add(OtpChannel.sms);
      }
    }
    return List.unmodifiable(channels);
  }

  Future<OtpSendResponse> otpSend({String? phone, String? email}) async {
    final data = await _post(
      '/auth/otp',
      OtpSendRequest(phone: phone, email: email).toJson(),
    );
    return OtpSendResponse.fromJson(data);
  }

  Future<AuthTokens> otpVerify(String code,
      {String? phone, String? email, String? name}) async {
    final data = await _post(
      '/auth/verify',
      OtpVerifyRequest(phone: phone, email: email, code: code, name: name)
          .toJson(),
    );
    return AuthTokens.fromJson(data);
  }

  // ---- Password auth (U-auth-pw) ----
  // Declared Gateway contract for the 6-digit device password. Email keeps
  // real OTP. Every call fails closed (ApiException) when the server has not
  // implemented the endpoint yet; the UI surfaces that honestly.

  Future<AccountStatusResponse> authAccountStatus({
    required String phone,
    required String deviceId,
  }) async {
    final data = await _get(
      '/v1/auth/account/status',
      queryParameters: {'phone': phone, 'deviceId': deviceId},
    );
    return AccountStatusResponse.fromJson(data);
  }

  Future<AuthTokens> deviceRestore({
    required String phone,
    required String deviceId,
  }) async {
    final data = await _post('/v1/auth/device/restore', {
      'phone': phone,
      'deviceId': deviceId,
    });
    return AuthTokens.fromJson(data);
  }

  Future<AuthTokens> passwordVerify({
    required String phone,
    required String deviceId,
    required String password,
  }) async {
    final data = await _post(
      '/v1/auth/password/verify',
      PasswordVerifyRequest(phone: phone, deviceId: deviceId, password: password)
          .toJson(),
    );
    return AuthTokens.fromJson(data);
  }

  Future<AuthTokens> passwordSetup({
    required String phone,
    required String deviceId,
    required String password,
    required String name,
    String? email,
  }) async {
    final data = await _post(
      '/v1/auth/password/setup',
      PasswordSetupRequest(
        phone: phone,
        deviceId: deviceId,
        password: password,
        name: name,
        email: email,
      ).toJson(),
    );
    return AuthTokens.fromJson(data);
  }

  Future<AuthTokens> refresh(String refreshToken) async {
    final data = await _post('/auth/refresh', {'refreshToken': refreshToken});
    return AuthTokens.fromJson(data);
  }

  Future<Map<String, dynamic>> logout() async {
    return _post('/auth/logout', const {});
  }

  // ---- Account deletion (R12) ----

  Future<AccountDeletionRequestView?> accountDeletionStatus() async {
    final data = await _get('/account/deletion');
    final request = data['request'];
    if (request == null) return null;
    if (request is! Map) {
      throw const ApiException('Account deletion status is unavailable');
    }
    return AccountDeletionRequestView.fromJson(
      Map<String, dynamic>.from(request),
    );
  }

  Future<AccountDeletionDeliveryView> requestAccountDeletion() async {
    final data = await _post('/account/deletion/request', const {});
    return AccountDeletionDeliveryView.fromJson(data);
  }

  Future<AccountDeletionRequestView> verifyAccountDeletion(String code) async {
    final data = await _post('/account/deletion/verify', {'code': code});
    final request = data['request'];
    if (request is! Map) {
      throw const ApiException('Account deletion verification is unavailable');
    }
    return AccountDeletionRequestView.fromJson(
      Map<String, dynamic>.from(request),
    );
  }

  // ---- Billing ----

  Future<List<BillCategory>> billingCategories() async {
    final data = await _get('/v1/commerce/bills/categories');
    final rows = data['categories'] as List<dynamic>? ?? const [];
    return rows
        .map((entry) =>
            BillCategory.fromJson(entry as Map<String, dynamic>))
        .toList(growable: false);
  }

  Future<List<BillBiller>> billingBillers(String categoryCode) async {
    final code = Uri.encodeComponent(categoryCode);
    final data =
        await _get('/v1/commerce/bills/categories/$code/billers');
    final rows = data['billers'] as List<dynamic>? ?? const [];
    return rows
        .map((entry) => BillBiller.fromJson(entry as Map<String, dynamic>))
        .toList(growable: false);
  }

  Future<List<BillItem>> billingItems(String billerCode) async {
    final code = Uri.encodeComponent(billerCode);
    final data = await _get('/v1/commerce/bills/billers/$code/items');
    final rows = data['items'] as List<dynamic>? ?? const [];
    return rows
        .map((entry) => BillItem.fromJson(entry as Map<String, dynamic>))
        .toList(growable: false);
  }

  Future<BillingCheckoutView> createBillingQuote({
    required String categoryCode,
    required String billerCode,
    required String itemCode,
    required String customerId,
    required String amount,
  }) async {
    final data = await _post('/v1/commerce/bills/quotes', {
      'categoryCode': categoryCode,
      'billerCode': billerCode,
      'itemCode': itemCode,
      'customerId': customerId,
      'amount': amount,
    });
    return BillingCheckoutView.fromJson(data);
  }

  Future<BillingWalletActionView> confirmBillingFromWallet({
    required String quoteId,
    required int quoteRevision,
  }) async {
    final id = Uri.encodeComponent(quoteId);
    final data = await _post(
      '/v1/commerce/bills/quotes/$id/confirm-wallet',
      {'quoteRevision': quoteRevision},
    );
    return BillingWalletActionView.fromJson(data);
  }

  Future<BillingWalletActionView> createWalletFunding({
    required String amount,
  }) async {
    final data = await _post('/v1/wallet/ngn/funding', {'amount': amount});
    return BillingWalletActionView.fromJson(data);
  }

  Future<BillingCheckoutView> startBillingCheckout({
    required String quoteId,
    required int quoteRevision,
    String? checkoutEmail,
  }) async {
    final id = Uri.encodeComponent(quoteId);
    final data = await _post('/v1/commerce/bills/quotes/$id/checkout', {
      'quoteRevision': quoteRevision,
      if (checkoutEmail != null && checkoutEmail.trim().isNotEmpty)
        'checkoutEmail': checkoutEmail.trim(),
    });
    return BillingCheckoutView.fromJson(data);
  }

  Future<BillingCheckoutView> verifyBillingPayment({
    required String quoteId,
    required int quoteRevision,
  }) async {
    final id = Uri.encodeComponent(quoteId);
    final data = await _post('/v1/commerce/bills/quotes/$id/verify', {
      'quoteRevision': quoteRevision,
    });
    return BillingCheckoutView.fromJson(data);
  }

  Future<BillingCheckoutView> billingQuote(String quoteId) async {
    final id = Uri.encodeComponent(quoteId);
    final data = await _get('/v1/commerce/bills/quotes/$id');
    return BillingCheckoutView.fromJson(data);
  }

  Future<List<BillingCheckoutView>> billingHistory({int limit = 50}) async {
    final data = await _get(
      '/v1/commerce/bills/quotes',
      queryParameters: {'limit': limit},
    );
    final rows = data['quotes'] as List<dynamic>? ?? const [];
    return rows
        .map((entry) =>
            BillingCheckoutView.fromJson(entry as Map<String, dynamic>))
        .toList(growable: false);
  }

  /// Sends one message to the AI assistant. Expects `{reply: String}`.
  /// Throws [ApiException] when the endpoint is missing so callers can fall
  /// back to an honest offline reply.
  Future<String> aiChat(String message, {String? masana}) async {
    final data = await _post('/ai/chat', {
      'message': message,
      if (masana != null) 'masana': masana,
    });
    final reply = data['reply'];
    if (reply is String && reply.isNotEmpty) return reply;
    throw const ApiException('AI service unavailable');
  }

  /// Updates the citizen's registered state and LGA location.
  /// Called once from LocationSetupScreen after the user selects their State/LGA.
  Future<Map<String, dynamic>> updateLocation({
    required String stateId,
    required String lgaId,
  }) async {
    return _patch('/auth/location', {'stateId': stateId, 'lgaId': lgaId});
  }

  // ---- Geo (U-p1-05) ----

  Future<GeoSearchResponse> geoSearch(String query,
      {String? type, int limit = 10}) async {
final res = await _get(
      '/geo/search',
      queryParameters: {
        'q': query,
        'limit': limit,
        'type': ?type,
      },
    );
    return GeoSearchResponse.fromJson(res);
  }

  /// Drill into `parent` (country code `NG`, state id or LGA id).
  Future<Map<String, dynamic>> geoTree(String parent, {int depth = 1}) async {
    return _get(
      '/geo/tree',
      queryParameters: {'parent': parent, 'depth': depth},
    );
  }

  Future<CommunityRequestResponse> requestCommunity(
      CommunityRequest request) async {
    final data = await _post('/communities/request', request.toJson());
    return CommunityRequestResponse.fromJson(data);
  }

  // ---- Community + feed (U-p2-04) ----

  Future<CommunityListResponse> listCommunities({
    String? q,
    String? stateId,
    String? lgaId,
    String? category,
    int limit = 20,
    String? cursor,
  }) async {
    final data = await _get('/communities', queryParameters: {
      'q': q,
      'stateId': stateId,
      'lgaId': lgaId,
      'category': category,
      'limit': limit,
      'cursor': cursor,
    });
    return CommunityListResponse.fromJson(data);
  }

  /// Returns the user's 6 canonical State & LGA groups based on registered location.
  Future<List<Map<String, dynamic>>> getMyGroups() async {
    final data = await _get('/communities/my-groups');
    final list = data['groups'] as List<dynamic>? ?? const [];
    return list.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList();
  }

  Future<CommunityDetailResponse> communityDetail(String id) async {
    final data = await _get('/communities/$id');
    return CommunityDetailResponse.fromJson(data);
  }

  /// Idempotent join: a retry returns `alreadyMember: true`, never an error.
  Future<JoinCommunityResponse> joinCommunity(String id) async {
    final data = await _post('/communities/$id/join', const {});
    return JoinCommunityResponse.fromJson(data);
  }

  Future<LeaveCommunityResponse> leaveCommunity(String id) async {
    final data = await _post('/communities/$id/leave', const {});
    return LeaveCommunityResponse.fromJson(data);
  }

  Future<CommunityMembersResponse> communityMembers(String id,
      {int limit = 20, String? cursor}) async {
    final data = await _get('/communities/$id/members', queryParameters: {
      'limit': limit,
      'cursor': ?cursor,
    });
    return CommunityMembersResponse.fromJson(data);
  }

  /// Civic-ordered feed for `communityId` (or the caller's default when null), filtered by state if provided.
  Future<FeedResponse> getFeed({String? communityId, String? stateId, int limit = 20, String? cursor}) async {
    final data = await _get('/feed', queryParameters: {
      if (communityId != null) 'communityId': communityId,
      if (stateId != null) 'stateId': stateId,
      'limit': limit,
      if (cursor != null) 'cursor': cursor,
    });
    return FeedResponse.fromJson(data);
  }

  // ---- Chat (U-p3-01/03) ----

  /// History (newest-first) or reconnect gap-fill (`since`, oldest-first).
  /// `before` and `since` are mutually exclusive (contract-level refine).
  Future<MessageListResponse> messageList(
    String communityId, {
    int limit = 20,
    String? before,
    String? since,
  }) async {
    final data = await _get('/communities/$communityId/messages', queryParameters: {
      'limit': limit,
      'before': ?before,
      'since': ?since,
    });
    return MessageListResponse.fromJson(data);
  }

  /// Sends a TEXT/IMAGE/VOICE message (rate-limited per sender + community).
  Future<ChatMessage> sendMessage(String communityId, SendMessageRequest body) async {
    final data = await _post('/communities/$communityId/messages', body.toJson());
    return ChatMessage.fromJson(data);
  }

  /// Toggles one reaction (add/remove, or switch emoji in place).
  Future<SetReactionResponse> toggleReaction(
    String communityId,
    String messageId,
    String emoji,
  ) async {
    final data = await _post(
      '/communities/$communityId/messages/$messageId/reactions',
      {'emoji': emoji},
    );
    return SetReactionResponse.fromJson(data);
  }

  /// Soft-deletes the caller's own message (idempotent).
  Future<DeleteMessageResponse> deleteMessage(
    String communityId,
    String messageId,
  ) async {
    final data = await _delete('/communities/$communityId/messages/$messageId');
    return DeleteMessageResponse.fromJson(data);
  }

  // ---- Uploads (U-p3-03) ----

  /// Mints a short-lived presigned PUT URL for a chat media object. R2 keys
  /// are optional server-side; when absent this surfaces a 503
  /// `MEDIA_UPLOAD_NOT_CONFIGURED` ApiException (fail-soft, never silent).
  Future<PresignUploadResponse> presignUpload(PresignUploadRequest request) async {
    final data = await _post('/uploads/presign', request.toJson());
    return PresignUploadResponse.fromJson(data);
  }

  // ---- Reports (U-p4-01 + U-p4-02) ----

  /// Submits a report from the 7-step flow. Attachments must already be
  /// uploaded via the presign seam with `scope: 'report'`.
  Future<CreateReportResponse> createReport(CreateReportBody body) async {
    final data = await _post('/reports', body.toJson());
    return CreateReportResponse.fromJson(data);
  }

  /// Track screen: full detail + the §57 audit timeline for `publicRef`.
  /// 404 `REPORT_NOT_FOUND` when the reference is unknown or hidden (§27).
  Future<ReportDetail> getReportDetail(String publicRef) async {
    final data = await _get('/reports/$publicRef');
    return ReportDetail.fromJson(data);
  }

  /// The caller's own reports, newest first, cursor-paginated (my-reports
  /// screen tabs filter Active/Resolved/Closed client-side).
  Future<ListMyReportsResponse> listMyReports({
    String? cursor,
    int limit = 20,
  }) async {
    final data = await _get('/reports/mine', queryParameters: {
      'limit': limit,
      'cursor': ?cursor,
    });
    return ListMyReportsResponse.fromJson(data);
  }

  /// Converts a chat message into a civic report (U-p3-02).
  Future<Map<String, dynamic>> convertFromMessage({
    required String communityId,
    required String messageId,
    String? category,
    String? description,
  }) async {
    final body = {
      'communityId': communityId,
      'messageId': messageId,
      if (category != null) 'category': category,
      if (description != null) 'description': description,
    };
    final data = await _post('/reports/from-message', body);
    return (data as Map).cast<String, dynamic>();
  }

  // ---- Trust & safety (U-p3-04, §51) ----

  /// Blocks `userId` (personal, unilateral — mutual hide, enforced server-side).
  /// Idempotent: a replay returns `alreadyBlocked`.
  Future<BlockUserResponse> blockUser(String userId) async {
    final data = await _post('/users/$userId/block', const {});
    return BlockUserResponse.fromJson(data);
  }

  /// Unblocks `userId`. Idempotent: `wasBlocked` is false when already unblocked.
  Future<UnblockUserResponse> unblockUser(String userId) async {
    final data = await _delete('/users/$userId/block');
    return UnblockUserResponse.fromJson(data);
  }

  /// The caller's block list, newest first (settings/privacy screen).
  Future<BlockedUsersResponse> blockedUsers() async {
    final data = await _get('/users/me/blocked');
    return BlockedUsersResponse.fromJson(data);
  }

  /// Mutes `userId` in `communityId` (moderator action; requires a community or
  /// platform moderator role server-side). Optional [until] ISO-8601 expiry.
  Future<MuteUserResponse> muteUser(
    String userId, {
    required String communityId,
    String? until,
  }) async {
    final data = await _post('/users/$userId/mute', {
      'communityId': communityId,
      'until': ?until,
    });
    return MuteUserResponse.fromJson(data);
  }

  /// Unmutes `userId` in `communityId`. Idempotent.
  Future<UnmuteUserResponse> unmuteUser(String userId, String communityId) async {
    final data = await _delete('/users/$userId/mute', body: {'communityId': communityId});
    return UnmuteUserResponse.fromJson(data);
  }

  /// Reports a message to the moderation queue. One report per (message, me).
  Future<FlagMessageResponse> flagMessage(
    String communityId,
    String messageId,
    String reason,
  ) async {
    final data = await _post('/moderation/flag', {
      'communityId': communityId,
      'messageId': messageId,
      'reason': reason,
    });
    return FlagMessageResponse.fromJson(data);
  }

  // ---- Polls (U-p6-02) ----

  /// Scope-matched poll list for `communityId` (falls back to the caller's
  /// default community when omitted — the tab always passes the community).
  Future<PollListResponse> listPolls({
    String? communityId,
    int limit = 20,
    String? cursor,
  }) async {
    final data = await _get('/polls', queryParameters: {
      'communityId': ?communityId,
      'limit': limit,
      'cursor': ?cursor,
    });
    return PollListResponse.fromJson(data);
  }

  Future<PollDetail> pollDetail(String pollId) async {
    final data = await _get('/polls/$pollId');
    return PollDetail.fromJson(data);
  }

  /// Submits the final vote (SINGLE/YESNO/RATING = exactly one option; MULTI
  /// = 1..N). One submission only — a replay is 409 ALREADY_VOTED.
  Future<VotePollResponse> votePoll(String pollId, VotePollBody body) async {
    final data = await _post('/polls/$pollId/vote', body.toJson());
    return VotePollResponse.fromJson(data);
  }

  /// Full admin poll queue, newest first (PLATFORM_ADMIN only server-side).
  Future<AdminPollListResponse> adminListPolls({
    int limit = 20,
    String? cursor,
  }) async {
    final data = await _get('/admin/polls', queryParameters: {
      'limit': limit,
      'cursor': ?cursor,
    });
    return AdminPollListResponse.fromJson(data);
  }

  Future<AdminPollItem> adminCreatePoll(CreatePollBody body) async {
    final data = await _post('/admin/polls', body.toJson());
    return AdminPollItem.fromJson(data);
  }

  Future<AdminPollItem> adminUpdatePoll(String pollId, UpdatePollBody body) async {
    final data = await _patch('/admin/polls/$pollId', body.toJson());
    return AdminPollItem.fromJson(data);
  }

  /// Full poll for the edit form (live option counts + resolved targets).
  Future<AdminPollDetail> adminPollDetail(String pollId) async {
    final data = await _get('/admin/polls/$pollId');
    return AdminPollDetail.fromJson(data);
  }

  /// Full cascade delete (votes/options/targets). Irreversible — confirm first.
  Future<DeletePollResponse> adminDeletePoll(String pollId) async {
    final data = await _delete('/admin/polls/$pollId');
    return DeletePollResponse.fromJson(data);
  }

  // ---- App config (U-p6-02) ----

  /// Public election timetable for the home countdown banner. Returns the
  /// config object; `election` is null until the seed row exists.
  Future<AppConfigResponse> getAppConfig() async {
    final data = await _get('/app/config');
    return AppConfigResponse.fromJson(data);
  }

  // ---- Announcements (U-p6-03) ----

  /// Announcement list for `communityId` (falls back to the caller's default
  /// community when omitted — the tab always passes the community). Pinned
  /// first, then newest; expired/REJECTED rows never appear (server-side).
  Future<AnnouncementListResponse> listAnnouncements({
    String? communityId,
    int limit = 20,
    String? cursor,
  }) async {
    final data = await _get('/announcements', queryParameters: {
      'communityId': ?communityId,
      'limit': limit,
      'cursor': ?cursor,
    });
    return AnnouncementListResponse.fromJson(data);
  }

  Future<AnnouncementDetail> announcementDetail(String announcementId) async {
    final data = await _get('/announcements/$announcementId');
    return AnnouncementDetail.fromJson(data);
  }

  /// Creates a COMMUNITY (moderator/admin) or OFFICIAL (PLATFORM_ADMIN)
  /// announcement. Errors: 403 FORBIDDEN, 400 INVALID_EXPIRY.
  Future<AnnouncementDetail> createAnnouncement(
      CreateAnnouncementBody body) async {
    final data = await _post('/announcements', body.toJson());
    return AnnouncementDetail.fromJson(
        data['announcement'] as Map<String, dynamic>);
  }

  /// Pin toggle / expiry change (author or a community moderator).
  Future<AnnouncementDetail> updateAnnouncement(
    String announcementId,
    UpdateAnnouncementBody body,
  ) async {
    final data = await _patch('/announcements/$announcementId', body.toJson());
    return AnnouncementDetail.fromJson(
        data['announcement'] as Map<String, dynamic>);
  }

  /// Soft-deletes the announcement (author or a community moderator).
  /// Irreversible from the user's perspective — confirm before calling.
  Future<void> deleteAnnouncement(String announcementId) async {
    await _delete('/announcements/$announcementId');
  }

  // ---- Issues (U-p4-04, §33/§34) ----

  /// Priority board for `communityId` (falls back to the caller's default
  /// community when omitted): OPEN issues first, ordered by priorityScore desc.
  Future<IssueListResponse> listIssues({
    String? communityId,
    int limit = 20,
    String? cursor,
  }) async {
    final data = await _get('/issues', queryParameters: {
      'communityId': ?communityId,
      'limit': limit,
      'cursor': ?cursor,
    });
    return IssueListResponse.fromJson(data);
  }

  Future<IssueDetail> issueDetail(String issueId) async {
    final data = await _get('/issues/$issueId');
    return IssueDetail.fromJson(data);
  }

  /// Confirms the issue (once per user — anti-inflation, §34). Idempotent:
  /// a replay returns `alreadyConfirmed: true` and never double-counts.
  Future<ConfirmIssueResponse> confirmIssue(String issueId) async {
    final data = await _post('/issues/$issueId/confirm', const {});
    return ConfirmIssueResponse.fromJson(data);
  }

  /// Rates a resolved report's outcome (§128 give-feedback step). Idempotent:
  /// a replay returns `alreadyFeedback: true` — the citizen never double-votes
  /// (DB unique (reportId, userId)). 409 FEEDBACK_NOT_AVAILABLE when the report
  /// has not reached a final outcome yet.
  Future<FeedbackResponse> submitFeedback(String reportId, FeedbackBody body) async {
    final data = await _post('/reports/$reportId/feedback', body.toJson());
    return FeedbackResponse.fromJson(data);
  }

  /// Lists community-scoped public reports for the civic Reports tab.
  /// Returns public + verified + community reports, newest first, paginated.
  Future<ListMyReportsResponse> listCommunityReports({
    String? communityId,
    String? stateId,
    String? category,
    String? status,
    int limit = 30,
    String? cursor,
  }) async {
    final data = await _get('/reports', queryParameters: {
      'limit': limit,
      if (communityId != null) 'communityId': communityId,
      if (stateId != null) 'stateId': stateId,
      if (category != null) 'category': category,
      if (status != null) 'status': status,
      if (cursor != null) 'cursor': cursor,
    });
    return ListMyReportsResponse.fromJson(data);
  }

  /// Confirms (upvotes) a report. Idempotent — replays return alreadyConfirmed.
  Future<void> confirmReport(String reportId) async {
    await _post('/reports/$reportId/confirm', const {});
  }

  // ---- Organizations & verification (U-p5-01, §54/§137) ----

  /// Self-serve verification claim (C6 never self-declare): the body carries
  /// no status field and the server always lands PENDING + SUBMITTED. A
  /// PLATFORM_ADMIN approves/rejects the claim on the admin surface.
  Future<OrgApplyResponse> applyOrg(OrgApplyBody body) async {
    final data = await _post('/orgs/apply', body.toJson());
    return OrgApplyResponse.fromJson(data);
  }

  /// Verified-only public directory, newest first, cursor-paginated.
  Future<OrgListResponse> listOrgs({String? search, int limit = 20, String? cursor}) async {
    final data = await _get('/orgs', queryParameters: {
      'search': ?search,
      'limit': limit,
      'cursor': ?cursor,
    });
    return OrgListResponse.fromJson(data);
  }

  /// Public detail of a verified org. Non-verified/unknown orgs answer a
  /// uniform 404 (server-side), so the detail screen shows a not-found state.
  Future<OrgDetail> orgDetail(String orgId) async {
    final data = await _get('/orgs/$orgId');
    return OrgDetail.fromJson(data);
  }

  // ---- Voice reporting (U-p4-06) ----

  /// Transcribes a voice clip (already uploaded via presign scope report) via
  /// Gemini. 503 TRANSCRIPTION_NOT_CONFIGURED when GEMINI_API_KEY absent.
  Future<TranscribeVoiceResponse> transcribeVoice(TranscribeVoiceBody body) async {
    final data = await _post('/voice/transcribe', body.toJson());
    return TranscribeVoiceResponse.fromJson(data);
  }

  Future<ListNotificationsResponse> listNotifications() async {
    final data = await _get('/notifications');
    return ListNotificationsResponse.fromJson(data);
  }

  Future<void> markNotificationsRead() async {
    await _post('/notifications/read-all', {});
  }

  Future<void> registerDeviceToken(String token, {String platform = 'android'}) async {
    try {
      await _post('/notifications/register-device', {'token': token, 'platform': platform});
    } catch (_) {
      // Non-fatal
    }
  }

  Future<void> likeReport(String reportId) async {
    await _post('/reports/$reportId/like', {});
  }

  Future<void> unlikeReport(String reportId) async {
    await _post('/reports/$reportId/unlike', {});
  }

  Future<void> addReportComment(String reportId, String body) async {
    await _post('/reports/$reportId/comments', {'body': body});
  }

  Future<List<Map<String, dynamic>>> getReportComments(String reportId) async {
    try {
      final res = await dio.get<dynamic>('/reports/$reportId/comments');
      final data = res.data;
      if (data is List) {
        return data.whereType<Map<String, dynamic>>().toList();
      } else if (data is Map && data['data'] is List) {
        return (data['data'] as List).whereType<Map<String, dynamic>>().toList();
      }
      return [];
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  // ---- Transport helpers ----

  Future<Map<String, dynamic>> _get(String path,
      {Map<String, dynamic>? queryParameters}) async {
    try {
      final res = await dio.get<Map<String, dynamic>>(
        path,
        queryParameters: queryParameters,
      );
      return _body(res);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<Map<String, dynamic>> _post(String path, Map<String, dynamic> body) async {
    try {
      final res = await dio.post<Map<String, dynamic>>(path, data: body);
      return _body(res);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<Map<String, dynamic>> _patch(String path, Map<String, dynamic> body) async {
    try {
      final res = await dio.patch<Map<String, dynamic>>(path, data: body);
      return _body(res);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Map<String, dynamic> _body(Response<Map<String, dynamic>> res) {
    final data = res.data;
    if (data == null) {
      throw ApiException('Empty response from server', statusCode: res.statusCode);
    }
    return data;
  }

  Future<Map<String, dynamic>> _delete(String path, {Map<String, dynamic>? body}) async {
    try {
      final res = await dio.delete<Map<String, dynamic>>(path, data: body);
      return _body(res);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }
}

/// Parses a DioException into [ApiException], mapping the API error envelope
/// to professional, user-safe copy. The envelope carries a stable `code` (new
/// builds) or a legacy `HTTP_xxx` code with the domain code as `message`
/// (older builds) — both are normalized so users NEVER see raw server text
/// like "Invalid request payload." or bare codes like "OTP_LOCKED".
ApiException mapDioError(DioException e) {
  final res = e.response;
  final status = res?.statusCode;

  Map<String, dynamic>? envelope;
  if (res?.data is Map) {
    final data = res!.data as Map<String, dynamic>;
    // Some surfaces nest the envelope under `error`; the API emits it flat.
    envelope = data['error'] is Map ? (data['error'] as Map<String, dynamic>) : data;
  }

  final code = envelope?['code'] as String?;
  final message = envelope?['message'] as String?;
  final issues = envelope?['issues'];

  if (envelope != null && (code != null || (message?.isNotEmpty ?? false))) {
    return ApiException(
      _friendlyMessage(code: code, message: message, issues: issues, status: status),
      statusCode: status,
      // Preserve the machine code for state logic (e.g. NAME_REQUIRED_ON_SIGNUP
      // drives the name-capture screen); fall back to the domain code embedded
      // in a legacy HTTP_xxx message so old APIs behave identically.
      code: _preferDomainCode(code, message),
    );
  }

  if (e.type == DioExceptionType.connectionTimeout ||
      e.type == DioExceptionType.receiveTimeout ||
      e.type == DioExceptionType.sendTimeout) {
    return const ApiException(
      'Connection timed out. Check your network and try again.',
      statusCode: null,
      code: 'NETWORK_TIMEOUT',
    );
  }
  if (e.type == DioExceptionType.connectionError) {
    return const ApiException(
      'Check your connection and try again.',
      statusCode: null,
      code: 'NETWORK_UNREACHABLE',
    );
  }
  return ApiException(
    _friendlyMessage(code: null, message: e.message, status: status),
    statusCode: status,
  );
}

/// Returns the domain code when [code] or [message] is actually a bare API
/// code. New envelopes put the code in `code` (e.g. `VALIDATION_FAILED`);
/// legacy envelopes use `HTTP_401` + the real code as `message` — the code in
/// `message` must win so state logic + copy behave identically on both.
String? _preferDomainCode(String? code, String? message) {
  final fromCode = _legacyCode(code);
  if (fromCode != null) return fromCode;
  final fromMessage = _legacyCode(message);
  if (fromMessage != null) return fromMessage;
  // Unknown future codes still pass through (unless they are HTTP_xxx, which
  // carry no domain meaning).
  if (code != null && !code.startsWith('HTTP_')) return code;
  return null;
}

/// Returns [value] when it is one of the known contract error codes.
String? _legacyCode(String? value) {
  const known = {
    'VALIDATION_FAILED',
    'OTP_LOCKED',
    'OTP_RATE_LIMITED',
    'OTP_INVALID',
    'OTP_CHANNEL_UNAVAILABLE',
    'OTP_DELIVERY_UNAVAILABLE',
    'NAME_REQUIRED_ON_SIGNUP',
    'SESSION_NOT_FOUND',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'CHAT_SPAM_DETECTED',
    'SELF_MODERATION',
    'NOT_A_MEMBER',
    'COMMUNITY_NOT_FOUND',
    'MESSAGE_NOT_FOUND',
    'ALREADY_CONVERTED',
    'NOT_CONVERTIBLE',
    'INVALID_ATTACHMENT',
    'MEDIA_UPLOAD_NOT_CONFIGURED',
    'COMMUNITY_NOT_ACTIVE',
    'STATE_REQUIRED_WITH_LGA',
    'INVALID_LGA',
    'INVALID_STATE',
    // Polls (U-p6-02).
    'POLL_NOT_FOUND',
    'POLL_CLOSED',
    'ALREADY_VOTED',
    'INVALID_OPTION',
    'POLL_TITLE_EXISTS',
    'OPTION_COUNT_INVALID',
    'OPTION_HAS_VOTES',
    'TARGETS_NOT_ALLOWED',
    'INVALID_TARGET',
    'TARGETS_REQUIRED',
    // Issues (U-p4-04).
    'ISSUE_NOT_FOUND',
    'CANNOT_CONFIRM_OWN',
  };
  return (value != null && known.contains(value)) ? value : null;
}

/// Turns a contract code / status into prose a user can act on. Unknown
/// server messages are only shown when they read like prose — never a raw
/// code or the generic "Invalid request payload." string.
String _friendlyMessage({
  required String? code,
  required String? message,
  Object? issues,
  required int? status,
}) {
  final domainCode = _preferDomainCode(code, message);

  switch (domainCode) {
    case 'VALIDATION_FAILED':
      return _validationMessage(issues);
    case 'OTP_INVALID':
      return 'That code is incorrect or has expired. Please try again.';
    case 'OTP_LOCKED':
      return 'Too many incorrect attempts. Please wait a few minutes and try again.';
    case 'OTP_RATE_LIMITED':
      return "You've requested too many codes. Please wait a moment and try again.";
    case 'OTP_CHANNEL_UNAVAILABLE':
      return 'That sign-in method is not available right now. Choose another option.';
    case 'OTP_DELIVERY_UNAVAILABLE':
      return 'We could not send the code right now. Please try again.';
    case 'NAME_REQUIRED_ON_SIGNUP':
      return 'Please enter your name to continue.';
    case 'SESSION_NOT_FOUND':
      return 'That session is no longer active. Please sign in again.';
    case 'UNAUTHORIZED':
      return 'Your session has expired. Please sign in again.';
    case 'CHAT_SPAM_DETECTED':
      return 'That message looks like spam and wasn\'t sent.';
    case 'SELF_MODERATION':
      return 'You can\'t take that action on yourself.';
    case 'NOT_A_MEMBER':
      return 'You\'re not a member of this community yet.';
    case 'MEDIA_UPLOAD_NOT_CONFIGURED':
      return 'Media uploads aren\'t set up yet. Please try again later.';
    case 'COMMUNITY_NOT_ACTIVE':
      return 'That community isn\'t accepting reports right now.';
    case 'STATE_REQUIRED_WITH_LGA':
    case 'INVALID_LGA':
    case 'INVALID_STATE':
      return 'Please choose a valid location for this report.';
    case 'INVALID_ATTACHMENT':
      return 'One of the attached files wasn\'t accepted. Please try again.';
    case 'POLL_NOT_FOUND':
      return 'That poll is no longer available.';
    case 'POLL_CLOSED':
      return 'This poll has closed. Results are still available.';
    case 'ALREADY_VOTED':
      return 'You\'ve already voted in this poll — votes are final.';
    case 'INVALID_OPTION':
      return 'That vote didn\'t match the poll\'s options. Please try again.';
    case 'POLL_TITLE_EXISTS':
      return 'A poll with that title already exists.';
    case 'OPTION_COUNT_INVALID':
      return 'That poll type needs a different number of options.';
    case 'OPTION_HAS_VOTES':
      return 'Options with votes can\'t be edited or removed.';
    case 'TARGETS_NOT_ALLOWED':
    case 'INVALID_TARGET':
    case 'TARGETS_REQUIRED':
      return 'Please check the poll\'s targeting and try again.';
    case 'ISSUE_NOT_FOUND':
      return 'That issue is no longer available.';
    case 'CANNOT_CONFIRM_OWN':
      return 'You can\'t confirm an issue you reported yourself.';
  }

  if (status == 400) {
    return 'We couldn\'t complete that request. Please check your details and try again.';
  }
  if (status == 401) return 'Your session has expired. Please sign in again.';
  if (status == 403) return 'You don\'t have permission to do that.';
  if (status == 404) return 'That could not be found. It may have been removed.';
  if (status == 429) return 'Too many requests. Please try again in a little while.';
  if (status != null && status >= 500) {
    return 'Something went wrong on our end. Please try again shortly.';
  }

  final trimmed = message?.trim() ?? '';
  if (trimmed.isNotEmpty &&
      !RegExp(r'^[A-Z0-9_]+$').hasMatch(trimmed) &&
      !trimmed.contains('Invalid request payload')) {
    return trimmed;
  }
  return 'Something went wrong. Please try again.';
}

/// Field-aware copy for validation failures when the envelope carries per-field
/// `issues` (server preserves them for code VALIDATION_FAILED).
String _validationMessage(Object? issues) {
  if (issues is List) {
    final paths = issues
        .whereType<Map>()
        .expand((issue) => (issue['path'] as List?)?.whereType<String>() ?? const <String>[])
        .toList();
    if (paths.contains('email')) {
      return 'That email address doesn\'t look right. Please check it and try again.';
    }
    if (paths.contains('phone')) {
      return 'That phone number doesn\'t look right. Please check it and try again.';
    }
    if (paths.contains('code')) {
      return 'The code must be exactly 6 digits. Please check and try again.';
    }
    if (paths.contains('name')) {
      return 'Please enter your name (at least 2 characters).';
    }
  }
  return 'Please check the details you entered and try again.';
}
