import '../agents/twin_profile.dart';

class TwinTeachingCommand {
  const TwinTeachingCommand({
    required this.patch,
    required this.summary,
  });

  final TwinProfileCustomizationPatch patch;
  final String summary;
}

List<String> _list(String value) {
  return value
      .replaceAll(RegExp(r'\band\b', caseSensitive: false), ',')
      .split(',')
      .map((item) => item.trim())
      .where((item) => item.isNotEmpty)
      .toSet()
      .take(20)
      .toList(growable: false);
}

TwinTeachingCommand? interpretTwinTeaching(String raw) {
  final text = raw.trim();
  if (text.isEmpty) return null;
  final lower = text.toLowerCase();

  if ({
    'make my twin public',
    'publish my twin',
    'make my twin discoverable',
    'show my twin in explore',
  }.contains(lower)) {
    return const TwinTeachingCommand(
      patch: TwinProfileCustomizationPatch(discoverable: true),
      summary: 'Make your Twin public in Explore',
    );
  }
  if ({
    'make my twin private',
    'hide my twin',
    'remove my twin from explore',
    'make my twin undiscoverable',
  }.contains(lower)) {
    return const TwinTeachingCommand(
      patch: TwinProfileCustomizationPatch(discoverable: false),
      summary: 'Hide your Twin from Explore',
    );
  }

  final patterns = <({RegExp pattern, String kind})>[
    (
      pattern: RegExp(
        r'^(?:my name is|call me|my twin should call me)\s+(.+)$',
        caseSensitive: false,
      ),
      kind: 'name',
    ),
    (
      pattern: RegExp(
        r'^(?:my bio is|my twin bio is|about me\s*:)\s*(.+)$',
        caseSensitive: false,
      ),
      kind: 'bio',
    ),
    (
      pattern: RegExp(
        r"^(?:i am interested in|i'm interested in|my interests are)\s+(.+)$",
        caseSensitive: false,
      ),
      kind: 'interests',
    ),
  ];

  for (final item in patterns) {
    final match = item.pattern.firstMatch(text);
    if (match == null) continue;
    final value = match.group(1)?.trim() ?? '';
    if (value.isEmpty) return null;
    switch (item.kind) {
      case 'name':
        return TwinTeachingCommand(
          patch: TwinProfileCustomizationPatch(displayName: value),
          summary: 'Use “' + value + '” as your Twin display name',
        );
      case 'bio':
        return TwinTeachingCommand(
          patch: TwinProfileCustomizationPatch(bio: value),
          summary: 'Update your public Twin bio',
        );
      case 'interests':
        final values = _list(value);
        if (values.isEmpty) return null;
        return TwinTeachingCommand(
          patch: TwinProfileCustomizationPatch(interests: values),
          summary: 'Update your Twin interests',
        );
    }
  }
  return null;
}