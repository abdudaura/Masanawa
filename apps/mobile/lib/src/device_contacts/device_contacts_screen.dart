import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../state/session_state.dart';
import 'device_contacts_controller.dart';
import 'device_contacts_consent_store.dart';
import 'device_contacts_model.dart';
import 'device_contacts_native.dart';

/// Nested Chats feature, not a sixth tab. F12 owns root route registration.
class DeviceContactsScreen extends ConsumerWidget {
  const DeviceContactsScreen({super.key, this.platform, this.invite, this.consentStore});
  final DeviceContactsPlatform? platform;
  final DeviceContactsInvite? invite;
  final DeviceContactsConsentStore? consentStore;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    final accountId = session is SessionSignedIn ? session.user.id : null;
    return _DeviceContactsBody(
      key: ValueKey(accountId), accountId: accountId,
      platform: platform ?? const NativeDeviceContactsPlatform(),
      invite: invite ?? const NativeDeviceContactsInvite(),
      consentStore: consentStore ?? const SecureDeviceContactsConsentStore(),
    );
  }
}

class _DeviceContactsBody extends StatefulWidget {
  const _DeviceContactsBody({
    super.key, required this.accountId, required this.platform, required this.invite,
    required this.consentStore,
  });
  final String? accountId;
  final DeviceContactsPlatform platform;
  final DeviceContactsInvite invite;
  final DeviceContactsConsentStore consentStore;

  @override
  State<_DeviceContactsBody> createState() => _DeviceContactsBodyState();
}

class _DeviceContactsBodyState extends State<_DeviceContactsBody>
    with WidgetsBindingObserver {
  late final DeviceContactsController controller;
  final query = TextEditingController();

  @override
  void initState() {
    super.initState();
    controller = DeviceContactsController(
      platform: widget.platform, invite: widget.invite, accountId: widget.accountId,
      consentStore: widget.consentStore,
    );
    controller.addListener(_rebuild);
    unawaited(controller.restoreConsent());
    WidgetsBinding.instance.addObserver(this);
  }

  void _rebuild() { if (mounted) setState(() {}); }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && controller.optedIn) {
      controller.refresh();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    query.dispose();
    controller.removeListener(_rebuild);
    controller.dispose();
    super.dispose();
  }

  String masked(String value) {
    final digits = value.replaceAll(RegExp(r'[^0-9]'), '');
    if (digits.isEmpty) return 'Number';
    final suffix = digits.length <= 3 ? digits : digits.substring(digits.length - 3);
    return 'ending ' + suffix;
  }

  @override
  Widget build(BuildContext context) {
    final visible = controller.visible;
    return Scaffold(
    appBar: AppBar(
      title: const Text('Phone contacts'),
      actions: [
        if (controller.optedIn)
          TextButton(onPressed: controller.disable, child: const Text('Turn off')),
      ],
    ),
    body: widget.accountId == null
        ? const Center(child: Text('Sign in to view your phone contacts.'))
        : !controller.optedIn
          ? Center(child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                const Icon(Icons.contacts_outlined, size: 48),
                const SizedBox(height: 16),
                Text('Find phone contacts', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 12),
                const Text(
                  'Optional: read names and phone numbers on this device to invite friends. '
                  'Your address book stays on this phone. We will not upload numbers, '
                  'match people to accounts, or send invitations automatically.',
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                if (controller.rememberedConsent)
                  const Text('Previously enabled. Tap again to view contacts on this device.'),
                if (controller.error != null) Text(controller.error!),
                FilledButton(onPressed: controller.busy ? null : controller.enable,
                  child: const Text('Continue to phone permission')),
                const SizedBox(height: 12),
                const Text('You can still message Masanawa contacts without this permission.'),
              ]),
            ))
          : Column(children: [
              if (controller.busy) const LinearProgressIndicator(),
              if (controller.error != null)
                MaterialBanner(content: Text(controller.error!), actions: [
                  TextButton(onPressed: controller.refresh, child: const Text('Retry')),
                ]),
              if (controller.needsSettings || !controller.canRead)
                Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(children: [
                    const Text('Contacts access is off or limited by device settings. '
                        'You can use Masanawa contacts without it.'),
                    if (controller.needsSettings)
                      TextButton(onPressed: controller.openSettings,
                        child: const Text('Open settings')),
                    if (!controller.needsSettings)
                      TextButton(onPressed: () => controller.refresh(requestIfNeeded: true),
                        child: const Text('Check permission')),
                  ]),
                )
              else ...[
                Padding(padding: const EdgeInsets.all(12),
                  child: TextField(controller: query,
                    onChanged: controller.setSearch,
                    decoration: const InputDecoration(
                      hintText: 'Search phone contacts on this device',
                      prefixIcon: Icon(Icons.search),
                      border: OutlineInputBorder(),
                    ),
                  )),
                const Padding(padding: EdgeInsets.symmetric(horizontal: 16),
                  child: Text('These are phonebook entries, not verified Masanawa accounts. '
                      'Invites open the device share sheet for you to choose where to send.')),
              ],
              if (controller.canRead)
                Expanded(child: controller.contacts.isEmpty && !controller.busy
                  ? const Center(child: Text('No phone numbers found.'))
                  : ListView.builder(
                      key: const ValueKey('device-phonebook-list'),
                      itemCount: visible.length,
                      itemBuilder: (context, index) {
                        final person = visible[index];
                        return Semantics(
                          label: 'Phone contact ' + person.name,
                          child: ListTile(
                            key: ValueKey(person.deviceId),
                            leading: const CircleAvatar(child: Icon(Icons.person_outline)),
                            title: Text(person.name, maxLines: 1, overflow: TextOverflow.ellipsis),
                            subtitle: Text(person.numbers.length == 1
                                ? masked(person.numbers.first)
                                : person.numbers.length.toString() + ' numbers'),
                            trailing: person.numbers.length == 1
                                ? TextButton(
                                    onPressed: controller.sharing || controller.busy
                                      ? null : () => controller.invite(person.deviceId, 0),
                                    child: const Text('Invite'),
                                  )
                                : PopupMenuButton<int>(
                                    tooltip: 'Choose a phone number to invite',
                                    enabled: !controller.sharing && !controller.busy,
                                    onSelected: (number) => controller.invite(person.deviceId, number),
                                    itemBuilder: (context) => [
                                      for (var i = 0; i < person.numbers.length; i++)
                                        PopupMenuItem(value: i, child: Text('Invite number ' +
                                          (i + 1).toString() + ', ' + masked(person.numbers[i]))),
                                    ],
                                    child: const Padding(
                                      padding: EdgeInsets.all(8),
                                      child: Text('Invite ▾'),
                                    ),
                                  ),
                          ),
                        );
                      },
                    )),
            ]),
    );
  }
}
