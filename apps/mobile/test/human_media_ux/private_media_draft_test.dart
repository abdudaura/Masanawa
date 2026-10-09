import 'dart:async';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/human_media_ux/private_media_draft.dart';

class _Picker implements PrivateMediaPicker {
  _Picker(this.pickNext);
  Future<File?> Function() pickNext;
  int calls = 0;
  @override
  Future<File?> pick() {
    calls++;
    return pickNext();
  }
}

class _Upload implements PrivateMediaUploadPort {
  _Upload(this.send);
  final Future<PrivateMediaReceipt> Function(
    String requestId, void Function(int, int) onProgress,
  ) send;
  final List<String> requests = [];
  @override
  Future<PrivateMediaReceipt> upload({
    required PrivateMediaDraft draft,
    required String accountId,
    required String conversationId,
    required String requestId,
    required void Function(int, int) onProgress,
  }) {
    requests.add(requestId);
    return send(requestId, onProgress);
  }
}

void main() {
  late Directory temp;
  late File png;
  setUp(() async {
    temp = await Directory.systemTemp.createTemp('u12-media-');
    png = File(temp.path + '/sample.png');
    await png.writeAsBytes(const [137, 80, 78, 71, 13, 10, 26, 10, 1]);
  });
  tearDown(() async {
    if (await temp.exists()) await temp.delete(recursive: true);
  });

  test('sniffs exact PNG magic, type and bounded metadata', () async {
    final result = await inspectPrivateMediaFile(png);
    expect(result.kind, PrivateMediaKind.png);
    expect(result.sizeBytes, 9);
    expect(result.name, 'sample.png');
    expect(result.kind.mime, 'image/png');
  });

  test('rejects spoofed file name and unsupported binary without uploading',
      () async {
    final spoofed = File(temp.path + '/spoof.pdf');
    await spoofed.writeAsBytes(await png.readAsBytes());
    expect(
      () => inspectPrivateMediaFile(spoofed),
      throwsA(isA<PrivateMediaValidationException>()),
    );
    final executable = File(temp.path + '/bad.exe');
    await executable.writeAsBytes(await png.readAsBytes());
    expect(
      () => inspectPrivateMediaFile(executable),
      throwsA(isA<PrivateMediaValidationException>()),
    );
  });

  test('rejects empty, oversize and corrupt headers', () async {
    final empty = File(temp.path + '/empty.png');
    await empty.writeAsBytes([]);
    expect(
      () => inspectPrivateMediaFile(empty),
      throwsA(isA<PrivateMediaValidationException>()),
    );
    // Strict >8 MB check before magic read, not a full-file allocation.
    await png.writeAsBytes(List<int>.filled(8 * 1024 * 1024 + 1, 0));
    expect(
      () => inspectPrivateMediaFile(png),
      throwsA(isA<PrivateMediaValidationException>()),
    );
  });

  test('review works locally, no uploader means no send path', () async {
    final controller = PrivateMediaReviewController(
      accountId: 'A',
      conversationId: 'human-chat-1',
      picker: _Picker(() async => png),
      isAuthorized: () async => true,
    );
    await controller.choose();
    expect(controller.phase, PrivateMediaPhase.review);
    expect(controller.canSend, isFalse);
    expect(controller.requestId, isNotNull);
    await controller.send();
    expect(controller.receipt, isNull);
    controller.dispose();
  });

  test('denied membership never launches picker', () async {
    final picker = _Picker(() async => png);
    final controller = PrivateMediaReviewController(
      accountId: 'A',
      conversationId: 'B',
      picker: picker,
      isAuthorized: () async => false,
    );
    await controller.choose();
    expect(picker.calls, 0);
    expect(controller.draft, isNull);
    controller.dispose();
  });

  test('late picker result is ignored after sign-out or thread switch',
      () async {
    final delayed = Completer<File?>();
    final controller = PrivateMediaReviewController(
      accountId: 'A',
      conversationId: 'chat-A',
      picker: _Picker(() => delayed.future),
      isAuthorized: () async => true,
    );
    final selecting = controller.choose();
    await Future<void>.delayed(Duration.zero);
    controller.revoke();
    delayed.complete(png);
    await selecting;
    expect(controller.phase, PrivateMediaPhase.empty);
    expect(controller.requestId, isNull);
    expect(controller.draft, isNull);
    controller.dispose();
  });

  test('a modified selected file never reaches the upload transport',
      () async {
    final transport = _Upload((id, progress) async => PrivateMediaReceipt(
      messageId: 'should-not-exist',
      accountId: 'A',
      conversationId: 'C',
      requestId: id,
    ));
    final controller = PrivateMediaReviewController(
      accountId: 'A',
      conversationId: 'C',
      picker: _Picker(() async => png),
      isAuthorized: () async => true,
      uploadPort: transport,
    );
    await controller.choose();
    await png.writeAsBytes(const [
      137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3,
    ]);
    await controller.send();
    expect(transport.requests, isEmpty);
    expect(controller.phase, PrivateMediaPhase.review);
    expect(controller.message, contains('changed'));
    controller.dispose();
  });

  test('uncertain send retries exactly the original request ID', () async {
    var attempts = 0;
    final transport = _Upload((id, progress) async {
      attempts++;
      if (attempts == 1) {
        progress(2, 3);
        progress(9, 3); // impossible progress must be ignored
        throw const SocketException('lost response');
      }
      progress(3, 3);
      return PrivateMediaReceipt(
        messageId: 'real-server-message-1',
        accountId: 'A',
        conversationId: 'C',
        requestId: id,
      );
    });
    final controller = PrivateMediaReviewController(
      accountId: 'A',
      conversationId: 'C',
      picker: _Picker(() async => png),
      isAuthorized: () async => true,
      uploadPort: transport,
    );
    await controller.choose();
    final original = controller.requestId;
    await controller.send();
    expect(controller.phase, PrivateMediaPhase.uncertain);
    expect(controller.canRetry, isTrue);
    expect(controller.progress, isNull);
    await controller.send();
    expect(transport.requests, [original, original]);
    expect(controller.phase, PrivateMediaPhase.sent);
    expect(controller.receipt?.messageId, 'real-server-message-1');
    controller.dispose();
  });

  test('wrong account or conversation response is never shown as sent',
      () async {
    final transport = _Upload((id, progress) async => PrivateMediaReceipt(
      messageId: 'forged',
      accountId: 'other-user',
      conversationId: 'C',
      requestId: id,
    ));
    final controller = PrivateMediaReviewController(
      accountId: 'A',
      conversationId: 'C',
      picker: _Picker(() async => png),
      isAuthorized: () async => true,
      uploadPort: transport,
    );
    await controller.choose();
    await controller.send();
    expect(controller.phase, PrivateMediaPhase.uncertain);
    expect(controller.receipt, isNull);
    controller.dispose();
  });

  test('late successful response cannot resurrect revoked account data',
      () async {
    final delayed = Completer<PrivateMediaReceipt>();
    final transport = _Upload((id, progress) => delayed.future);
    final controller = PrivateMediaReviewController(
      accountId: 'A',
      conversationId: 'C',
      picker: _Picker(() async => png),
      isAuthorized: () async => true,
      uploadPort: transport,
    );
    await controller.choose();
    final send = controller.send();
    await Future<void>.delayed(Duration.zero);
    final id = controller.requestId!;
    controller.revoke();
    delayed.complete(PrivateMediaReceipt(
      messageId: 'm1',
      accountId: 'A',
      conversationId: 'C',
      requestId: id,
    ));
    await send;
    expect(controller.phase, PrivateMediaPhase.empty);
    expect(controller.draft, isNull);
    expect(controller.receipt, isNull);
    controller.dispose();
  });

  test('membership revoked during upload suppresses success', () async {
    var checks = 0;
    final transport = _Upload((id, progress) async => PrivateMediaReceipt(
      messageId: 'm1',
      accountId: 'A',
      conversationId: 'C',
      requestId: id,
    ));
    final controller = PrivateMediaReviewController(
      accountId: 'A',
      conversationId: 'C',
      picker: _Picker(() async => png),
      // Two selection checks and pre-send are allowed; readback denied.
      isAuthorized: () async => ++checks <= 3,
      uploadPort: transport,
    );
    await controller.choose();
    await controller.send();
    expect(transport.requests, hasLength(1));
    expect(checks, 4);
    expect(controller.receipt, isNull);
    expect(controller.phase, PrivateMediaPhase.empty);
    controller.dispose();
  });
}
