import 'dart:async';
import 'dart:io';
import 'dart:math';

import 'package:flutter/foundation.dart';

/// Review-only attachment types. C04 currently supports audio/ogg only; the
/// integration owner must supply a separately authorized image/document port.
enum PrivateMediaKind { jpeg, png, pdf }

extension PrivateMediaKindDetails on PrivateMediaKind {
  String get mime => switch (this) {
    PrivateMediaKind.jpeg => 'image/jpeg',
    PrivateMediaKind.png => 'image/png',
    PrivateMediaKind.pdf => 'application/pdf',
  };

  bool get isImage => this != PrivateMediaKind.pdf;
}

class PrivateMediaDraft {
  const PrivateMediaDraft({
    required this.file,
    required this.name,
    required this.sizeBytes,
    required this.kind,
  });

  final File file;
  final String name;
  final int sizeBytes;
  final PrivateMediaKind kind;
}

/// A receipt is not authoritative without verifying the exact scoped identity
/// and idempotency key used for this attempt.
class PrivateMediaReceipt {
  const PrivateMediaReceipt({
    required this.messageId,
    required this.accountId,
    required this.conversationId,
    required this.requestId,
  });

  final String messageId, accountId, conversationId, requestId;
}

abstract interface class PrivateMediaUploadPort {
  /// MUST revalidate current C01/C02 membership/block state on the server,
  /// use bearer auth, private object storage, idempotency, and readback.
  /// The current C04 audio-only service is NOT a compatible implementation.
  Future<PrivateMediaReceipt> upload({
    required PrivateMediaDraft draft,
    required String accountId,
    required String conversationId,
    required String requestId,
    required void Function(int sentBytes, int totalBytes) onProgress,
  });
}

abstract interface class PrivateMediaPicker {
  Future<File?> pick();
}

class PrivateMediaValidationException implements Exception {
  const PrivateMediaValidationException(this.message);
  final String message;
  @override
  String toString() => message;
}

/// Only inspect the first 8 bytes: never read a user's entire photo/document
/// into memory, and never trust a picker-provided MIME label.
Future<PrivateMediaDraft> inspectPrivateMediaFile(
  File file, {
  int maximumBytes = 8 * 1024 * 1024,
}) async {
  final info = await file.stat();
  if (info.type != FileSystemEntityType.file ||
      info.size < 8 ||
      info.size > maximumBytes) {
    throw const PrivateMediaValidationException(
      'Choose a file no larger than 8 MB.',
    );
  }
  final original = file.uri.pathSegments.last;
  final extension = original.split('.').last.toLowerCase();
  if (!{'jpg', 'jpeg', 'png', 'pdf'}.contains(extension)) {
    throw const PrivateMediaValidationException(
      'Only JPEG, PNG and PDF previews are supported.',
    );
  }
  final reader = await file.open();
  late final List<int> header;
  try {
    header = await reader.read(8);
  } finally {
    await reader.close();
  }
  final isJpeg = header.length >= 3 &&
      header[0] == 0xff && header[1] == 0xd8 && header[2] == 0xff;
  final isPng = header.length == 8 &&
      listEquals(header, const [137, 80, 78, 71, 13, 10, 26, 10]);
  final isPdf = header.length >= 5 &&
      listEquals(header.sublist(0, 5), const [37, 80, 68, 70, 45]);

  final kind = isJpeg && (extension == 'jpg' || extension == 'jpeg')
      ? PrivateMediaKind.jpeg
      : isPng && extension == 'png'
          ? PrivateMediaKind.png
          : isPdf && extension == 'pdf'
              ? PrivateMediaKind.pdf
              : null;
  if (kind == null) {
    throw const PrivateMediaValidationException(
      'File format does not match its contents.',
    );
  }
  // Never expose the full local path in a widget, diagnostic or error.
  final safeName = original.replaceAll(RegExp(r'[\x00-\x1f\x7f]'), '');
  if (safeName.isEmpty || safeName.length > 180) {
    throw const PrivateMediaValidationException('Invalid attachment name.');
  }
  return PrivateMediaDraft(
    file: file,
    name: safeName,
    sizeBytes: info.size,
    kind: kind,
  );
}

enum PrivateMediaPhase {
  empty,
  inspecting,
  review,
  uploading,
  uncertain,
  sent,
}

/// A single account/conversation-scoped selection. No app startup camera or
/// microphone access. A callback is intentionally required for backend writes:
/// unsupported media must NEVER fall back to an unprotected public upload.
class PrivateMediaReviewController extends ChangeNotifier {
  PrivateMediaReviewController({
    required this.accountId,
    required this.conversationId,
    required this.picker,
    required this.isAuthorized,
    this.uploadPort,
  });

