import 'package:flutter/foundation.dart';
import '../core/request_id.dart';
import 'human_dm_models.dart';
import 'human_dm_transport.dart';

/// Server is authoritative. The same request ID is retained through uncertain sends.
class HumanDmThreadController extends ChangeNotifier {
  HumanDmThreadController({required this.conversationId,required this.transport});
  final String conversationId;
  final HumanDmTransport transport;
  final List<HumanDmMessage> _messages=[];
  List<HumanDmMessage> get messages=>List.unmodifiable(_messages);
  String? nextBefore, pendingRequestId, pendingBody, error;
  bool loading=false, loadingOlder=false, sending=false;
  bool _disposed=false;
  void _changed(){if(!_disposed)notifyListeners();}
  void _upsert(HumanDmMessage message) {
    _messages.removeWhere((m)=>m.messageId==message.messageId||
      m.clientRequestId==message.clientRequestId && m.senderUserId==message.senderUserId);
    _messages.add(message);
    _messages.sort((a,b)=>BigInt.parse(b.sequence).compareTo(BigInt.parse(a.sequence)));
    _changed();
  }
  Future<void> refresh() async {
    if (loading)return;
    loading=true; error=null; _changed();
    try {
      final page=await transport.history(conversationId);
      _messages.clear();
      for (final m in page.messages) {_upsert(m);}
      nextBefore=page.nextBefore;
      if (_messages.isNotEmpty) {
        await transport.read(conversationId,_messages.first.sequence);
      }
    } catch(e) {
      error='Messages could not load. Check your connection and retry.';
    } finally {loading=false;_changed();}
  }
  Future<void> older() async {
    if(loadingOlder||nextBefore==null)return;
    final before=nextBefore!;
    loadingOlder=true; _changed();
    try {
      final page=await transport.history(conversationId,before:before);
      for(final m in page.messages){_upsert(m);}
      nextBefore=page.nextBefore;
      error=null;
    } catch(e){error='Older messages could not load. Retry.';}
    finally{loadingOlder=false;_changed();}
  }
  Future<bool> send(String draft) async {
    final body=draft.trim();
    if(body.isEmpty || (pendingRequestId!=null && pendingBody!=body) || sending) return false;
    pendingBody ??= body;
    pendingRequestId ??= createRequestId();
    sending=true;error=null;_changed();
    try {
      final m=await transport.send(conversationId,pendingRequestId!,pendingBody!);
      _upsert(m);
      pendingBody=null;pendingRequestId=null;
      return true;
    }catch(e) {
      error='Not sent. Retry the same message or keep your draft.';
      return false;
    }finally{sending=false;_changed();}
  }
  void discardPending(){if(sending)return;pendingBody=null;pendingRequestId=null;error=null;_changed();}
  Future<void> delete(HumanDmMessage m) async {
    try {_upsert(await transport.remove(m.messageId));error=null;}
    catch(e){error='Could not delete this message.';}
    _changed();
  }
  Future<void> edit(HumanDmMessage m,String newText) async {
    try {_upsert(await transport.edit(m.messageId,newText));error=null;}
    catch(e){error='Could not edit this message.';}
    _changed();
  }
  @override void dispose(){_disposed=true;super.dispose();}
}
