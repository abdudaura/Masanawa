import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'room_membership_client.dart';

/// AF00 opens from Room detail and rebuilds with a new account-fenced client.
/// manage is a display hint; the server remains the authority for every operation.
class RoomMembershipScreen extends StatefulWidget {
 const RoomMembershipScreen({super.key,required this.client,required this.accountId,
  required this.roomId,required this.title,this.manage=false});
 final RoomMembershipClient client;
 final String accountId,roomId,title;
 final bool manage;
 @override State<RoomMembershipScreen> createState()=>_RoomMembershipScreenState();
}
class _RoomMembershipScreenState extends State<RoomMembershipScreen> {
 final _token=TextEditingController();
 List<RoomMember> _members=[];
 List<RoomInvite> _invites=[];
 RoomInvite? _issued;
 String? _error,_notice;
 bool _loading=false,_busy=false;
 int _epoch=0;
 @override void initState(){super.initState();_load();}
 @override void didUpdateWidget(covariant RoomMembershipScreen old){
  super.didUpdateWidget(old);
  if(old.accountId!=widget.accountId || old.roomId!=widget.roomId ||
     old.client!=widget.client || old.manage!=widget.manage){
   _epoch++;_token.clear();_members=[];_invites=[];_issued=null;
   _error=null;_notice=null;_busy=false;_load();
  }
 }
 @override void dispose(){_epoch++;_token.dispose();super.dispose();}
 String message(Object e) {
  final code=e is RoomMembershipFailure ? e.code : 'rooms_unavailable';
  return switch(code){
   'account_changed'=>'Your account changed. Reopen this room.',
   'room_moderator_required' || 'staff_role_required'=>'You do not have permission to manage this room.',
   'room_banned'=>'Access to this room has been removed.',
   'subscription_not_verified'=>'An active room subscription is required.',
   'invite_expired'=>'This invitation has expired. Ask for a new code.',
   'invite_already_used'=>'This invitation has already been used.',
   'invite_unavailable'=>'This invitation is unavailable or revoked.',
   'invalid_invite'=>'Enter a valid invitation code.',
   'room_not_found' || 'room_not_published'=>'This room is unavailable.',
   'rooms_membership_disabled'=>'Room membership controls are not available yet.',
   'room_invite_limit'=>'Revoke an unused invitation before creating another.',
   _=>'Could not complete the request. Try again. An invitation request may have reached the server; review the list before creating another.'
  };
 }
 Future<void> _load() async {
  if(!widget.manage){setState(()=>_loading=false);return;}
  final epoch=++_epoch,client=widget.client,id=widget.roomId;
  setState((){_loading=true;_error=null;});
  try {
   final values=await Future.wait([client.members(id),client.invites(id)]);
   if(!mounted || epoch!=_epoch)return;
   setState((){_members=values[0] as List<RoomMember>;
    _invites=values[1] as List<RoomInvite>;_loading=false;});
  }catch(e){
   if(!mounted || epoch!=_epoch)return;
   setState((){_loading=false;_error=message(e);_members=[];_invites=[];_issued=null;});
  }
 }
 Future<void> _run(Future<void> Function(RoomMembershipClient,String) action) async {
  if(_busy || _loading)return;
  final epoch=_epoch,client=widget.client,id=widget.roomId;
  setState((){_busy=true;_error=null;_notice=null;});
  try {
   await action(client,id);
   if(!mounted || epoch!=_epoch)return;
   setState(()=>_busy=false);
   await _load();
  }catch(e){
   if(!mounted || epoch!=_epoch)return;
   setState((){_busy=false;_error=message(e);});
  }
 }
 Future<void> _moderate(RoomMember member) async {
  final action=member.state=='banned'?'unban':'ban',epoch=_epoch;
  final confirmed=await showDialog<bool>(context:context,builder:(context)=>AlertDialog(
   title:Text(action=='ban'?'Remove room access?':'Allow rejoining?'),
   content:Text(action=='ban'?'This member will lose access to the room.':'The member can join again. This does not enroll them automatically.'),
   actions:[TextButton(onPressed:()=>Navigator.pop(context,false),child:const Text('Cancel')),
    FilledButton(onPressed:()=>Navigator.pop(context,true),child:Text(action=='ban'?'Remove access':'Allow rejoining'))]));
  if(confirmed!=true || !mounted || epoch!=_epoch)return;
  await _run((client,id)=>client.moderate(id,member.userId,action));
 }
 @override Widget build(BuildContext context)=>Scaffold(
  appBar:AppBar(title:Text(widget.title)),
  body:ListView(padding:const EdgeInsets.all(16),children:[
   const Text('Join with an invitation',style:TextStyle(fontSize:18,fontWeight:FontWeight.bold)),
   TextField(controller:_token,enabled:!_busy&&!_loading,autocorrect:false,enableSuggestions:false,
    decoration:const InputDecoration(labelText:'Invitation code'),maxLength:43),
   FilledButton(onPressed:_busy||_loading?null:()=>_run((client,id) async {
    final epoch=_epoch;await client.accept(id,_token.text);
    if(!mounted || epoch!=_epoch)return;
    setState((){_token.clear();_notice='You joined the room.';});
   }),child:const Text('Join room')),
   if(_notice!=null)Text(_notice!,semanticsLabel:_notice),
   if(_error!=null)Padding(padding:const EdgeInsets.symmetric(vertical:12),child:Text(_error!,
    style:TextStyle(color:Theme.of(context).colorScheme.error))),
   if(_busy||_loading)const LinearProgressIndicator(),
   if(widget.manage)...[
    const SizedBox(height:24),
    Row(children:[const Expanded(child:Text('Members and invitations',style:TextStyle(fontSize:18,fontWeight:FontWeight.bold))),
     IconButton(tooltip:'Refresh members',onPressed:_busy||_loading?null:_load,icon:const Icon(Icons.refresh))]),
    if(_members.isEmpty&&!_loading&&_error==null)const Text('No members to display.'),
    for(final member in _members)ListTile(title:Text(member.userId),subtitle:Text('${member.role} · ${member.state}'),
     trailing:member.userId==widget.accountId?null:TextButton(onPressed:_busy||_loading?null:()=>_moderate(member),
      child:Text(member.state=='banned'?'Allow rejoining':'Remove access'))),
    FilledButton.tonal(onPressed:_busy||_loading?null:()=>_run((client,id) async {
     final epoch=_epoch;final invite=await client.issue(id);
     if(!mounted || epoch!=_epoch)return;
     setState(()=>_issued=invite);
    }),child:const Text('Create single-use invitation')),
    if(_issued?.token!=null)Card(child:Padding(padding:const EdgeInsets.all(12),child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
     const Text('Copy this code now. It will not be shown again after leaving this screen.'),
     SelectableText(_issued!.token!),
     TextButton.icon(onPressed:_busy||_loading?null:() async {
      final token=_issued?.token;if(token!=null)await Clipboard.setData(ClipboardData(text:token));
     },icon:const Icon(Icons.copy),label:const Text('Copy invitation code'))]))),
    for(final invite in _invites)ListTile(title:Text(invite.accepted?'Used invitation':invite.revoked?'Revoked invitation':'Invitation'),
     subtitle:Text('Expires ${invite.expiresAt.toLocal()}'),
     trailing:invite.revoked?null:TextButton(onPressed:_busy||_loading?null:()=>_run((client,id) async {
      final epoch=_epoch;await client.revoke(id,invite.id);
      if(!mounted || epoch!=_epoch)return;
      if(_issued?.id==invite.id)setState(()=>_issued=null);
     }),child:const Text('Revoke'))),
   ],
  ]),
 );
}
