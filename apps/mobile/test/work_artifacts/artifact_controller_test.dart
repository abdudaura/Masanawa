import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/work_artifacts/work_artifact.dart';
import 'package:masanawa/src/work_artifacts/artifact_controller.dart';

final sample=WorkArtifact(id:'media-artifact_019a0000-0000-7000-8000-000000000001',
  filename:'lesson.txt',state:'ready',revision:2,sizeBytes:5,sha256:'a'*64,
  expiresAt:DateTime.utc(2099),owned:true);
class Transport implements ArtifactTransport {
  Completer<WorkArtifact>? pending;
  Completer<Uint8List>? pendingBytes;
  int loads=0,downloads=0;
  bool fail=false;
  @override Future<WorkArtifact> load(String a,String id,CancelToken c) async {
    loads++;if(fail)throw StateError('offline');if(pending!=null)return await pending!.future;return sample;
  }
  @override Future<Uint8List> download(String a,WorkArtifact f,CancelToken c,void Function(int,int) progress) async {
    downloads++;if(pendingBytes!=null)return await pendingBytes!.future;return Uint8List.fromList(utf8.encode('hello'));
  }
  @override Future<WorkArtifact> recover(String a,String id,CancelToken c)=>load(a,id,c);
  @override Future<WorkArtifact> revoke(String a,WorkArtifact f,CancelToken c)=>load(a,f.id,c);
  @override Future<WorkArtifact> remove(String a,String id,CancelToken c)=>load(a,id,c);
  @override Future<WorkArtifact> share(String a,WorkArtifact f,String recipient,CancelToken c)=>load(a,f.id,c);
}
void main() {
  test('account switch drops late metadata and signed-out state',() async {
    final t=Transport()..pending=Completer<WorkArtifact>(),c=ArtifactController(t);
    c.bind('A',sample.id);final result=c.refresh();c.bind('B',sample.id);
    t.pending!.complete(sample);await result;expect(c.artifact,isNull);expect(c.busy,isFalse);
    c.bind(null,null);await c.refresh();expect(t.loads,1);c.dispose();
  });
  test('switch during download erases late bytes and never exports them',() async {
    final t=Transport()..pendingBytes=Completer<Uint8List>(),c=ArtifactController(t);
    c.bind('A',sample.id);final result=c.previewFile();await Future<void>.delayed(Duration.zero);
    c.bind('B',sample.id);final bytes=Uint8List.fromList([1,2,3]);t.pendingBytes!.complete(bytes);
    await result;expect(c.preview,isNull);expect(bytes,everyElement(0));c.dispose();
  });
  test('duplicate actions coalesce and refresh failure purges preview',() async {
    final t=Transport(),c=ArtifactController(t);c.bind('A',sample.id);
    await c.previewFile();expect(c.preview,'hello');t.fail=true;await c.refresh();
    expect(c.preview,isNull);expect(c.artifact,isNull);expect(c.error,isNotNull);
    t.fail=false;t.pending=Completer<WorkArtifact>();final first=c.refresh();await c.refresh();
    expect(t.loads,3);t.pending!.complete(sample);await first;c.dispose();
  });
  test('export requires fresh server read and no offline preview fallback',() async {
    final t=Transport(),c=ArtifactController(t);c.bind('A',sample.id);await c.previewFile();
    t.fail=true;var saved=false;await c.exportFile((_,__) async {saved=true;});
    expect(saved,isFalse);expect(t.downloads,1);c.dispose();
  });
  test('unknown format and excessive byte size fail closed',() {
    expect(()=>WorkArtifact.parse({'id':sample.id,'filename':'x.html','state':'ready','revision':1,
      'owned':true,'sizeBytes':5,'sha256':'a'*64,'mimeType':'text/html'}),throwsFormatException);
  });
}
