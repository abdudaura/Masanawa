class CryptoCapabilities {
  const CryptoCapabilities({
    required this.deposits,
    required this.withdrawals,
    required this.conversions,
    required this.fiatOnRamp,
    required this.fiatCurrencies,
    required this.fiatSettlementProviderCode,
    this.payoutReason,
    this.conversionReason,
    this.fiatOnRampReason,
  });

  final bool deposits;
  final bool withdrawals;
  final bool conversions;
  final bool fiatOnRamp;
  final List<String> fiatCurrencies;
  final String? fiatSettlementProviderCode;
  final String? payoutReason;
  final String? conversionReason;
  final String? fiatOnRampReason;

  factory CryptoCapabilities.fromJson(Map<String, dynamic> json) {
    return CryptoCapabilities(
      deposits: json['deposits'] == true,
      withdrawals: json['withdrawals'] == true,
      conversions: json['conversions'] == true,
      fiatOnRamp: json['fiatOnRamp'] == true,
      fiatCurrencies: List.unmodifiable(
        (json['fiatCurrencies'] is List ? json['fiatCurrencies'] as List : const [])
            .whereType<String>()
            .map((value) => value.trim().toUpperCase())
            .where((value) => value.isNotEmpty),
      ),
      fiatSettlementProviderCode:
          _stringOrNull(json['fiatSettlementProviderCode'])?.toUpperCase(),
      payoutReason: _stringOrNull(json['payoutReason']),
      conversionReason: _stringOrNull(json['conversionReason']),
      fiatOnRampReason: _stringOrNull(json['fiatOnRampReason']),
    );
  }
}

class CryptoRoute {
  const CryptoRoute({
    required this.providerCode,
    required this.asset,
    required this.network,
  });

  final String providerCode;
  final String asset;
  final String? network;

  factory CryptoRoute.fromJson(Map<String, dynamic> json) {
    final providerCode = (json['providerCode'] as String? ?? '').trim();
    final asset = (json['asset'] as String? ?? providerCode).trim();
    if (providerCode.isEmpty) {
      throw const FormatException('Missing crypto provider code');
    }
    return CryptoRoute(
      providerCode: providerCode,
      asset: asset.isEmpty ? providerCode : asset,
      network: (json['network'] as String?)?.trim(),
    );
  }

  String get label {
    final value = network?.trim();
    return value == null || value.isEmpty ? asset : '$asset · $value';
  }
}

class CryptoBalance {
  const CryptoBalance({required this.providerCode, required this.amount});
  final String providerCode;
  final String amount;

  factory CryptoBalance.fromJson(Map<String, dynamic> json) {
    return CryptoBalance(
      providerCode: (json['providerCode'] as String? ?? '').trim(),
      amount: _decimal(json['amount'], allowZero: true),
    );
  }
}

class CryptoIntent {
  const CryptoIntent({
    required this.requestId,
    required this.operation,
    required this.asset,
    required this.network,
    required this.amount,
    required this.targetAsset,
    required this.targetNetwork,
    required this.destinationAddress,
    required this.status,
    required this.providerPaymentId,
    required this.providerPayoutId,
    required this.providerInvoiceId,
    required this.checkoutUrl,
    required this.providerConversionId,
    required this.providerTargetAmount,
    required this.payAddress,
    required this.providerPayAmount,
    required this.providerNetworkFee,
    required this.withdrawalFeePayer,
    required this.createdAt,
    required this.updatedAt,
  });

  final String requestId;
  final String operation;
  final String asset;
  final String? network;
  final String amount;
  final String? targetAsset;
  final String? targetNetwork;
  final String? destinationAddress;
  final String status;
  final String? providerPaymentId;
  final String? providerPayoutId;
  final String? providerInvoiceId;
  final String? checkoutUrl;
  final String? providerConversionId;
  final String? providerTargetAmount;
  final String? payAddress;
  final String? providerPayAmount;
  final String? providerNetworkFee;
  final String? withdrawalFeePayer;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  factory CryptoIntent.fromJson(Map<String, dynamic> json) {
    return CryptoIntent(
      requestId: (json['requestId'] as String? ?? '').trim(),
      operation: (json['operation'] as String? ?? '').trim(),
      asset: (json['asset'] as String? ?? '').trim(),
      network: (json['network'] as String?)?.trim(),
      amount: _decimal(json['amount']),
      targetAsset: (json['targetAsset'] as String?)?.trim(),
      targetNetwork: (json['targetNetwork'] as String?)?.trim(),
      destinationAddress: (json['destinationAddress'] as String?)?.trim(),
      status: (json['status'] as String? ?? '').trim(),
      providerPaymentId: _stringOrNull(json['providerPaymentId']),
      providerPayoutId: _stringOrNull(json['providerPayoutId']),
      providerInvoiceId: _stringOrNull(json['providerInvoiceId']),
      checkoutUrl: _httpsUrlOrNull(json['checkoutUrl']),
      providerConversionId: _stringOrNull(json['providerConversionId']),
      providerTargetAmount: _decimalOrNull(json['providerTargetAmount']),
      payAddress: _stringOrNull(json['payAddress']),
      providerPayAmount: _decimalOrNull(json['providerPayAmount']),
      providerNetworkFee: _decimalOrNull(
        json['providerNetworkFee'],
        allowZero: true,
      ),
      withdrawalFeePayer: _stringOrNull(json['withdrawalFeePayer']),
      createdAt: _dateOrNull(json['createdAt']),
      updatedAt: _dateOrNull(json['updatedAt']),
    );
  }

  bool get terminal => const {
        'succeeded',
        'failed',
        'refunded',
        'expired',
        'manual_review',
      }.contains(status);

  bool get pending => !terminal;
}

