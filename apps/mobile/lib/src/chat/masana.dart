import 'package:flutter/material.dart';

/// A Masana — one AI agent in the Masanawa family. The Masana list screen
/// renders these WhatsApp-contacts-style; each one owns exactly one chat
/// thread (like one conversation per contact).
class MasanaAgent {
  const MasanaAgent({
    required this.id,
    required this.name,
    required this.about,
    required this.colorValue,
    required this.greeting,
  });

  final String id;
  final String name;

  /// One-line specialty shown under the name, like a WhatsApp about line.
  final String about;
  final int colorValue;
  final String greeting;

  Color get color => Color(colorValue);
  String get initial => name.isEmpty ? 'M' : name[0].toUpperCase();
}

/// Avatar colors are token roles only (no ad-hoc hex):
/// brandPrimary → Masanawa, verified → Labari, brandStrong → Hakuri,
/// warning → Kasuwanci, success → Lafiya. Values match `UnigeriaTokens.light`.
const List<MasanaAgent> kMasanaAgents = [
  MasanaAgent(
    id: 'masanawa',
    name: 'Masanawa',
    about: 'Your everyday Nigerian helper',
    colorValue: 0xFF047857,
    greeting: 'Hello! I am Masanawa, your everyday Nigerian helper. '
        'Ask me anything — news, gist, or everyday questions.',
  ),
  MasanaAgent(
    id: 'labari',
    name: 'Labari',
    about: 'Nigerian news, explained simply',
    colorValue: 0xFF1D4ED8,
    greeting: 'Hello! I am Labari. Ask me what is happening in Nigeria '
        'and I will break it down simply.',
  ),
  MasanaAgent(
    id: 'hakuri',
    name: 'Hakuri',
    about: 'Know your rights, step by step',
    colorValue: 0xFF065F46,
    greeting: 'Hello! I am Hakuri. Ask me about your rights — police stops, '
        'work issues, rent — and I will guide you step by step.',
  ),
  MasanaAgent(
    id: 'kasuwanci',
    name: 'Kasuwanci',
    about: 'Business, CAC and hustle help',
    colorValue: 0xFFD97706,
    greeting: 'Hello! I am Kasuwanci. Ask me about starting or growing a '
        'business — registration, money, customers.',
  ),
  MasanaAgent(
    id: 'lafiya',
    name: 'Lafiya',
    about: 'Everyday health guidance',
    colorValue: 0xFF16A34A,
    greeting: 'Hello! I am Lafiya. Ask me everyday health questions and I '
        'will share safe, simple guidance.',
  ),
];

MasanaAgent masanaById(String id) => kMasanaAgents.firstWhere(
      (a) => a.id == id,
      orElse: () => kMasanaAgents.first,
    );

/// WhatsApp-style list time: today → `2:14 PM`, yesterday → `Yesterday`,
/// older → `12/5/26`.
String formatChatTime(DateTime t) {
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final day = DateTime(t.year, t.month, t.day);
  final diff = today.difference(day).inDays;
  if (diff <= 0) return formatClock(t);
  if (diff == 1) return 'Yesterday';
  return '${t.day}/${t.month}/${t.year % 100}';
}

String formatClock(DateTime t) {
  final h = t.hour % 12 == 0 ? 12 : t.hour % 12;
  final mm = t.minute.toString().padLeft(2, '0');
  return '$h:$mm ${t.hour >= 12 ? 'PM' : 'AM'}';
}

String formatDurationMs(int ms) {
  final total = (ms / 1000).round();
  return '${total ~/ 60}:${(total % 60).toString().padLeft(2, '0')}';
}

String formatBytes(int bytes) {
  if (bytes < 1024) return '$bytes B';
  if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
  return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
}
