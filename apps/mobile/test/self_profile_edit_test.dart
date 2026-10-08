import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/social/self_profile_edit.dart';

void main() {
  test('R18 canonicalizes the exact set of editable identity fields', () {
    const draft = SelfProfileDraft(
      handle: '  @Am.Ina  ',
      displayName: '  Amina Bello ',
      bio: '  Host and writer  ',
    );
    expect(draft.validate(), isNull);
    expect(draft.toJson(), {
      'handle': 'am.ina',
      'displayName': 'Amina Bello',
      'bio': 'Host and writer',
    });
    expect(draft.toJson().containsKey('userId'), isFalse);
    expect(draft.toJson().containsKey('avatarUrl'), isFalse);
  });

  test('R18 rejects invalid public handle and empty name', () {
    expect(const SelfProfileDraft(
      handle: 'x', displayName: 'Amina', bio: '',
    ).validate(), isNotNull);
    expect(const SelfProfileDraft(
      handle: 'valid_name', displayName: '   ', bio: '',
    ).validate(), isNotNull);
    expect(const SelfProfileDraft(
      handle: 'Hello World', displayName: 'Amina', bio: '',
    ).validate(), isNotNull);
  });

  test('R18 enforces server-compatible lengths and control character policy', () {
    expect(SelfProfileDraft(
      handle: 'amina', displayName: 'A' * 161, bio: '',
    ).validate(), isNotNull);
    expect(SelfProfileDraft(
      handle: 'amina', displayName: 'Amina', bio: 'x' * 1001,
    ).validate(), isNotNull);
    expect(const SelfProfileDraft(
      handle: 'amina', displayName: 'Amina', bio: 'Hello\nWorld',
    ).validate(), isNull);
    expect(const SelfProfileDraft(
      handle: 'amina', displayName: 'Amina\u0007', bio: '',
    ).validate(), isNotNull);
  });
}