class CryptoWithdrawalQuote {
  const CryptoWithdrawalQuote({
    required this.providerCode,
    required this.amount,
    required this.destinationAddress,
    required this.minimumAmount,
    required this.networkFee,
    required this.networkFeeMode,
    required this.feePayer,
    required this.estimatedReceiveAmount,
    required this.quotedAt,
  });

  final String providerCode;
  final String amount;
  final String destinationAddress;
  final String minimumAmount;
  final String networkFee;
  final String networkFeeMode;
  final String feePayer;
  final String estimatedReceiveAmount;
  final DateTime? quotedAt;

  factory CryptoWithdrawalQuote.fromJson(Map<String, dynamic> json) {
    return CryptoWithdrawalQuote(
      providerCode: (json['providerCode'] as String? ?? '').trim(),
      amount: _decimal(json['amount']),
      destinationAddress:
          (json['destinationAddress'] as String? ?? '').trim(),
      minimumAmount: _decimal(json['minimumAmount']),
      networkFee: _decimal(json['networkFee'], allowZero: true),
      networkFeeMode:
          (json['networkFeeMode'] as String? ?? 'receiver').trim(),
      feePayer: (json['feePayer'] as String? ?? 'user').trim(),
      estimatedReceiveAmount: _decimal(json['estimatedReceiveAmount']),
      quotedAt: _dateOrNull(json['quotedAt']),
    );
  }
}

class CryptoFiatPurchase {
  const CryptoFiatPurchase({
    required this.requestId,
    required this.fiatAmount,
    required this.fiatCurrency,
    required this.settlementAsset,
    required this.settlementNetwork,
    required this.cryptoAmount,
    required this.status,
    required this.providerInvoiceId,
    required this.providerPaymentId,
    required this.checkoutUrl,
    required this.outcomeUnknown,
  });

  final String requestId;
  final String fiatAmount;
  final String fiatCurrency;
  final String settlementAsset;
  final String? settlementNetwork;
  final String? cryptoAmount;
  final String status;
  final String? providerInvoiceId;
  final String? providerPaymentId;
  final String? checkoutUrl;
  final bool outcomeUnknown;

  factory CryptoFiatPurchase.fromJson(Map<String, dynamic> json) {
    return CryptoFiatPurchase(
      requestId: (json['requestId'] as String? ?? '').trim(),
      fiatAmount: _decimal(json['fiatAmount']),
      fiatCurrency: (json['fiatCurrency'] as String? ?? '').trim().toUpperCase(),
      settlementAsset:
          (json['settlementAsset'] as String? ?? '').trim().toUpperCase(),
      settlementNetwork: _stringOrNull(json['settlementNetwork']),
      cryptoAmount: _decimalOrNull(json['cryptoAmount']),
      status: (json['status'] as String? ?? '').trim(),
      providerInvoiceId: _stringOrNull(json['providerInvoiceId']),
      providerPaymentId: _stringOrNull(json['providerPaymentId']),
      checkoutUrl: _httpsUrlOrNull(json['checkoutUrl']),
      outcomeUnknown: json['outcomeUnknown'] == true,
    );
  }

  bool get terminal => const {
        'succeeded',
        'failed',
        'refunded',
        'expired',
        'manual_review',
      }.contains(status);
}

class CryptoConversionQuote {
  const CryptoConversionQuote({
    required this.providerCode,
    required this.targetProviderCode,
    required this.amount,
    required this.minimumAmount,
    required this.estimatedTargetAmount,
    required this.quotedAt,
  });

  final String providerCode;
  final String targetProviderCode;
  final String amount;
  final String minimumAmount;
  final String estimatedTargetAmount;
  final DateTime? quotedAt;

  factory CryptoConversionQuote.fromJson(Map<String, dynamic> json) {
    return CryptoConversionQuote(
      providerCode: (json['providerCode'] as String? ?? '').trim(),
      targetProviderCode:
          (json['targetProviderCode'] as String? ?? '').trim(),
      amount: _decimal(json['amount']),
      minimumAmount: _decimal(json['minimumAmount']),
      estimatedTargetAmount: _decimal(json['estimatedTargetAmount']),
      quotedAt: _dateOrNull(json['quotedAt']),
    );
  }
}

String _decimal(Object? value, {bool allowZero = false}) {
  final text = switch (value) {
    String value => value.trim(),
    num value => value.toString(),
    _ => '',
  };
  final match = RegExp(r'^(?:0|[1-9]\d*)(?:\.\d{1,18})?$').hasMatch(text);
  if (!match) throw const FormatException('Invalid crypto amount');
  final parsed = num.tryParse(text);
  if (parsed == null || parsed.isNegative || (!allowZero && parsed == 0)) {
    throw const FormatException('Invalid crypto amount');
  }
  var normalized = text;
  if (normalized.contains('.')) {
    normalized = normalized.replaceFirst(RegExp(r'0+$'), '');
    normalized = normalized.replaceFirst(RegExp(r'\.$'), '');
  }
  return normalized;
}

String? _decimalOrNull(Object? value, {bool allowZero = false}) {
  if (value == null || value == '') return null;
  return _decimal(value, allowZero: allowZero);
}

String? _stringOrNull(Object? value) {
  if (value is! String) return null;
  final text = value.trim();
  return text.isEmpty ? null : text;
}

String? _httpsUrlOrNull(Object? value) {
  final text = _stringOrNull(value);
  if (text == null) return null;
  final uri = Uri.tryParse(text);
  if (uri == null || uri.scheme != 'https' || uri.host.isEmpty) {
    throw const FormatException('Invalid secure checkout URL');
  }
  return uri.toString();
}

DateTime? _dateOrNull(Object? value) {
  if (value is! String || value.trim().isEmpty) return null;
  return DateTime.tryParse(value)?.toLocal();
}
