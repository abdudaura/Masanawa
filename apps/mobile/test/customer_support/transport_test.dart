
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/customer_support/models.dart';
import 'package:masanawa/src/customer_support/transport.dart';

void main() {
  test('support v4 request keys are well-formed and unique', () {
    final keys = List.generate(64, (_) => newSupportRequestKey());
    final pattern = RegExp(r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$');
    expect(keys.toSet().length, 64);
    for (final key in keys) {
      expect(pattern.hasMatch(key), isTrue);
    }
  });

  test('rejects fabricated server payment success and status codes', () {
    expect(() => SupportOperationStatus.fromJson({
      'kind': 'billing_quote',
      'referenceMask': '••••1234',
      'phase': 'credited-even-though-unknown',
      'observedAt': '2026-10-08T12:00:00Z',
      'message': 'Done!',
    }), throwsFormatException);
    expect(() => CustomerSupportTicket.fromJson({
      'id':'id','kind':'general','referenceMask':null,'operationPhase':null,
      'summary':'need help','status':'delivered_to_human','resolution':null,
      'createdAt':'2026-10-08T12:00:00Z',
    }), throwsFormatException);
  });
}
