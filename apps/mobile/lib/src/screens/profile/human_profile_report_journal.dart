import 'dart:convert';
import 'dart:math';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../talks/talk_safety.dart';

class PendingHumanProfileReport {
  const PendingHumanProfileReport({
    required this.requestId, required this.reason,
    required this.detail, required this.createdAt,
  });
  final String requestId;
  final TalkSafetyReportReason reason;
  final String detail;
  final DateTime createdAt;

  static String freshId() {
    final rng=Random.secure();
    final bytes=List<int>.generate(20, (_)=>rng.nextInt(256));
    return 'human-profile-' + bytes.map((b)=>b.toRadixString(16).padLeft(2,'0')).join();
  }
  String serialize()=>jsonEncode({
    'requestId':requestId,'reason':reason.wire,'detail':detail,
    'createdAt':createdAt.toUtc().toIso8601String(),
  });
  static PendingHumanProfileReport? parse(String raw) {
    try {
      final value=jsonDecode(raw);
      if(value is! Map || value['requestId'] is! String ||
        value['reason'] is! String || value['detail'] is! String ||
        value['createdAt'] is! String) return null;
      final reason=TalkSafetyReportReason.values.firstWhere(
        (r)=>r.wire==value['reason'],
      );
      final requestId=value['requestId'] as String;
      final detail=value['detail'] as String;
      final created=DateTime.parse(value['createdAt'] as String).toUtc();
      if(!requestId.startsWith('human-profile-') || requestId.length>256 ||
         detail.length>2000 || created.isAfter(DateTime.now().toUtc())) return null;
      return PendingHumanProfileReport(
        requestId:requestId,reason:reason,detail:detail,createdAt:created,
      );
    } catch (_) { return null; }
  }
}

abstract interface class HumanProfileReportJournal {
  Future<PendingHumanProfileReport?> read(String userId,String handle);
  Future<void> write(String userId,String handle,PendingHumanProfileReport report);
  Future<void> clear(String userId,String handle);
}

class SecureHumanProfileReportJournal implements HumanProfileReportJournal {
  const SecureHumanProfileReportJournal(this.storage);
  final FlutterSecureStorage storage;
  String _key(String userId,String handle) {
    final scope=base64Url.encode(utf8.encode('$userId|${handle.toLowerCase()}'));
    return 'human-profile-report-v1-$scope';
  }
  @override
  Future<PendingHumanProfileReport?> read(String userId,String handle) async {
    final raw=await storage.read(key:_key(userId,handle));
    if(raw==null)return null;
    final pending=PendingHumanProfileReport.parse(raw);
    if(pending==null){
      throw const FormatException('Corrupt pending report: do not create new ID');
    }
    return pending;
  }
  @override
  Future<void> write(String userId,String handle,PendingHumanProfileReport report)=>
    storage.write(key:_key(userId,handle),value:report.serialize());
  @override
  Future<void> clear(String userId,String handle)=>
    storage.delete(key:_key(userId,handle));
}

final humanProfileReportJournalProvider=Provider<HumanProfileReportJournal>(
  (ref)=>const SecureHumanProfileReportJournal(FlutterSecureStorage()),
);
