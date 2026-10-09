import 'package:flutter/material.dart';

import '../agents/clone_onboarding_transport.dart';
import '../agents/twin_profile_http_transport.dart';
import '../core/network/api_client.dart';
import '../state/clone_onboarding_controller.dart';
import 'twin_training_flow.dart';
import 'twin_training_screen.dart';

/// Fully wired owner-entry component. F12 embeds it under Agents -> My Twin.
/// The scope key MUST change for each authenticated account/session epoch.
/// It is never a bearer token and is not sent in the request body.
class TwinTrainingEntry extends StatefulWidget {
  const TwinTrainingEntry({
    super.key,
    required this.api,
    required this.accountScopeKey,
    this.onPrivateTest,
    this.onVoiceAnswer,
  });

  final ApiClient api;
  final String accountScopeKey;
  final Future<bool> Function(String characterId)? onPrivateTest;
  final Future<String?> Function()? onVoiceAnswer;

  @override
  State<TwinTrainingEntry> createState() => _TwinTrainingEntryState();
}

class _TwinTrainingEntryState extends State<TwinTrainingEntry> {
  late TwinTrainingFlow _flow;

  TwinTrainingFlow _newFlow() {
    // API_BASE_URL comes from the canonical configuration, not user input.
    // Reusing ApiClient.dio preserves current auth/refresh interceptors.
    return TwinTrainingFlow(
      onboarding: CloneOnboardingController(
        transport: HttpCloneOnboardingTransport(
          dio: widget.api.dio,
          baseUrl: widget.api.dio.options.baseUrl,
        ),
      ),
      profileTransport: GatewayTwinProfileTransport(api: widget.api),
    );
  }

  @override
  void initState() {
    super.initState();
    _flow = _newFlow();
  }

  @override
  void didUpdateWidget(covariant TwinTrainingEntry oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.accountScopeKey != widget.accountScopeKey ||
        !identical(oldWidget.api, widget.api) ||
        oldWidget.api.dio.options.baseUrl != widget.api.dio.options.baseUrl) {
      // Clear old user data before another user's first render.
      _flow.dispose();
      _flow = _newFlow();
    }
  }

  @override
  void dispose() {
    _flow.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => TwinTrainingScreen(
    key: ObjectKey(_flow),
    flow: _flow,
    onPrivateTest: widget.onPrivateTest,
    onVoiceAnswer: widget.onVoiceAnswer,
  );
}
