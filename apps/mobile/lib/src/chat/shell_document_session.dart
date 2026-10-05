import 'dart:async';
import 'dart:convert';

import 'shell_document.dart';

/// These are authoritative presentation states, never inferred from narration
/// or a successful network submission. Only fulfillment evidence sets fulfilled.
enum ShellDocumentPhase {
  choosing,
  submitted,
  processing,
  fulfilled,
  failed,
  cancelled,
}

class ShellDocumentUpdate {
  const ShellDocumentUpdate({
    required this.scope,
    required this.document,
    required this.phase,
    this.expectedRevision,
  });
  final String scope;
  final ShellDocument document;
  final ShellDocumentPhase phase;
  final int? expectedRevision;
}

class ShellDocumentConflict implements Exception {
  const ShellDocumentConflict();
}

class ShellChoiceUnavailable implements Exception {
  const ShellChoiceUnavailable();
}

/// Host binds one instance to the authenticated user/CharacterSession. Updates
/// enter only from the authorized server result/event receiver, not model text.
/// Full replacements avoid partial patches hiding controls or corrupting forms.
class ShellDocumentSession {
  ShellDocumentSession(this.scope) {
    if (scope.trim().isEmpty) throw ArgumentError('Session scope required');
  }
  final String scope;
  final _updates = <String, ShellDocumentUpdate>{};
  final _changes = StreamController<void>.broadcast(sync: true);
  bool _closed = false;
  Stream<void> get changes => _changes.stream;
  List<ShellDocumentUpdate> get snapshots => List.unmodifiable(_updates.values);
  ShellDocumentUpdate? read(String documentId) => _updates[documentId];

  bool apply(ShellDocumentUpdate update) {
    if (_closed) throw StateError('Session closed');
    if (update.scope != scope) throw const ShellDocumentConflict();
    // Validate even programmatically constructed documents; store an immutable
    // parsed snapshot so the caller cannot mutate accepted server presentation.
    final document = ShellDocument.fromJson(update.document.toJson());
    final previous = _updates[document.id];
    if (previous != null) {
      if (document.revision < previous.document.revision) return false;
      if (document.revision == previous.document.revision) {
        if (update.phase != previous.phase ||
            jsonEncode(document.toJson()) !=
                jsonEncode(previous.document.toJson())) {
          throw const ShellDocumentConflict();
        }
        return false;
      }
      if (update.expectedRevision != previous.document.revision) {
        throw const ShellDocumentConflict();
      }
      final terminal = {
        ShellDocumentPhase.fulfilled,
        ShellDocumentPhase.failed,
        ShellDocumentPhase.cancelled,
      };
      if (terminal.contains(previous.phase))
        throw const ShellDocumentConflict();
      if (previous.phase == ShellDocumentPhase.processing &&
          update.phase == ShellDocumentPhase.submitted) {
        throw const ShellDocumentConflict();
      }
      if (previous.phase != ShellDocumentPhase.choosing &&
          update.phase == ShellDocumentPhase.choosing) {
        // A fresh selection requires a fresh document ID, never reopening an
        // already dispatched intent by changing its buttons in place.
        throw const ShellDocumentConflict();
      }
    } else if (update.expectedRevision != null) {
      throw const ShellDocumentConflict();
    }
    _updates[document.id] = ShellDocumentUpdate(
      scope: scope,
      document: document,
      phase: update.phase,
      expectedRevision: update.expectedRevision,
    );
    _changes.add(null);
    return true;
  }

  List<ShellNode> _choices(ShellDocument document) {
    final result = <ShellNode>[];
    void visit(ShellNode node) {
      if (node.type == 'button') result.add(node);
      for (final child in node.children) {
        visit(child);
      }
    }

    for (final node in document.nodes) {
      visit(node);
    }
    return result;
  }

  /// Resolves an explicit visible ordinal or exact label. The speech provider
  /// may supply this selector; this module performs no recording/transcription
  /// and no fuzzy matching of financial actions. Ambiguity always fails closed.
  ShellAction select({
    required String documentId,
    required int revision,
    int? ordinal,
    String? label,
    Map<String, String> values = const {},
  }) {
    final update = _updates[documentId];
    if (update == null ||
        update.document.revision != revision ||
        update.phase != ShellDocumentPhase.choosing ||
        update.document.expired ||
        !update.document.fullySupported ||
        (ordinal == null) == (label == null)) {
      throw const ShellChoiceUnavailable();
    }
    final choices = _choices(update.document);
    ShellNode choice;
    if (ordinal != null) {
      if (ordinal < 1 || ordinal > choices.length)
        throw const ShellChoiceUnavailable();
      choice = choices[ordinal - 1];
    } else {
      final matches = choices
          .where(
            (n) =>
                (n.text ?? 'Choose').trim().toLowerCase() ==
                label!.trim().toLowerCase(),
          )
          .toList();
      if (matches.length != 1) throw const ShellChoiceUnavailable();
      choice = matches.single;
    }
    final inputs = <String, ShellNode>{};
    void collect(ShellNode node) {
      if (node.type == 'input') inputs[node.id!] = node;
      for (final child in node.children) {
        collect(child);
      }
    }

    for (final node in update.document.nodes) {
      collect(node);
    }
    if (values.entries.any(
          (entry) => !inputs.containsKey(entry.key) || entry.value.length > 512,
        ) ||
        inputs.entries.any(
          (entry) =>
              entry.value.requiredValue &&
              (values[entry.key]?.trim().isEmpty ?? true),
        )) {
      throw const ShellChoiceUnavailable();
    }
    return ShellAction(
      documentId: documentId,
      revision: revision,
      nodeId: choice.id!,
      actionId: choice.action!,
      token: choice.token!,
      values: Map.unmodifiable(values),
    );
  }

  void clear() {
    if (_closed) return;
    _updates.clear();
    _changes.add(null);
  }

  Future<void> close() async {
    if (_closed) return;
    _closed = true;
    _updates.clear();
    await _changes.close();
  }
}
