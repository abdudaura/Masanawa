import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/finance/internal_crypto_transfer.dart';

void main() {
  test('fail-closed capability parsing accepts explicit unavailable status', () {
    final capability = InternalCryptoAvailability.fromJson({
      'enabled': false, 'reason': 'kyc_aml_limits_policy_not_configured',
      'routes': [],
    });
    expect(capability.enabled, isFalse);
    expect(capability.reason, contains('policy'));
    expect(capability.routes, isEmpty);
    expect(
      () => InternalCryptoAvailability.fromJson({
        'enabled': 'yes', 'routes': [],
      }),
      throwsFormatException,
    );
  });

  test('quotes require exact zero fee and valid expiry', () {
    final quote = <String, dynamic>{
      'quoteId': 'request_abc',
      'senderUserId': 'user_sender',
      'recipientUserId': 'user_recipient',
      'asset': 'USDTTRC20',
      'network': 'tron',
      'amount': '1.000000000000000001',
      'fee': '0',
      'expiresAt': '2026-10-08T12:00:00Z',
    };
    final parsed = InternalCryptoQuote.fromJson(quote);
    expect(parsed.amount, '1.000000000000000001');
    expect(parsed.network, 'tron');
    expect(() => InternalCryptoQuote.fromJson({...quote, 'fee': '1'}),
      throwsFormatException);
    expect(() => InternalCryptoQuote.fromJson({...quote, 'expiresAt': 'not-a-time'}),
      throwsFormatException);
  });

  test('never treat pending or on-chain response as completed book receipt', () {
    final receipt = <String, dynamic>{
      'transferId': 'request_transfer', 'requestId': 'request_request',
      'senderUserId': 'user_sender', 'recipientUserId': 'user_recipient',
      'asset': 'USDTTRC20', 'network': 'tron', 'amount': '1.1',
      'fee': '0', 'status': 'completed', 'kind': 'internal-book-transfer',
      'completedAt': '2026-10-08T12:01:00Z',
    };
    expect(InternalCryptoReceipt.fromJson(receipt).amount, '1.1');
    expect(() => InternalCryptoReceipt.fromJson({...receipt, 'status': 'processing'}),
      throwsFormatException);
    expect(() => InternalCryptoReceipt.fromJson({...receipt, 'kind': 'on-chain'}),
      throwsFormatException);
  });
}
