import 'package:flutter/material.dart';
import 'operations_api.dart';

/// A19 -- server-authorized role and audit readback; AF00 supplies R1 staff
/// authority and exclusive mutation controls before role changes are exposed.
class StaffPage extends StatefulWidget {
  const StaffPage({super.key,required this.api});
  final OperationsApi api;
  @override State<StaffPage> createState()=>_StaffPageState();
}
class _StaffPageState extends State<StaffPage> {
  late Future<List<StaffMember>> _members=widget.api.staff();
  late Future<List<AuditEvent>> _audit=widget.api.audit();
  void _reload()=>setState((){
    _members=widget.api.staff();
    _audit=widget.api.audit();
  });
  @override Widget build(BuildContext context)=>DefaultTabController(length:2,child:Scaffold(
    appBar:AppBar(title:const Text('Staff and roles'),actions:[
      IconButton(onPressed:_reload,tooltip:'Reload staff and audit',icon:const Icon(Icons.refresh))],
      bottom:const TabBar(tabs:[Tab(text:'Staff'),Tab(text:'Audit')]),
    ),
    body:TabBarView(children:[_staffView(),_auditView()]),
  ));
  Widget _staffView()=>FutureBuilder<List<StaffMember>>(future:_members,builder:(context,state){
    if(state.connectionState!=ConnectionState.done)return const Center(child:CircularProgressIndicator());
    if(state.hasError)return _error('Staff directory unavailable or access denied.');
    final people=state.data??[];
    return ListView(padding:const EdgeInsets.all(16),children:[
      const Text('Staff role assignments are server-controlled. Invites and changes require the canonical R1 role service and verified second factor.'),
      const SizedBox(height:16),
      if(people.isEmpty)const ListTile(title:Text('No staff records available')),
      ...people.map((person)=>Card(child:ListTile(
        leading:Icon(person.mfaVerified?Icons.verified_user_outlined:Icons.gpp_bad_outlined),
        title:Text(person.userId),
        subtitle:Text(person.roles.join(', ')),
        trailing:Text(person.mfaVerified?'MFA verified':'MFA required'),
      ))),
    ]);
  });
  Widget _auditView()=>FutureBuilder<List<AuditEvent>>(future:_audit,builder:(context,state){
    if(state.connectionState!=ConnectionState.done)return const Center(child:CircularProgressIndicator());
    if(state.hasError)return _error('Audit history unavailable or access denied.');
    final events=state.data??[];
    if(events.isEmpty)return const Center(child:Text('No recorded operational changes.'));
    return ListView(padding:const EdgeInsets.all(16),children:[
      const Text('Server-recorded events',style:TextStyle(fontSize:18,fontWeight:FontWeight.w600)),
      ...events.map((event)=>Card(child:ListTile(
        leading:const Icon(Icons.history),
        title:Text(event.action),
        subtitle:Text('${event.subject} · ${event.actorId}'),
        trailing:Text(event.at,maxLines:2,style:Theme.of(context).textTheme.bodySmall),
      ))),
    ]);
  });
  Widget _error(String message)=>Center(child:Column(mainAxisSize:MainAxisSize.min,children:[
    const Icon(Icons.lock_outline,size:32),
    Text(message,textAlign:TextAlign.center),
    TextButton(onPressed:_reload,child:const Text('Retry')),
  ]));
}
