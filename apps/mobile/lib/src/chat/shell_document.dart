/// Versioned presentation data. Never executable code or financial authority.
class ShellDocument {
  const ShellDocument({
    required this.id,
    required this.revision,
    required this.nodes,
    required this.fallback,
    this.expiresAt,
  });
  final String id;
  final int revision;
  final List<ShellNode> nodes;
  final String fallback;
  final DateTime? expiresAt;
  bool get expired => expiresAt != null && !DateTime.now().isBefore(expiresAt!);
  static const supportedVersion = 1;
  static const primitives = <String>{
    'text',
    'heading',
    'column',
    'options',
    'card',
    'input',
    'button',
    'divider',
    'metric',
    'detail',
    'progress',
    'notice',
  };
  static Map<String, dynamic> get capabilities => {
    'version': supportedVersion,
    'primitives': primitives.toList()..sort(),
    'maxNodes': 100,
    'maxDepth': 6,
    'maxTextCharacters': 24000,
  };
  bool get fullySupported => nodes.every((node) => node.fullySupported);

  factory ShellDocument.fromJson(Map<String, dynamic> json) {
    if (json['version'] != supportedVersion) {
      throw const FormatException('Unsupported shell document version');
    }
    String string(dynamic value, String field, int limit, {bool empty = true}) {
      if (value is! String ||
          value.length > limit ||
          (!empty && value.trim().isEmpty)) {
        throw FormatException('Invalid $field');
      }
      return value;
    }

    final id = string(json['id'], 'document id', 128, empty: false);
    final revision = json['revision'];
    final nodes = json['nodes'];
    if (revision is! int || revision < 0 || nodes is! List || nodes.isEmpty) {
      throw const FormatException('Invalid shell document');
    }
    final fallback = string(json['fallback'], 'fallback', 4000, empty: false);
    var remaining = 100;
    var textBudget = 24000 - fallback.length;
    final ids = <String>{};
    var hasActions = false;
    ShellNode parse(dynamic raw, int depth) {
      if (--remaining < 0 ||
          depth > 6 ||
          raw is! Map ||
          raw.keys.any((key) => key is! String)) {
        throw const FormatException('Invalid or excessive shell tree');
      }
      String? optional(String key, int limit) {
        if (raw[key] == null) return null;
        final value = string(raw[key], key, limit);
        textBudget -= value.length;
        if (textBudget < 0)
          throw const FormatException('Shell text limit exceeded');
        return value;
      }

      final type = string(raw['type'], 'node type', 64, empty: false);
      final nodeId = optional('id', 128);
      if (nodeId != null && (nodeId.trim().isEmpty || !ids.add(nodeId))) {
        throw const FormatException('Duplicate or empty node id');
      }
      final children = raw['children'];
      if (children != null && children is! List) {
        throw const FormatException('Invalid children');
      }
      final action = optional('action', 128);
      final token = optional('token', 2048);
      if (type == 'button') {
        hasActions = true;
        if (action == null ||
            action.isEmpty ||
            token == null ||
            token.isEmpty ||
            nodeId == null) {
          throw const FormatException('Button requires server action scope');
        }
      }
      if (type == 'input' && nodeId == null) {
        throw const FormatException('Input requires id');
      }
      final requiredValue = raw['required'];
      if (requiredValue != null && requiredValue is! bool) {
        throw const FormatException('Invalid required field');
      }
      final inputKind = optional('inputKind', 32) ?? 'text';
      if (!{'text', 'phone', 'email', 'number', 'search'}.contains(inputKind)) {
        throw const FormatException('Unsupported input kind');
      }
      final tone = optional('tone', 16) ?? 'info';
      if (!{'info', 'success', 'warning', 'error'}.contains(tone)) {
        throw const FormatException('Invalid semantic tone');
      }
      final progress = raw['progress'];
      if (progress != null &&
          (progress is! num ||
              !progress.isFinite ||
              progress < 0 ||
              progress > 1)) {
        throw const FormatException('Invalid progress');
      }
      final parsedChildren = List<ShellNode>.unmodifiable(
        children == null
            ? <ShellNode>[]
            : children.map((child) => parse(child, depth + 1)),
      );
      if (type == 'options' && parsedChildren.any((n) => n.type != 'button')) {
        throw const FormatException('Options may contain only buttons');
      }
      if (!{'card', 'column', 'options'}.contains(type) &&
          primitives.contains(type) &&
          parsedChildren.isNotEmpty) {
        throw const FormatException('Leaf node cannot hide children');
      }
      return ShellNode(
        type: type,
        id: nodeId,
        text: optional('text', 4000),
        value: optional('value', 512),
        subtitle: optional('subtitle', 1000),
        action: action,
        token: token,
        requiredValue: requiredValue == true,
        inputKind: inputKind,
        tone: tone,
        progress: (progress as num?)?.toDouble(),
        children: parsedChildren,
      );
    }

    final parsed = List<ShellNode>.unmodifiable(
      nodes.map((node) => parse(node, 0)),
    );
    final expiry = json['expiresAt'];
    DateTime? expiresAt;
    if (expiry != null) {
      final value = string(expiry, 'expiry', 64, empty: false);
      if (!RegExp(r'(Z|[+-]\d{2}:\d{2})$').hasMatch(value)) {
        throw const FormatException('Expiry requires timezone');
      }
      expiresAt = DateTime.tryParse(value);
      if (expiresAt == null) throw const FormatException('Invalid expiry');
    }
    if (hasActions && expiresAt == null) {
      throw const FormatException('Action document requires expiry');
    }
    return ShellDocument(
      id: id,
      revision: revision,
      nodes: parsed,
      fallback: fallback,
      expiresAt: expiresAt,
    );
  }

  Map<String, dynamic> toJson() => {
    'version': supportedVersion,
    'id': id,
    'revision': revision,
    'fallback': fallback,
    if (expiresAt != null) 'expiresAt': expiresAt!.toUtc().toIso8601String(),
    'nodes': nodes.map((node) => node.toJson()).toList(),
  };
}

class ShellNode {
  const ShellNode({
    required this.type,
    this.id,
    this.text,
    this.value,
    this.subtitle,
    this.action,
    this.token,
    this.requiredValue = false,
    this.inputKind = 'text',
    this.tone = 'info',
    this.progress,
    this.children = const [],
  });
  final String type;
  final String? id, text, value, subtitle, action, token;
  final bool requiredValue;
  final String inputKind, tone;
  final double? progress;
  final List<ShellNode> children;
  bool get fullySupported =>
      ShellDocument.primitives.contains(type) &&
      children.every((node) => node.fullySupported);
  Map<String, dynamic> toJson() => {
    'type': type,
    if (id != null) 'id': id,
    if (text != null) 'text': text,
    if (value != null) 'value': value,
    if (subtitle != null) 'subtitle': subtitle,
    if (action != null) 'action': action,
    if (token != null) 'token': token,
    if (requiredValue) 'required': true,
    if (inputKind != 'text') 'inputKind': inputKind,
    if (tone != 'info') 'tone': tone,
    if (progress != null) 'progress': progress,
    if (children.isNotEmpty)
      'children': children.map((n) => n.toJson()).toList(),
  };
}

class ShellAction {
  const ShellAction({
    required this.documentId,
    required this.revision,
    required this.nodeId,
    required this.actionId,
    required this.token,
    required this.values,
  });
  final String documentId, nodeId, actionId, token;
  final int revision;
  final Map<String, String> values;
}

typedef ShellActionHandler = Future<void> Function(ShellAction action);
