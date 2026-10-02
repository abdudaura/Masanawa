# Agent Phone and Device Embodiment

Status: product/architecture direction. Detailed protocol and package contracts require ADRs before implementation.

## 1. Goal

Allow a Masanawa Character to be assigned a real Android phone, potentially rooted, so the Character can use capabilities that are difficult or impossible to provide purely through cloud APIs.

Examples:
- a real SIM and phone number;
- inbound and outbound cellular calls;
- SMS;
- USSD;
- mobile-app sessions;
- camera, microphone and screen;
- notifications;
- mobile browser/app interaction;
- selected local sensors;
- local/offline execution.

The intended end state is a unified Masanawa Agent Device application/runtime. OmniSIP can later provide the telephony subsystem for rooted Android devices.

## 2. Core invariant

> **Phone = body/device. Cloud platform = canonical brain and durable truth.**

A phone must never become:
- a second Character store;
- a second memory authority;
- a separate task/workflow engine;
- a separate skill registry;
- a separate identity system;
- the canonical social/commerce database.

If a phone is lost or replaced, the Character still exists.

## 3. System shape

```text
Masanawa canonical platform
  |
  | secure device protocol
  v
Masanawa Agent Device Runtime
  |
  +-- capability registry / health
  +-- durable bounded local operation queue
  +-- app automation adapter
  +-- browser/mobile interaction adapter
  +-- camera/microphone/screen adapters
  +-- notifications/device-state adapters
  +-- local encrypted credential/session custody
  +-- telephony adapter
        |
        +-- OmniSIP
              |
              +-- Android Telecom / SIM / GSM / VoLTE
              +-- SIP / RTP / direct AI media transport
              +-- SMS / USSD
```

## 4. Canonical entities

Detailed schemas are deferred, but the platform should converge on concepts equivalent to:

### Device
A registered physical or virtual execution node.

Owns:
- device identity;
- attestation/pairing state;
- lifecycle state;
- last-seen/health;
- device class;
- platform/version metadata.

### DeviceCapability
A capability dynamically published by a Device.

Examples:
- `telephony.call.place`
- `telephony.call.answer`
- `telephony.audio.bridge`
- `sms.send`
- `sms.receive`
- `ussd.execute`
- `app.launch`
- `app.notification.observe`
- `app.notification.reply`
- `screen.observe`
- `screen.interact`
- `camera.capture`
- `microphone.stream`
- `location.read`
- `contacts.lookup`
- `browser.mobile.execute`
- `device.power.status`
- `device.network.status`

Capabilities are runtime facts, not assumptions based on app version. A dual-SIM phone must not claim concurrent-call ability unless the device is actually qualified for it.

### CharacterDeviceAssignment
Authorizes a Character to use a Device.

Suggested semantics:
- CharacterId;
- DeviceId;
- role: primary / secondary / pooled;
- valid-from / valid-until;
- capability policy;
- authority/tenant scope.

A Device may be replaceable without changing Character identity.

### DeviceOperation
Durable identity for a consequential action delegated to a Device.

It should carry:
- OperationId;
- Character/Tenant authority context;
- requested Tool/capability;
- idempotency key;
- deadline;
- execution state;
- evidence/receipt;
- reconciliation state.

### PhoneIdentity / ChannelIdentity / SocialIdentity
External identities bound to a Character through explicit ownership/authorization.

A phone number, WhatsApp account, Instagram account or email address is not the Character's canonical identity.

## 5. Phone as a Provider

The cleanest integration with the existing Phase 5 architecture is to model the phone as a Provider for Tools.

Example:

```text
Skill: contact_customer
  -> Tool: place_phone_call
       -> Provider candidates:
            CloudTelephonyProvider
            AssignedAndroidDeviceProvider
                 -> DeviceCapability: telephony.call.place
                 -> OmniSIP
                 -> physical SIM
```

Provider selection can consider:
- required capability;
- assigned Character device;
- provider readiness;
- device health;
- SIM/network state;
- cost;
- policy;
- user preference;
- required phone identity.

Existing Tool/Provider rules remain valid:
- current authority;
- credential scoping;
- readiness;
- typed failures;
- Operation identity;
- receipts;
- idempotency;
- uncertain-outcome reconciliation.

A device going offline is a Provider readiness/failure condition, not a reason to invent a second execution model.

## 6. Cloud/device execution split

### Keep in canonical cloud/platform services
- Character identity/Constitution;
- relationship and shared memory;
- World/life state;
- Skill definitions/versions;
- Tool definitions;
- Workflow state/checkpoints;
- approvals and Authority;
- social/commerce canonical state;
- audit/telemetry;
- long-term scheduling/proactivity;
- provider selection;
- fleet management;
- costly/general inference by default.

### Allow on the Device
- execution of assigned DeviceOperations;
- short-lived/bounded local custody;
- local capability discovery;
- phone/SIM actions;
- mobile app interaction;
- camera/microphone/screen capture;
- notification observation/reply;
- local health/watchdog;
- encrypted local session/credential material that must exist on-device;
- optional small/local inference for latency/offline assistance.

Local data should be minimized and sync back typed evidence/results, not become an alternate platform database.

## 7. Offline and intermittent connectivity

A useful agent phone must tolerate unreliable connectivity.

Recommended operation flow:

