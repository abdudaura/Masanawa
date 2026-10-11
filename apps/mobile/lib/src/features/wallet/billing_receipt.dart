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

  factory BillReceipt.fromJson(Object? value) {
    if (value is! Map) throw const FormatException('Invalid bill receipt');
    final j = value.cast<String, dynamic>();
    if (j['kind'] != 'billing-receipt' ||
        j['reference'] is! String ||
        !validBillReference(j['reference'] as String) ||
        j['title'] is! String ||
        (j['title'] as String).isEmpty ||
        j['summary'] is! String ||
        j['rows'] is! List ||
        (j['rows'] as List).length > 12 ||
        j['canRefresh'] is! bool) {
      throw const FormatException('Malformed bill receipt');
    }
    final state = switch (j['status']) {
      'ready' => BillReceiptStatus.ready,
      'processing' => BillReceiptStatus.processing,
      'checking' => BillReceiptStatus.checking,
      'successful' => BillReceiptStatus.successful,
      'failed' => BillReceiptStatus.failed,
      'reversed' => BillReceiptStatus.reversed,
      'needs-review' => BillReceiptStatus.needsReview,
      _ => throw const FormatException('Unsupported receipt status'),
    };
    final rows = <BillReceiptRow>[];
    for (final item in j['rows'] as List) {
      if (item is! Map || item['label'] is! String ||
          item['value'] is! String ||
          (item['label'] as String).length > 100 ||
          (item['value'] as String).length > 500) {
        throw const FormatException('Invalid receipt detail row');
      }
      rows.add(BillReceiptRow(item['label'] as String, item['value'] as String));
    }
    return BillReceipt(
      reference: j['reference'] as String,
      status: state,
      title: j['title'] as String,
      summary: j['summary'] as String,
      rows: List.unmodifiable(rows),
      canRefresh: j['canRefresh'] as bool,
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
