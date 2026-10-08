import 'package:fast_contacts/fast_contacts.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:share_plus/share_plus.dart';
import 'device_contacts_model.dart';

/// Read-only native contacts bridge. It selects only name and phone number fields.
class NativeDeviceContactsPlatform implements DeviceContactsPlatform {
  const NativeDeviceContactsPlatform();

  static DeviceContactsPermission convert(PermissionStatus status) {
    if (status.isGranted) return DeviceContactsPermission.granted;
    if (status.isLimited) return DeviceContactsPermission.limited;
    if (status.isPermanentlyDenied) return DeviceContactsPermission.permanentlyDenied;
    if (status.isRestricted) return DeviceContactsPermission.restricted;
    return DeviceContactsPermission.denied;
  }

  @override
  Future<DeviceContactsPermission> checkPermission() async =>
      convert(await Permission.contacts.status);

  @override
  Future<DeviceContactsPermission> requestPermission() async =>
      convert(await Permission.contacts.request());

  @override
  Future<void> openPermissionSettings() async {
    await openAppSettings();
  }

  @override
  Future<List<DevicePhoneContact>> readContacts() async {
    final allowed = await checkPermission();
    if (allowed != DeviceContactsPermission.granted &&
        allowed != DeviceContactsPermission.limited) return const [];
    final osRecords = await FastContacts.getAllContacts(
      fields: const [ContactField.displayName, ContactField.phoneNumbers],
      batchSize: 50,
    );
    return [
      for (final person in osRecords)
        DevicePhoneContact(
          deviceId: person.id,
          name: person.displayName,
          numbers: [for (final phone in person.phones) phone.number],
        ),
    ];
  }
}

/// No phone, person identifier or privileged token is shared.
class NativeDeviceContactsInvite implements DeviceContactsInvite {
  const NativeDeviceContactsInvite();
  @override
  Future<void> sharePublicInvite() async {
    await SharePlus.instance.share(const ShareParams(
      text: 'Join me on Masanawa: https://masanawa.com',
    ));
  }
}