1. cloud creates a signed/authorized DeviceOperation;
2. device accepts custody and durably records the operation locally;
3. device executes at most according to idempotency/capability rules;
4. device stores a local receipt/evidence;
5. if cloud is unavailable, receipt remains queued;
6. on reconnect, device uploads receipt;
7. canonical Operation state reconciles;
8. duplicate delivery replays the existing receipt rather than duplicating the side effect.

For ambiguous actions, the platform must not blindly retry.

## 8. OmniSIP integration boundary

`Baatiku/OmniSIP` is a strong telephony implementation donor/subsystem for the Agent Phone concept because it already targets:
- Android Telecom integration;
- explicit SIM identity;
- GSM/VoLTE-to-SIP/media bridging;
- incoming/outgoing calls;
- SMS/USSD;
- rooted-device audio capture/injection;
- device-specific audio profiles;
- boot persistence;
- call lifecycle/recovery;
- DSDS/DSDA capability distinction.

Masanawa should not copy OmniSIP into the core domain.

The preferred boundary is:

```text
Tool / Provider
   -> AndroidDeviceProvider
       -> Telephony DeviceCapability
           -> Masanawa Agent Device telephony adapter
               -> OmniSIP subsystem
```

OmniSIP owns telephony mechanics. Masanawa owns Character identity, permission, task intent, provider selection, Operation truth and audit.

## 9. Social/mobile app accounts

A dedicated phone can give an agent access to authenticated mobile experiences that have incomplete or unavailable cloud APIs.

Examples may include messaging/social apps, email clients or other installed applications.

Architecture rules:
- prefer official cloud APIs where they are suitable;
- use device execution when the phone is the correct/only provider;
- treat each account as an explicit Character/channel/social identity binding;
- do not scrape app-local state into canonical memory automatically;
- perception events must pass privacy/permission policy before promotion to memory;
- every consequential mobile action should produce evidence/receipt where practical.

## 10. Rooted Android distribution

Long term, this is more than a normal client app.

A production Agent Device package may include:
- Masanawa Agent Device app;
- persistent Device Node service;
- capability publisher;
- operation executor;
- encrypted local vault;
- OmniSIP telephony module;
- app automation service;
- media/screen service;
- offline queue;
- health/watchdog;
- boot startup;
- Magisk/root integration;
- device-specific profiles.

Root access is an execution capability, not an identity boundary.

## 11. Security model

Device power makes deterministic boundaries more important.

Required:
- explicit pairing;
- unique Device credential;
- tenant and Character assignment checks;
- signed/current-authority operations;
- least-privilege capability grants;
- credential isolation;
- short-lived command/session authority where possible;
- local encrypted storage;
- device revocation;
- replay protection;
- operation receipts;
- safe remote disable/unpair;
- no raw platform master secrets on devices.

## 12. Ops and fleet experience

Masanawa Ops should eventually show:
- device;
- assigned Character;
- online/offline/last seen;
- battery/charging;
- network;
- SIM identities;
- telephony readiness;
- microphone/camera/screen readiness;
- temperature/thermal state where available;
- active operation/call;
- queued operations;
- failed/reconciliation-needed operations;
- installed Agent Device version;
- capability set.

This turns phones into manageable agent infrastructure rather than opaque one-off devices.

## 13. Product journey

A target setup flow:

1. create or select Character;
2. choose "Assign Agent Phone";
3. install/provision Masanawa Agent Device runtime;
4. pair Device to tenant;
5. assign Device to Character;
6. detect SIM/phone identities;
7. connect permitted app/social accounts;
8. publish and approve capability grants;
9. run readiness tests;
10. mark device available as a Provider.

Then:
- the Character can receive a phone call on its real number;
- Masanawa resolves the call to the correct Character;
- relationship/memory context comes from canonical platform state;
- realtime/media execution may use OmniSIP + the selected AI voice pipeline;
- outbound calls are created as canonical Operations;
- results/receipts return to the platform.

## 14. Implementation order

Do not merge OmniSIP or build broad Android automation before the canonical runtime can consume device capabilities correctly.

Recommended order:

1. finish Skills, Agent runtime and Workflows;
2. define Device/DeviceCapability/CharacterDeviceAssignment contracts via ADR;
3. define secure pairing + capability publication protocol;
4. implement Device as a Provider behind existing Tool contracts;
5. implement DeviceOperation custody/receipt/reconciliation;
6. create minimal Android Device Node runtime;
7. integrate OmniSIP telephony as the first major device capability;
8. add SMS/USSD;
9. add media/perception and app automation;
10. add fleet/Ops;
11. test cross-cloud/device fallback and device replacement.

This keeps the phone idea central without bypassing the platform pieces required to make it reliable.

## 15. Acceptance scenarios

The Agent Phone architecture is credible when all of these work:

- replacing the phone does not replace the Character;
- a paired phone dynamically publishes only capabilities it can actually execute;
- an agent can make a permitted real cellular call through its assigned phone;
- an inbound call reaches the correct Character;
- call/SMS actions have canonical Operation IDs and receipts;
- temporary cloud loss does not duplicate a side effect;
- revoking a Device prevents new work;
- the platform can choose cloud or device Provider without changing the Skill;
- app/social identities stay bound to the Character without becoming canonical identity;
- Ops can explain what device performed what action and whether the result is known.
