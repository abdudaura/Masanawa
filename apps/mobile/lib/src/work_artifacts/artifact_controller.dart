import 'dart:convert';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'work_artifact.dart';

class ArtifactController extends ChangeNotifier {
  ArtifactController(this.transport);
  final ArtifactTransport transport;
  String? _account, _id;
  int _generation=0;
  int _binding=0;
  int get binding => _binding;
  bool _disposed=false;
  CancelToken? _cancel;
  WorkArtifact? artifact;
  Uint8List? _bytes;
  String? preview, error;
  bool busy=false;
  double? progress;
  bool get bound => _account != null && _id != null;
  void bind(String? account,String? id) {
    if (_account==account && _id==id) return;
    _cancel?.cancel('Account or artifact changed');_generation++;_binding++;
    _account=account;_id=id;artifact=null;_clearBytes();error=null;busy=false;progress=null;
    if (!_disposed) notifyListeners();
  }
  void _clearBytes() { _bytes?.fillRange(0,_bytes!.length,0);_bytes=null;preview=null; }
  Future<void> _run(Future<void> Function(String,String,CancelToken,int) action) async {
    if (!bound || busy || _disposed) return;
    final generation=++_generation,account=_account!,id=_id!,cancel=CancelToken();
    _cancel=cancel;busy=true;error=null;progress=null;notifyListeners();
    try { await action(account,id,cancel,generation); }
    catch (_) {
      if (_valid(generation)) {artifact=null;_clearBytes();error='Could not verify this file. Refresh when you are online.';}
    } finally {
      if (_valid(generation)) {busy=false;progress=null;notifyListeners();}
    }
  }
  bool _valid(int g)=>!_disposed && g==_generation;
  Future<void> refresh()=>_run((a,id,c,g) async {
    _clearBytes();final value=await transport.load(a,id,c);if (_valid(g)) artifact=value;
  });
  Future<void> recover()=>_run((a,id,c,g) async {
    _clearBytes();final value=await transport.recover(a,id,c);if (_valid(g)) artifact=value;
  });
  Future<void> previewFile()=>_run((a,id,c,g) async {
    _clearBytes();final current=await transport.load(a,id,c);if (!_valid(g)) return;
    artifact=current;if (!current.ready) throw StateError('Unavailable');
    final bytes=await transport.download(a,current,c,(received,total) {
      if (_valid(g)) {progress=received/total;notifyListeners();}
    });
    if (!_valid(g)) {bytes.fillRange(0,bytes.length,0);return;}
    _bytes=bytes;preview=utf8.decode(bytes,allowMalformed:false); // Plain text; never HTML, Markdown or executable links.
  });
  /// Export always reauthorizes/downloads; a previous preview never grants future export access.
  Future<void> exportFile(Future<void> Function(String,Uint8List) save)=>_run((a,id,c,g) async {
    _clearBytes();final current=await transport.load(a,id,c);if (!_valid(g)) return;
    artifact=current;if (!current.ready) throw StateError('Unavailable');
    final bytes=await transport.download(a,current,c,(_,__){});
    try {if (_valid(g)) await save(current.filename,bytes);}
    finally {bytes.fillRange(0,bytes.length,0);}
  });
  Future<void> revoke()=>_run((a,id,c,g) async {
    final current=artifact;_clearBytes();if (current==null || !current.owned) return;
    final result=await transport.revoke(a,current,c);if (_valid(g)) artifact=result;
  });
  Future<void> remove()=>_run((a,id,c,g) async {
    _clearBytes();final result=await transport.remove(a,id,c);if (_valid(g)) artifact=result;
  });
  Future<void> share(String recipient)=>_run((a,id,c,g) async {
    final current=artifact;_clearBytes();if (current==null || !current.owned || !current.ready) return;
    final result=await transport.share(a,current,recipient,c);if (_valid(g)) artifact=result;
  });
  @override
  void dispose() {_disposed=true;_generation++;_cancel?.cancel('Disposed');_clearBytes();super.dispose();}
}
