import 'package:flutter_riverpod/flutter_riverpod.dart';

/// The selected service is an untrusted navigation intent, NOT a quote,
/// transaction, approval, provider entitlement, or server task ID.
enum PrivateServiceIntent {
  crypto,
  data,
  airtime,
  electricity,
  tv;

  static PrivateServiceIntent? fromBillingCode(String code) =>
      switch (code.trim().toLowerCase()) {
        'data' => PrivateServiceIntent.data,
        'airtime' => PrivateServiceIntent.airtime,
        'electricity' => PrivateServiceIntent.electricity,
        'tv' => PrivateServiceIntent.tv,
        _ => null,
      };

  String get displayName => switch (this) {
        PrivateServiceIntent.crypto => 'Crypto',
        PrivateServiceIntent.data => 'Data bundles',
        PrivateServiceIntent.airtime => 'Airtime',
        PrivateServiceIntent.electricity => 'Electricity',
        PrivateServiceIntent.tv => 'TV / Cable',
      };

  /// This asks for assistance, never requests execution or represents consent.
  /// The existing provider-backed editor remains the only direct confirmation
  /// route until the canonical server-owned conversational task API is ready.
  String get helpRequest => switch (this) {
        PrivateServiceIntent.crypto =>
          'Help me with crypto. Ask whether I want to buy, deposit, convert or withdraw. '
          'Check what is supported before presenting options. Do not transact without '
          'an exact verified quote and my explicit confirmation.',
        PrivateServiceIntent.data =>
          'Help me buy a data bundle. Ask for the missing recipient and plan details. '
          'Check supported providers and require an exact verified quote and my '
          'explicit confirmation before any purchase.',
        PrivateServiceIntent.airtime =>
          'Help me buy airtime. Ask for missing recipient, country and amount details. '
          'Check supported providers and require an exact verified quote and my '
          'explicit confirmation before any purchase.',
        PrivateServiceIntent.electricity =>
          'Help me pay an electricity bill. Ask for missing provider, meter and amount '
          'details. Check eligibility and require an exact verified quote and my '
          'explicit confirmation before any payment.',
        PrivateServiceIntent.tv =>
          'Help me pay for TV or cable. Ask for missing provider, customer and plan '
          'details. Check eligibility and require an exact verified quote and my '
          'explicit confirmation before any payment.',
      };

  /// Existing authenticated, provider-backed manual editor / history route.
  /// Opening this route by itself cannot authorize a new transaction.
  String get editorLocation => switch (this) {
        PrivateServiceIntent.crypto => '/crypto',
        PrivateServiceIntent.data => '/billing?service=data',
        PrivateServiceIntent.airtime => '/billing?service=airtime',
        PrivateServiceIntent.electricity => '/billing?service=electricity',
        PrivateServiceIntent.tv => '/billing?service=tv',
      };
}

/// Tracks the latest explicitly selected service for this signed-in account.
/// Revision changes even if the same shortcut is selected again.
class PendingPrivateServiceIntent {
  const PendingPrivateServiceIntent({
    required this.intent,
    required this.ownerUserId,
    required this.revision,
  });

  final PrivateServiceIntent intent;
  final String ownerUserId;
  final int revision;

  bool belongsTo(String userId) => ownerUserId == userId;
}

/// Ephemeral, account-scoped handoff. A fresh app launch cannot replay an old
/// financial request. Re-entry and provider recovery happen through server
/// history/quotes, not through this navigation state.
final pendingPrivateServiceIntentProvider =
    StateProvider.autoDispose<PendingPrivateServiceIntent?>((ref) => null);
