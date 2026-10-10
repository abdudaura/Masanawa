import 'package:flutter/material.dart';
import '../core/network/api_client.dart';
import 'human_dm_screens.dart';
import 'human_dm_transport.dart';

class HumanContactCandidate {
  const HumanContactCandidate({required this.userId,required this.displayName,
    required this.handle,required this.status,required this.canMessage});
  final String userId,displayName,handle,status;
  final bool canMessage;
  factory HumanContactCandidate.fromJson(Map<String,dynamic> raw)=>
    HumanContactCandidate(userId:raw['userId'] as String,
      displayName:raw['displayName'] as String,handle:raw['handle'] as String,
      status:raw['status'] as String,canMessage:raw['canMessage'] as bool);
}
abstract class HumanDmContactTransport {
  Future<HumanContactCandidate> lookup(String handle);
  Future<String> request(String handle);
}
/// Only consumes C01's canonical privacy-scoped contact API; never enumerates names.
class GatewayHumanDmContactTransport implements HumanDmContactTransport{
  const GatewayHumanDmContactTransport(this.api);
  final ApiClient api;
  @override Future<HumanContactCandidate> lookup(String handle) async{
    final result=await api.dio.get<dynamic>('/messages/contacts/lookup/${Uri.encodeComponent(handle)}');
    if(result.data is! Map)throw const FormatException('Unexpected contact response');
    return HumanContactCandidate.fromJson((result.data as Map).cast<String,dynamic>());
  }
  @override Future<String> request(String handle) async{
    final result=await api.dio.post<dynamic>('/messages/contacts/requests',data:{'handle':handle});
    if(result.data is! Map)throw const FormatException('Unexpected request response');
    return (result.data as Map)['status'] as String;
  }
}

/// C01 admission + C02 actual conversation open. Standalone for R17/C08 to route.
class HumanDmNewMessageScreen extends StatefulWidget {
  const HumanDmNewMessageScreen({super.key,required this.contacts,
    required this.messages,required this.currentUserId});
  final HumanDmContactTransport contacts;
  final HumanDmTransport messages;
  final String currentUserId;
  @override State<HumanDmNewMessageScreen> createState()=>_HumanDmNewMessageScreenState();
}
class _HumanDmNewMessageScreenState extends State<HumanDmNewMessageScreen>{
  final controller=TextEditingController();
  HumanContactCandidate? contact;
  String? error,notice;
  bool busy=false;
  @override void dispose(){controller.dispose();super.dispose();}
  Future<void> lookup() async {
    final handle=controller.text.trim().replaceFirst(RegExp(r'^@'),'');
    if(handle.isEmpty)return;
    setState((){busy=true;error=null;notice=null;contact=null;});
    try{
      final candidate=await widget.contacts.lookup(handle);
      if(mounted)setState(()=>contact=candidate);
    }catch(_){
      if(mounted)setState(()=>error='Person not found or not available for messaging.');
    }finally{if(mounted)setState(()=>busy=false);}
  }
  Future<void> requestOrOpen() async{
    final candidate=contact;
    if(candidate==null)return;
    setState((){busy=true;error=null;notice=null;});
    try{
      if(!candidate.canMessage){
        final state=await widget.contacts.request(candidate.handle);
        if(mounted){
          setState(()=>notice=state=='pending'
            ?'Message request sent. Start chatting after acceptance.'
            :state=='accepted'
              ?'Request accepted. Open the conversation.'
              :'Request already exists. Check its status.');
          await lookup();
        }
        return;
      }
      final conversationId=await widget.messages.open(candidate.userId);
      if(!mounted)return;
      await Navigator.of(context).pushReplacement(MaterialPageRoute<void>(
        builder:(_)=>HumanDmThreadScreen(conversationId:conversationId,
          otherDisplayName:candidate.displayName,currentUserId:widget.currentUserId,
          transport:widget.messages)));
    }catch(_){
      if(mounted)setState(()=>error='Unable to open conversation. Retry or check contact permissions.');
    }finally{if(mounted)setState(()=>busy=false);}
  }
  @override Widget build(BuildContext context)=>Scaffold(
    appBar:AppBar(title:const Text('New message')),
    body:SafeArea(child:Padding(padding:const EdgeInsets.all(16),child:Column(
      crossAxisAlignment:CrossAxisAlignment.stretch,children:[
        TextField(controller:controller,enabled:!busy,
          textInputAction:TextInputAction.search,onSubmitted:(_)=>lookup(),
          decoration:const InputDecoration(labelText:'Person’s exact handle',
            hintText:'@handle',prefixIcon:Icon(Icons.alternate_email),border:OutlineInputBorder())),
        const SizedBox(height:12),
        FilledButton(onPressed:busy?null:lookup,child:const Text('Find person')),
        if(busy)const LinearProgressIndicator(),
        if(error!=null)Padding(padding:const EdgeInsets.all(8),child:Text(error!)),
        if(notice!=null)Padding(padding:const EdgeInsets.all(8),child:Text(notice!)),
        if(contact!=null)Card(child:ListTile(
          title:Text(contact!.displayName),subtitle:Text('@${contact!.handle} · ${contact!.status}'),
          trailing:FilledButton(onPressed:busy?null:requestOrOpen,
            child:Text(contact!.canMessage?'Message':'Request')),
        )),
      ]))),
  );
}
