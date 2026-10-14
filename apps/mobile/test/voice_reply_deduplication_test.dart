import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/agents/agent_shell.dart';
import 'package:masanawa/src/agents/agent_session.dart';
import 'package:masanawa/src/core/providers.dart';
import 'package:masanawa/src/state/ai_chat_state.dart';
import 'package:masanawa/src/state/session_state.dart';

import 'agent_recovery_test.dart' show RecoveringTransport;

class _Session extends SessionController {
  @override
  SessionState build() => const SessionSignedOut();
}

class _Transport extends RecoveringTransport implements AgentShellTransport {
  final response = Completer<AgentTurnResult>();
  final entered = Completer<void>();
  String? request;
  @override
  Future<AgentTurnResult> sendMediaTurn({required AgentSessionBinding binding,
    required Uint8List bytes, required String mimeType, required String caption,
    void Function(int, int)? onUploadProgress, String? requestId}) {
    request = requestId;
    onUploadProgress?.call(bytes.length, bytes.length);
    entered.complete();
    return response.future;
  }
  @override
  Future<AgentShellConfig> loadShellConfig(String characterId) async =>
    const AgentShellConfig(shellVersion:1,minimumAppVersion:'0.0.0',recommendedAppVersion:'0.0.0',features:{});
  @override
  Future<List<AgentHistoryMessage>> loadHistory(String characterId,{int limit=100,String? before}) async => [];
  @override
  Future<AgentTurnStatus> turnStatus(String characterId,String requestId) async =>
    const AgentTurnStatus(state:'completed',reply:'One reply',agentRunId:'run-one');
  @override
  Stream<AgentShellEvent> events(String characterId,{String? after}) => const Stream.empty();
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test('completed event racing with audio response keeps one reply', () async {
    // The widget test process has no native path_provider plugin. Provide a
    // real writable temporary folder for the reply WAV attachment.
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
      .setMockMethodCallHandler(
        const MethodChannel('plugins.flutter.io/path_provider'),
        (_) async => Directory.systemTemp.path,
      );
    final file=File('${Directory.systemTemp.path}/masanawa_dedupe_${DateTime.now().microsecondsSinceEpoch}.m4a');
    await file.writeAsBytes([1,2,3]);
    addTearDown(()=>file.delete());
    final transport=_Transport();
    final container=ProviderContainer(overrides:[agentTransportProvider.overrideWithValue(transport),sessionProvider.overrideWith(_Session.new)]);
    addTearDown(container.dispose);
    final controller=container.read(aiChatProvider.notifier);
    final send=controller.sendAttachment('character-1',ChatAttachment(kind:'voice',path:file.path));
    await transport.entered.future;
    // Completion can reach the event/status path while the HTTP response is
    // still waiting for its audio rendering.
    await controller.syncFromServer('character-1');
    expect(controller.threadOf('character-1').messages.where((m)=>!m.isUser),hasLength(1));
    // A valid voice input is only successful with a playable voice response.
    // Keep the mocked audio on the same request ID as the completion event.
    transport.response.complete(AgentTurnResult(
      text: 'One reply',
      agentRunId: 'run-one',
      audioBytes: Uint8List(960),
      audioMimeType: 'audio/l16',
      audioDurationMs: 20,
    ));
    await send;
    final replies=controller.threadOf('character-1').messages.where((m)=>!m.isUser).toList();
    expect(replies,hasLength(1));
    expect(replies.single.requestId,transport.request);
    expect(replies.single.text,'One reply');
    expect(replies.single.attachment?.kind,'voice');
  });
}
