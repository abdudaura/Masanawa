import 'package:dio/dio.dart';

/// Read-only projection from the canonical billing fulfillment and provider
/// reconciliation. No independent wallet, token store or payment operation.
enum BillReceiptStatus { ready, processing, checking, successful, failed, reversed, needsReview }

class BillReceiptRow {
  const BillReceiptRow(this.label, this.value);
  final String label;
  final String value;
}

class BillReceipt {
  const BillReceipt({
    required this.reference,
    required this.status,
    required this.title,
    required this.summary,
    required this.rows,
    required this.canRefresh,
  });
  final String reference;
  final BillReceiptStatus status;
  final String title;
  final String summary;
  final List<BillReceiptRow> rows;
  final bool canRefresh;
  bool get finalStatus => status == BillReceiptStatus.successful ||
      status == BillReceiptStatus.failed || status == BillReceiptStatus.reversed;

  /// The existing GET /v1/commerce/bills/purchases/:reference returns a
  /// BillingFulfillmentRecord, NOT the separate receipt projection helper.
  /// Decode its actual wire fields without altering the canonical API.
  factory BillReceipt.fromJson(Object? value) {
    if (value is! Map) throw const FormatException('Invalid bill receipt');
    final j = value.cast<String, dynamic>();
    final reference = j['fulfillmentReference'];
    final title = j['itemName'];
    final recipient = j['customerId'];
    final customerName = j['customerName'];
    final amount = j['amount'];
    final providerReference = j['providerReference'];
    final deliveryCode = j['deliveryCode'];
    if (reference is! String || !validBillReference(reference) ||
        title is! String || title.isEmpty || title.length > 250 ||
        recipient is! String || recipient.isEmpty || recipient.length > 150 ||
        customerName != null && (customerName is! String || customerName.length > 250) ||
        amount is! String || amount.length > 50 ||
        !RegExp(r'^(?:0|[1-9]\d*)(?:\.\d+)?$').hasMatch(amount) ||
        j['currency'] != 'NGN' ||
        j['revision'] is! int || (j['revision'] as int) < 1 ||
        providerReference != null && (providerReference is! String || providerReference.length > 150) ||
        deliveryCode != null && (deliveryCode is! String || deliveryCode.length > 500)) {
      throw const FormatException('Malformed billing fulfillment');
    }
    final state = switch (j['state']) {
      'ready' => BillReceiptStatus.ready,
      'dispatching' => BillReceiptStatus.processing,
      'checking' => BillReceiptStatus.checking,
      'succeeded' => BillReceiptStatus.successful,
      'failed' => BillReceiptStatus.failed,
      'reversed' => BillReceiptStatus.reversed,
      'manual_review' => BillReceiptStatus.needsReview,
      _ => throw const FormatException('Unsupported fulfillment state'),
    };
    final summary = switch (state) {
      BillReceiptStatus.ready => 'Bill is ready for confirmation.',
      BillReceiptStatus.processing => 'Payment submitted; provider settlement is pending.',
      BillReceiptStatus.checking => 'Checking existing provider reference.',
      BillReceiptStatus.successful => 'Payment confirmed by the billing provider.',
      BillReceiptStatus.failed => 'Payment failed. No automatic duplicate dispatch.',
      BillReceiptStatus.reversed => 'Provider reports payment reversed.',
      BillReceiptStatus.needsReview => 'Payment needs manual staff review.',
    };
    return BillReceipt(
      reference: reference,
      status: state,
      title: title,
      summary: summary,
      rows: List.unmodifiable([
        BillReceiptRow('Recipient', recipient),
        if (customerName is String && customerName.isNotEmpty)
          BillReceiptRow('Account', customerName),
        BillReceiptRow('Amount', 'NGN $amount'),
        BillReceiptRow('Reference', reference),
        if (state == BillReceiptStatus.successful &&
            deliveryCode is String && deliveryCode.isNotEmpty)
          BillReceiptRow('Delivery code', deliveryCode),
        if (providerReference is String && providerReference.isNotEmpty)
          BillReceiptRow('Provider reference', providerReference),
      ]),
      canRefresh: state == BillReceiptStatus.processing ||
          state == BillReceiptStatus.checking ||
          state == BillReceiptStatus.successful,
    );
  }
}

bool validBillReference(String value) => value.isNotEmpty &&
    value.length <= 128 &&
    RegExp(r'^[A-Za-z0-9][A-Za-z0-9._:-]*$').hasMatch(value);

abstract class BillReceiptReader {
  Future<BillReceipt> read(String reference, {bool refresh = false});
}

/// Reuses the existing authenticated app Dio and tenant+fan-scoped route.
class DioBillReceiptReader implements BillReceiptReader {
  const DioBillReceiptReader(this.dio);
  final Dio dio;

  @override
  Future<BillReceipt> read(String reference, {bool refresh = false}) async {
    if (!validBillReference(reference)) {
      throw const FormatException('Invalid receipt reference');
    }
    final response = await dio.get<dynamic>(
      '/v1/commerce/bills/purchases/' + Uri.encodeComponent(reference),
      queryParameters: refresh ? const {'refresh': true} : null,
      options: Options(headers: const {'Cache-Control': 'no-store'}),
    );
    return BillReceipt.fromJson(response.data);
  }
}
