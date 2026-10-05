import 'package:permission_handler/permission_handler.dart';

enum AppPermission {
  microphone,
  camera,
  notifications,
}

class AppPermissionResult {
  const AppPermissionResult({
    required this.granted,
    required this.permanentlyDenied,
  });
  final bool granted;
  final bool permanentlyDenied;
}

class AppPermissions {
  AppPermissions._();

  static Permission _permission(AppPermission value) => switch (value) {
        AppPermission.microphone => Permission.microphone,
        AppPermission.camera => Permission.camera,
        AppPermission.notifications => Permission.notification,
      };

  static Future<AppPermissionResult> request(AppPermission value) async {
    final permission = _permission(value);
    var status = await permission.status;
    if (!status.isGranted) status = await permission.request();
    return AppPermissionResult(
      granted: status.isGranted || status.isLimited || status.isProvisional,
      permanentlyDenied: status.isPermanentlyDenied || status.isRestricted,
    );
  }

  static Future<void> openSettings() => openAppSettings();
}
