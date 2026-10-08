import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../state/session_state.dart';

/// A draft choice is only a reminder to open an authorized flow after the
/// Host has created a Talk. It is never a reserved Seat, quote or invitation.
enum TalkCreateParticipantAction {
  invitePerson,
  addExpert,
  addTwin,
}

List<TalkCreateParticipantAction> parseTalkCreateActions(String? stored) {
  if (stored == null || stored.isEmpty) return const [];
  final valid = TalkCreateParticipantAction.values;
  final actions = <TalkCreateParticipantAction>[];
  for (final name in stored.split(',')) {
    for (final action in valid) {
      if (action.name == name && !actions.contains(action)) {
        actions.add(action);
      }
    }
  }
  return List.unmodifiable(actions);
}

abstract interface class TalkCreateActionStore {
  Future<List<TalkCreateParticipantAction>> load(String talkId);
  Future<void> save(String talkId, List<TalkCreateParticipantAction> actions);
}

/// Only nonfinancial intent identifiers are stored. No persona price, payment
/// authority, audience information or invitation recipient is persisted here.
class SecureTalkCreateActionStore implements TalkCreateActionStore {
  SecureTalkCreateActionStore({
    required String ownerUserId,
    FlutterSecureStorage? storage,
  }) : _ownerUserId = ownerUserId.trim(),
       _storage = storage ?? const FlutterSecureStorage(
         aOptions: AndroidOptions(),
         iOptions: IOSOptions(
           accessibility: KeychainAccessibility.first_unlock_this_device,
         ),
       );

  final String _ownerUserId;
  final FlutterSecureStorage _storage;

  String _key(String talkId) {
    final id = talkId.trim();
    if (_ownerUserId.isEmpty || _ownerUserId.length > 160) {
      throw StateError('A signed-in account is required to resume Talk actions');
    }
    if (id.isEmpty || id.length > 160) {
      throw const FormatException('Invalid Talk identifier');
    }
    return 'talk-create-actions-v2-' +
        Uri.encodeComponent(_ownerUserId) + '-' + Uri.encodeComponent(id);
  }

  @override
  Future<List<TalkCreateParticipantAction>> load(String talkId) async {
    return parseTalkCreateActions(await _storage.read(key: _key(talkId)));
  }

  @override
  Future<void> save(String talkId, List<TalkCreateParticipantAction> actions) async {
    final key = _key(talkId);
    final distinct = actions.toSet().toList(growable: false);
    if (distinct.isEmpty) {
      await _storage.delete(key: key);
      return;
    }
    await _storage.write(
      key: key,
      value: distinct.map((action) => action.name).join(','),
    );
  }
}

final talkCreateActionStoreProvider = Provider<TalkCreateActionStore>((ref) {
  final ownerUserId = ref.watch(sessionProvider.select(
    (session) => session is SessionSignedIn ? session.user.id : '',
  ));
  return SecureTalkCreateActionStore(ownerUserId: ownerUserId);
});
