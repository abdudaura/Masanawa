import 'room_discussion_client.dart';
import 'room_discussion_moderation_screen.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'rooms_admin_client.dart';
import 'rooms_plans_client.dart';
import 'rooms_plans_screen.dart';
const _blue=Color(0xFF1E63D6);
class RoomsAdminScreen extends StatefulWidget {
 const RoomsAdminScreen({super.key,required this.client,this.discussionApi,this.accountScope});
 final RoomsAdminClient client;
 final RoomDiscussionModerationApi? discussionApi;
 final String? accountScope;
 @override State<RoomsAdminScreen> createState()=>_RoomsAdminScreenState();
}
class _RoomsAdminScreenState extends State<RoomsAdminScreen>{
 final title=TextEditingController(),slug=TextEditingController(),teacher=TextEditingController();
 bool loading=true,busy=false;Object? error;
 List<ReviewQuestion> questions=[];List<Map<String,dynamic>> rooms=[];
 @override void initState(){super.initState();reload();}
 @override void dispose(){title.dispose();slug.dispose();teacher.dispose();super.dispose();}
 Future<void> reload()async{
  setState((){loading=true;error=null;});
  try{
   final q=await widget.client.queue(),r=await widget.client.rooms();
   if(mounted)setState((){questions=q;rooms=r;loading=false;});
  }catch(e){if(mounted)setState((){error=e;loading=false;});}
 }
 void notice(String text){
  if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(text)));
 }
 Future<void> create()async{
  if(busy||title.text.trim().length<3||slug.text.trim().length<3||teacher.text.trim().isEmpty)return;
  setState(()=>busy=true);
  try{await widget.client.create(slug:slug.text.trim(),title:title.text.trim(),teacherId:teacher.text.trim());
   title.clear();slug.clear();teacher.clear();if(mounted)await reload();
  }catch(e){notice('Room create failed. Check role, teacher and network.');}
  finally{if(mounted)setState(()=>busy=false);}
 }
 Future<void> publish(String id)async{
  if(busy)return;setState(()=>busy=true);
  try{await widget.client.publish(id);if(mounted)await reload();}
  catch(e){notice('Could not publish: approved Masana teacher and staff role required.');}
  finally{if(mounted)setState(()=>busy=false);}
 }
 Future<void> review(ReviewQuestion q,bool approve)async{
  final controller=TextEditingController(text:q.draft??'');
  final answer=await showDialog<String>(context:context,builder:(ctx)=>AlertDialog(
   title:Text(approve?'Approve teacher response':'Reject question'),
   content:Column(mainAxisSize:MainAxisSize.min,children:[
    Text(q.body),TextField(controller:controller,minLines:2,maxLines:5,maxLength:6000,
     decoration:const InputDecoration(labelText:'Answer or explanation'))]),
   actions:[TextButton(onPressed:()=>Navigator.pop(ctx),child:const Text('Cancel')),
    FilledButton(onPressed:()=>Navigator.pop(ctx,controller.text.trim()),child:const Text('Confirm'))]));
  if(answer==null||answer.isEmpty||busy)return;
  setState(()=>busy=true);
  try{await widget.client.review(q.id,answer,approve:approve);if(mounted)await reload();}
  catch(e){notice('Review failed. The question may already have been reviewed.');}
  finally{if(mounted)setState(()=>busy=false);}
 }
 @override Widget build(BuildContext context)=>Scaffold(
  appBar:AppBar(title:const Text('Rooms studio'),backgroundColor:_blue,foregroundColor:Colors.white,
   actions:[IconButton(onPressed:reload,tooltip:'Refresh',icon:const Icon(Icons.refresh))]),
  body:loading?const Center(child:CircularProgressIndicator()):
   error!=null?Center(child:Column(mainAxisSize:MainAxisSize.min,children:[
    Text(error is DioException && (error as DioException).response?.statusCode==403?
     'Staff permission required':'Offline or unable to load Rooms'),
    TextButton(onPressed:reload,child:const Text('Retry'))])):
   ListView(padding:const EdgeInsets.all(16),children:[
    Text('Create professional Room',style:Theme.of(context).textTheme.titleLarge),
    const Text('Staff-owned only. New rooms remain drafts until teacher approval.'),
    TextField(controller:title,decoration:const InputDecoration(labelText:'Profession title')),
    TextField(controller:slug,decoration:const InputDecoration(labelText:'Room slug')),
    TextField(controller:teacher,decoration:const InputDecoration(labelText:'Approved Masana ID')),
    FilledButton(onPressed:busy?null:create,child:const Text('Save draft')),
    const Divider(),Text('Room drafts',style:Theme.of(context).textTheme.titleLarge),
    if(rooms.isEmpty)const ListTile(title:Text('No Rooms to review')),
    for(final r in rooms)ListTile(title:Text(r['professionTitle'] as String? ?? 'Room'),
     subtitle:Text(r['state'] as String? ?? 'unknown'),
     trailing:Row(mainAxisSize:MainAxisSize.min,children:[
      if(r['state']=='draft')TextButton(onPressed:busy?null:()=>publish(r['roomId'] as String),
       child:const Text('Publish')),
      if(widget.client is HttpRoomsAdminClient)IconButton(
       tooltip:'Manage plans',
       onPressed:busy?null:()=>Navigator.push<void>(context,MaterialPageRoute(
        builder:(_)=>RoomPlansAdminScreen(
         roomId:r['roomId'] as String,
         client:HttpRoomPlansAdminClient((widget.client as HttpRoomsAdminClient).dio)))),
       icon:const Icon(Icons.payments_outlined)),
     ])),
    if(widget.discussionApi!=null&&widget.accountScope!=null)ListTile(
      leading:const Icon(Icons.forum_outlined),title:const Text('Moderate Room discussion'),
      subtitle:const Text('Review held replies before publication'),
      onTap:()=>Navigator.push<void>(context,MaterialPageRoute(builder:(_)=>
       RoomDiscussionModerationScreen(api:widget.discussionApi!,accountScope:widget.accountScope!)))),
    const Divider(),Text('Question review',style:Theme.of(context).textTheme.titleLarge),
    if(questions.isEmpty)const ListTile(title:Text('No pending questions')),
    for(final q in questions)Card(child:Column(children:[
     ListTile(title:Text(q.body),subtitle:Text('${q.roomId} · ${q.state}'+
      (q.draft==null?'':'\nDraft: ${q.draft!}'))),
     Row(children:[TextButton(onPressed:busy?null:()=>review(q,true),child:const Text('Approve')),
      TextButton(onPressed:busy?null:()=>review(q,false),child:const Text('Reject'))]),
    ])),
   ])
 );
}
