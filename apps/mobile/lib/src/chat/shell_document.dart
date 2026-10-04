/// Declarative UI only: documents cannot supply Dart, HTML, URLs or endpoints.
class ShellDocument {
  const ShellDocument({required this.id, required this.revision,
    required this.nodes, required this.fallback, this.expiresAt});
  final String id;
  final int revision;
  final List<ShellNode> nodes;
  final String fallback;
  final DateTime? expiresAt;
  bool get expired => expiresAt != null && !DateTime.now().isBefore(expiresAt!);
  static const supportedVersion = 1;

  factory ShellDocument.fromJson(Map<String, dynamic> json) {
    if (json['version'] != supportedVersion) {
      throw const FormatException('Unsupported shell document version');
    }
    final id = json['id'];
    final revision = json['revision'];
    final nodes = json['nodes'];
    if (id is! String || id.isEmpty || id.length > 128 ||
        revision is! int || revision < 0 || nodes is! List) {
      throw const FormatException('Invalid shell document');
    }
    var remaining = 100;
    final ids = <String>{};
    ShellNode parse(dynamic raw, int depth) {
      if (--remaining < 0 || depth > 6 || raw is! Map) {
        throw const FormatException('Shell document limit exceeded');
      }
      final node = Map<String, dynamic>.from(raw);
      final type = node['type'];
      if (type is! String) throw const FormatException('Missing node type');
      String? string(String key, {int limit = 4000}) {
        final value = node[key];
        if (value == null) return null;
        if (value is! String || value.length > limit) {
          throw FormatException('Invalid $key');
        }
        return value;
      }
      final nodeId = string('id', limit: 128);
      if (nodeId != null && (nodeId.isEmpty || !ids.add(nodeId))) {
        throw const FormatException('Duplicate or empty node id');
      }
      final children = node['children'];
      if (children != null && children is! List) {
        throw const FormatException('Invalid children');
      }
      final action = string('action', limit: 128);
      final token = string('token', limit: 2048);
      if (type == 'button' && (action == null || action.isEmpty ||
          token == null || token.isEmpty || nodeId == null)) {
        throw const FormatException('Button requires server action token');
      }
      if (type == 'input' && nodeId == null) {
        throw const FormatException('Input requires id');
      }
      return ShellNode(type: type, id: nodeId, text: string('text'),
        action: action, token: token, requiredValue: node['required'] == true,
        children: List.unmodifiable(children == null ? <ShellNode>[] :
          children.map((child) => parse(child, depth + 1))));
    }
    final expiry = json['expiresAt'];
    final expiresAt = expiry == null ? null :
      (expiry is String ? DateTime.tryParse(expiry) : null);
    if (expiry != null && expiresAt == null) {
      throw const FormatException('Invalid document expiry');
    }
    final fallback = json['fallback'];
    if (fallback is! String || fallback.isEmpty || fallback.length > 4000) {
      throw const FormatException('Accessible fallback required');
    }
    return ShellDocument(id: id, revision: revision,
      fallback: fallback, expiresAt: expiresAt,
      nodes: List.unmodifiable(nodes.map((node) => parse(node, 0))));
  }

  Map<String, dynamic> toJson() => {
    'version': supportedVersion, 'id': id, 'revision': revision,
    'fallback': fallback, if (expiresAt != null)
      'expiresAt': expiresAt!.toUtc().toIso8601String(),
    'nodes': nodes.map((node) => node.toJson()).toList(),
  };
}

class ShellNode {
  const ShellNode({required this.type, this.id, this.text, this.action,
    this.token, this.requiredValue = false, this.children = const []});
  final String type;
  final String? id, text, action, token;
  final bool requiredValue;
  final List<ShellNode> children;
  Map<String, dynamic> toJson() => {
    'type': type, if (id != null) 'id': id, if (text != null) 'text': text,
    if (action != null) 'action': action, if (token != null) 'token': token,
    if (requiredValue) 'required': true,
    if (children.isNotEmpty) 'children': children.map((n) => n.toJson()).toList(),
  };
}

/// The consumer must bind this callback to an authenticated server dispatcher.
/// Never convert a financial action into a generated natural-language turn.
class ShellAction {
  const ShellAction({required this.documentId, required this.revision,
    required this.actionId, required this.token, required this.values});
  final String documentId, actionId, token;
  final int revision;
  final Map<String, String> values;
}
typedef ShellActionHandler = Future<void> Function(ShellAction action);
