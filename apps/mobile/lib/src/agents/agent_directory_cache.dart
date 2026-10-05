import 'dart:convert';
import 'dart:io';

import 'package:path_provider/path_provider.dart';

import 'agent_directory.dart';

abstract class AgentDirectoryCache {
  Future<List<AgentDirectoryEntry>?> read(String ownerId);
  Future<void> write(String ownerId, List<AgentDirectoryEntry> agents);
  Future<void> clear();
}

class FileAgentDirectoryCache implements AgentDirectoryCache {
  const FileAgentDirectoryCache();

  static const _fileName = 'masanawa_agent_directory_v1.json';

  Future<File> _file() async {
    final directory = await getApplicationSupportDirectory();
    return File('\${directory.path}\${Platform.pathSeparator}\$_fileName');
  }

  @override
  Future<List<AgentDirectoryEntry>?> read(String ownerId) async {
    if (ownerId.isEmpty) return null;
    try {
      final file = await _file();
      if (!await file.exists()) return null;
      final raw = jsonDecode(await file.readAsString());
      if (raw is! Map<String, dynamic> || raw['ownerId'] != ownerId) {
        return null;
      }
      final values = raw['agents'];
      if (values is! List) return null;
      final agents = <AgentDirectoryEntry>[];
      for (final value in values) {
        if (value is! Map) return null;
        agents.add(
          AgentDirectoryEntry.fromJson(value.cast<String, dynamic>()),
        );
      }
      return List.unmodifiable(agents);
    } catch (_) {
      return null;
    }
  }

  @override
  Future<void> write(String ownerId, List<AgentDirectoryEntry> agents) async {
    if (ownerId.isEmpty) return;
    try {
      final file = await _file();
      final temp = File('\${file.path}.tmp');
      await temp.writeAsString(
        jsonEncode({
          'ownerId': ownerId,
          'agents': [for (final agent in agents) agent.toJson()],
        }),
        flush: true,
      );
      if (await file.exists()) await file.delete();
      await temp.rename(file.path);
    } catch (_) {
      // Cache is an optimization only; live directory remains canonical.
    }
  }

  @override
  Future<void> clear() async {
    try {
      final file = await _file();
      if (await file.exists()) await file.delete();
      final temp = File('\${file.path}.tmp');
      if (await temp.exists()) await temp.delete();
    } catch (_) {
      // Cache cleanup must not block sign-out or authentication recovery.
    }
  }
}
