class BillCategory {
  const BillCategory({
    required this.code,
    required this.name,
    required this.description,
    required this.country,
  });

  factory BillCategory.fromJson(Map<String, dynamic> json) => BillCategory(
        code: json['code'] as String,
        name: json['name'] as String,
        description: json['description'] as String?,
        country: json['country'] as String,
      );

  final String code;
  final String name;
  final String? description;
  final String country;
}

class BillBiller {
  const BillBiller({required this.billerCode, required this.name});

  factory BillBiller.fromJson(Map<String, dynamic> json) => BillBiller(
        billerCode: json['billerCode'] as String,
        name: json['name'] as String,
      );

  final String billerCode;
  final String name;
}

class BillItem {
  const BillItem({
    required this.billerCode,
    required this.itemCode,
    required this.name,
    required this.amount,
    required this.currency,
    required this.labelName,
  });

  factory BillItem.fromJson(Map<String, dynamic> json) => BillItem(
        billerCode: json['billerCode'] as String,
        itemCode: json['itemCode'] as String,
        name: json['name'] as String,
        amount: json['amount'].toString(),
        currency: json['currency'] as String,
        labelName: json['labelName'] as String?,
      );

  final String billerCode;
  final String itemCode;
  final String name;
  final String amount;
  final String currency;
  final String? labelName;

  bool get variableAmount {
    final parsed = num.tryParse(amount);
    return parsed == null || parsed == 0;
  }
}

class BillingQuote {
  const BillingQuote({
    required this.quoteId,
    required this.revision,
    required this.categoryCode,
    required this.billerCode,
    required this.itemCode,
    required this.itemName,
    required this.customerId,
    required this.serviceAmountKobo,
    required this.feeAmountKobo,
    required this.totalAmountKobo,
    required this.currency,
    required this.state,
    required this.expiresAt,
    required this.checkoutUrl,
    required this.providerReference,
    required this.billProviderReference,
    required this.fulfillmentReference,
    required this.refundReference,
    required this.createdAt,
    required this.updatedAt,
  });

  factory BillingQuote.fromJson(Map<String, dynamic> json) => BillingQuote(
        quoteId: json['quoteId'] as String,
        revision: (json['revision'] as num).toInt(),
        categoryCode: json['categoryCode'] as String?,
        billerCode: json['billerCode'] as String,
        itemCode: json['itemCode'] as String,
        itemName: json['itemName'] as String,
        customerId: json['customerId'] as String,
        serviceAmountKobo: (json['serviceAmountKobo'] as num).toInt(),
        feeAmountKobo: (json['feeAmountKobo'] as num).toInt(),
        totalAmountKobo: (json['totalAmountKobo'] as num).toInt(),
        currency: json['currency'] as String,
        state: json['state'] as String,
        expiresAt: json['expiresAt'] as String,
        checkoutUrl: json['checkoutUrl'] as String?,
        providerReference: json['providerReference'] as String?,
        billProviderReference: json['billProviderReference'] as String?,
        fulfillmentReference: json['fulfillmentReference'] as String?,
        refundReference: json['refundReference'] as String?,
        createdAt: json['createdAt'] as String,
        updatedAt: json['updatedAt'] as String,
      );

  final String quoteId;
  final int revision;
  final String? categoryCode;
  final String billerCode;
  final String itemCode;
  final String itemName;
  final String customerId;
  final int serviceAmountKobo;
  final int feeAmountKobo;
  final int totalAmountKobo;
  final String currency;
  final String state;
  final String expiresAt;
  final String? checkoutUrl;
  final String? providerReference;
  final String? billProviderReference;
  final String? fulfillmentReference;
  final String? refundReference;
  final String createdAt;
  final String updatedAt;

  String get serviceAmount => _formatKobo(serviceAmountKobo);
  String get feeAmount => _formatKobo(feeAmountKobo);
  String get totalAmount => _formatKobo(totalAmountKobo);
}

class BillingPurchaseReceipt {
  const BillingPurchaseReceipt({
    required this.fulfillmentReference,
    required this.state,
    required this.providerReference,
    required this.providerStatus,
    required this.deliveryCode,
  });

  factory BillingPurchaseReceipt.fromJson(Map<String, dynamic> json) =>
      BillingPurchaseReceipt(
        fulfillmentReference: json['fulfillmentReference'] as String,
        state: json['state'] as String,
        providerReference: json['providerReference'] as String?,
        providerStatus: json['providerStatus'] as String?,
        deliveryCode: json['deliveryCode'] as String?,
      );

  final String fulfillmentReference;
  final String state;
  final String? providerReference;
  final String? providerStatus;
  final String? deliveryCode;
}

class BillingCheckoutView {
  const BillingCheckoutView({
    required this.quote,
    required this.phase,
    required this.checkoutUrl,
    required this.purchase,
  });

  factory BillingCheckoutView.fromJson(Map<String, dynamic> json) =>
      BillingCheckoutView(
        quote: BillingQuote.fromJson(json['quote'] as Map<String, dynamic>),
        phase: json['phase'] as String,
        checkoutUrl: json['checkoutUrl'] as String?,
        purchase: json['purchase'] is Map<String, dynamic>
            ? BillingPurchaseReceipt.fromJson(
                json['purchase'] as Map<String, dynamic>,
              )
            : null,
      );

  final BillingQuote quote;
  final String phase;
  final String? checkoutUrl;
  final BillingPurchaseReceipt? purchase;

  bool get isTerminal =>
      phase == 'fulfilled' || phase == 'refunded' || phase == 'failed';
}

String _formatKobo(int value) {
  final whole = value ~/ 100;
  final fraction = (value % 100).toString().padLeft(2, '0');
  return fraction == '00' ? '$whole' : '$whole.$fraction';
}
