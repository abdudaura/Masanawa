/// Ephemeral OS phonebook records. Not Masanawa identities, and never uploaded.
class DevicePhoneContact {
  const DevicePhoneContact({
    required this.deviceId,
    required this.name,
    required this.numbers,
  });

  final String deviceId;
  final String name;
  final List<String> numbers;
}

/// No speculative E.164 conversion: only already-explicit international numbers
/// can be compared within the same local entry.
String localNumberKey(String raw) {
  final value = raw.replaceAll(RegExp(r'[\s().-]'), '');
  if (RegExp(r'^\+[1-9][0-9]{5,14}$').hasMatch(value)) return value;
  return raw.trim();
}

List<DevicePhoneContact> sanitizePhonebook(List<DevicePhoneContact> input) {
  final ids = <String>{};
  final result = <DevicePhoneContact>[];
  for (final row in input) {
    if (row.deviceId.isEmpty || !ids.add(row.deviceId)) continue;
    final numbers = <String>[];
    final seen = <String>{};
    for (final phone in row.numbers) {
      final value = phone.trim();
      if (value.isEmpty || value.length > 64) continue;
      if (!RegExp(r'^\+?[0-9()\s.-]{3,64}$').hasMatch(value)) continue;
      if (seen.add(localNumberKey(value))) numbers.add(value);
    }
    if (numbers.isEmpty) continue;
    final safeName = row.name.trim().isEmpty ? 'Unnamed contact' : row.name.trim();
    result.add(DevicePhoneContact(
      deviceId: row.deviceId,
      name: safeName,
      numbers: List.unmodifiable(numbers),
    ));
  }
  result.sort((a, b) {
    final byName = a.name.toLowerCase().compareTo(b.name.toLowerCase());
    return byName == 0 ? a.deviceId.compareTo(b.deviceId) : byName;
  });
  return List.unmodifiable(result);
}

enum DeviceContactsPermission {
  unknown, granted, limited, denied, permanentlyDenied, restricted,
}

abstract interface class DeviceContactsPlatform {
  Future<DeviceContactsPermission> checkPermission();
  Future<DeviceContactsPermission> requestPermission();
  Future<List<DevicePhoneContact>> readContacts();
  Future<void> openPermissionSettings();
}

abstract interface class DeviceContactsInvite {
  /// Share only a static public invitation; NEVER pass private phone data.
  Future<void> sharePublicInvite();
}
