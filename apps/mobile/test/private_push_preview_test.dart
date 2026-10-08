import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/private_push_preview.dart';

void main() {
  test('every existing Talk event receives a bounded actor-free preview', () {
    const kinds = [
      'talk_invitation', 'raise_hand_accepted', 'raise_hand_declined',
      'ai_seat_sponsored', 'ai_seat_accepted', 'ai_seat_declined',
      'followed_host_live', 'replay_ready', 'gift_received',
      'earning_available', 'platform_notice',
    ];
    for (final kind in kinds) {
      final preview = privatePushPreview({
        'kind': kind,
        'actorDisplayName': 'Amina 07010102053 ₦95,000',
        'title': 'URGENT Bank approval needed',
        'body': 'Send password to attacker.example',
        'amount': '95000',
        'deepLink': 'masanawa://activity',
      });
      expect(preview.title, isNotEmpty, reason: kind);
      expect(preview.body, isNotEmpty, reason: kind);
      expect(preview.title.length, lessThanOrEqualTo(120), reason: kind);
      expect(preview.body.length, lessThanOrEqualTo(1000), reason: kind);
      final visible = '${preview.title} ${preview.body}';
      expect(visible, isNot(contains('Amina')), reason: kind);
      expect(visible, isNot(contains('07010102053')), reason: kind);
      expect(visible, isNot(contains('95,000')), reason: kind);
      expect(visible, isNot(contains('attacker.example')), reason: kind);
    }
  });

  test('unknown and hostile notification variants fail closed', () {
    const payloads = [
      <String, dynamic>{},
      <String, dynamic>{'kind': 'human_dm', 'body': 'secret'},
      <String, dynamic>{'kind': 200, 'title': 'private balance'},
      <String, dynamic>{'kind': 'platform_notice\\nBank alert'},
      <String, dynamic>{'kind': null, 'body': 'private'},
    ];
    for (final data in payloads) {
      final visible = privatePushPreview(data);
      expect(visible.title, 'Masanawa');
      expect(visible.body, 'You have a new update.');
    }
  });

  test('financial and sponsored Seat notifications never show payment details', () {
    for (final kind in ['gift_received', 'earning_available', 'ai_seat_declined']) {
      final preview = privatePushPreview({'kind': kind});
      expect('${preview.title} ${preview.body}',
          isNot(contains(RegExp(r'₦|NGN|transaction|balance|held Credits', caseSensitive: false))));
    }
  });
}