  final String accountId, conversationId;
  final PrivateMediaPicker picker;
  final Future<bool> Function() isAuthorized;
  final PrivateMediaUploadPort? uploadPort;

  PrivateMediaPhase phase = PrivateMediaPhase.empty;
  PrivateMediaDraft? draft;
  PrivateMediaReceipt? receipt;
  String? message;
  String? requestId;
  double? progress;

  int _generation = 0;
  bool _disposed = false;
  bool get canSend => phase == PrivateMediaPhase.review && uploadPort != null;
  bool get canRetry => phase == PrivateMediaPhase.uncertain && uploadPort != null;

  bool _current(int generation) =>
      !_disposed && generation == _generation;

  void _emit() {
    if (!_disposed) notifyListeners();
  }

  String _newRequestId() {
    final random = Random.secure();
    const alphabet =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
    return List.generate(
      32, (_) => alphabet[random.nextInt(alphabet.length)],
    ).join();
  }

  /// Cancel and invalidate all callbacks from pending picker/authorization or
  /// upload attempts. A late server write remains UNKNOWN, never "sent".
  void clear() {
    _generation++;
    draft = null;
    receipt = null;
    requestId = null;
    progress = null;
    message = null;
    phase = PrivateMediaPhase.empty;
    _emit();
  }

  /// The owner widget MUST call this before switching account/thread and on
  /// sign-out. This controller can no longer display A's file for B.
  void revoke() => clear();

  Future<void> choose() async {
    if (_disposed || phase == PrivateMediaPhase.inspecting ||
        phase == PrivateMediaPhase.uploading) return;
    clear();
    final generation = _generation;
    phase = PrivateMediaPhase.inspecting;
    _emit();
    try {
      if (!await isAuthorized() || !_current(generation)) {
        if (_current(generation)) clear();
        return;
      }
      final file = await picker.pick();
      if (!_current(generation)) return;
      if (file == null) {
        clear();
        return;
      }
      final validated = await inspectPrivateMediaFile(file);
      if (!_current(generation)) return;
      if (!await isAuthorized() || !_current(generation)) {
        if (_current(generation)) clear();
        return;
      }
      draft = validated;
      requestId = _newRequestId();
      phase = PrivateMediaPhase.review;
      _emit();
    } on PrivateMediaValidationException catch (error) {
      if (_current(generation)) {
        clear();
        message = error.message;
        _emit();
      }
    } catch (_) {
      if (_current(generation)) {
        clear();
        message = 'Cannot open this file. Try another attachment.';
        _emit();
      }
    }
  }

  Future<void> send() async {
    if (_disposed || uploadPort == null ||
        draft == null || requestId == null ||
        !(phase == PrivateMediaPhase.review ||
          phase == PrivateMediaPhase.uncertain)) return;

    final generation = _generation;
    final media = draft!;
    final id = requestId!;
    try {
      if (!await isAuthorized() || !_current(generation)) {
        if (_current(generation)) clear();
        return;
      }
      phase = PrivateMediaPhase.uploading;
      progress = 0;
      message = null;
      _emit();
      final result = await uploadPort!.upload(
        draft: media,
        accountId: accountId,
        conversationId: conversationId,
        requestId: id,
        onProgress: (sent, total) {
          if (!_current(generation) ||
              phase != PrivateMediaPhase.uploading ||
              total <= 0 || sent < 0 || sent > total) return;
          progress = sent / total;
          _emit();
        },
      );
      if (!_current(generation)) return;
      if (result.accountId != accountId ||
          result.conversationId != conversationId ||
          result.requestId != id || result.messageId.isEmpty) {
        // A forged/wrong-user result is not a confirmed send.
        phase = PrivateMediaPhase.uncertain;
        progress = null;
        message = 'Delivery unverified. Check this conversation before retrying.';
        _emit();
        return;
      }
      // Membership may be revoked while a network request was in flight.
      // The client must not render a "sent" receipt for a revoked thread.
      if (!await isAuthorized() || !_current(generation)) {
        if (_current(generation)) clear();
        return;
      }
      receipt = result;
      phase = PrivateMediaPhase.sent;
      progress = 1;
      _emit();
    } catch (_) {
      if (!_current(generation)) return;
      // A timeout might have committed on the server. Keep EXACT request ID
      // for safe idempotent reconciliation; never generate a new one.
      phase = PrivateMediaPhase.uncertain;
      progress = null;
      message = 'Delivery unverified. Retry using the same request.';
      _emit();
    }
  }

  @override
  void dispose() {
    _generation++;
    _disposed = true;
    draft = null;
    receipt = null;
    super.dispose();
  }
}
