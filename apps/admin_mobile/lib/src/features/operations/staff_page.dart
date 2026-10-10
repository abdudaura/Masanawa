import 'package:flutter/material.dart';
import 'operations_api.dart';

/// A19 -- read-only staff review until AF00 composes verified staff grants,
/// second factor enrollment and invitation delivery. Never fake access grants.
class StaffPage extends StatefulWidget {
  const StaffPage({super.key,required this.api});
  final OperationsApi api;
  @override State<StaffPage> createState()=>_StaffPageState();
}
class _StaffPageState extends State<StaffPage> {
  late Future<List<StaffMember>> _members=widget.api.staff();
  void _reload()=>setState(()=>_members=widget.api.staff());
  @override Widget build(BuildContext context)=>Scaffold(
    appBar:AppBar(title:const Text('Staff and roles'),actions:[
      IconButton(onPressed:_reload,tooltip:'Reload staff',icon:const Icon(Icons.refresh))]),
    body:FutureBuilder<List<StaffMember>>(future:_members,builder:(context,state){
      if(state.connectionState!=ConnectionState.done)return const Center(child:CircularProgressIndicator());
      if(state.hasError)return Center(child:Column(mainAxisSize:MainAxisSize.min,children:[
        const Text('Staff access is unavailable or restricted.'),
        TextButton(onPressed:_reload,child:const Text('Retry'))]));
      final people=state.data??[];
      return ListView(padding:const EdgeInsets.all(16),children:[
        const Text('Permissions are enforced on the server. Roles cannot be assigned from this screen until the R1 staff authority is connected.'),
        const SizedBox(height:16),
        if(people.isEmpty)const ListTile(title:Text('No staff records available')),
        ...people.map((person)=>Card(child:ListTile(
          leading:Icon(person.mfaVerified?Icons.verified_user_outlined:Icons.gpp_bad_outlined),
          title:Text(person.userId),
          subtitle:Text(person.roles.join(', ')),
          trailing:Text(person.mfaVerified?'MFA verified':'MFA required'),
        ))),
      ]);
    }),
  );
}
