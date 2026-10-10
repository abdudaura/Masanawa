import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

/// Dio must be the existing authenticated Admin client with its session
/// interceptor. This screen never requests, stores or prints credentials.
class MasanaSocialAdminApi {
  MasanaSocialAdminApi(this.dio);
  final Dio dio;
  String _base(String characterId)=>
    '/v1/admin/masana/${Uri.encodeComponent(characterId)}/social-accounts';
  Future<List<MasanaSocialAccount>> list(String characterId) async{
    final response=await dio.get<Map<String,dynamic>>(_base(characterId));
    final items=response.data?['identities'];
    if(items is! List)throw const FormatException('Invalid social identities response');
    return items.map((v)=>MasanaSocialAccount.fromJson(Map<String,dynamic>.from(v as Map)))
      .toList(growable:false);
  }
  Future<void> register(String characterId,{required String provider,
      required String accountId,required String handle,required String publicUrl})async{
    await dio.post<void>(_base(characterId),data:{
      'provider':provider,'providerAccountId':accountId,'handle':handle,'publicUrl':publicUrl,
    });
  }
  Future<void> action(String characterId,MasanaSocialAccount item,
      String action,{String? evidenceRef})async{
    await dio.post<void>('${_base(characterId)}/${Uri.encodeComponent(item.identityId)}/$action',
      data:{'revision':item.revision, if(evidenceRef!=null) 'evidenceRef':evidenceRef});
  }
}
class MasanaSocialAccount {
  const MasanaSocialAccount({required this.identityId,required this.provider,
    required this.handle,required this.publicUrl,required this.publishState,
    required this.verifiedAt,required this.revision,required this.paused});
  final String identityId,provider,handle,publicUrl,publishState;
  final String? verifiedAt;
  final int revision;
  final bool paused;
  factory MasanaSocialAccount.fromJson(Map<String,dynamic> json)=>MasanaSocialAccount(
    identityId:json['identityId'] as String,provider:json['provider'] as String,
    handle:json['handle'] as String,publicUrl:json['publicUrl'] as String,
    publishState:json['publishState'] as String,verifiedAt:json['verifiedAt'] as String?,
    revision:json['revision'] as int,paused:json['paused'] as bool,
  );
}
class MasanaSocialAccountsPage extends StatefulWidget{
  const MasanaSocialAccountsPage({super.key,required this.api,required this.characterId});
  final MasanaSocialAdminApi api;
  final String characterId;
  @override State<MasanaSocialAccountsPage> createState()=>_SocialAccountsState();
}
class _SocialAccountsState extends State<MasanaSocialAccountsPage>{
  final account=TextEditingController(),handle=TextEditingController(),
      url=TextEditingController(),evidence=TextEditingController();
  String provider='whatsapp';
  bool busy=false,loading=true;
  String? error;
  List<MasanaSocialAccount> items=const[];
  @override void initState(){super.initState();_load();}
  @override void didUpdateWidget(covariant MasanaSocialAccountsPage oldWidget){
    super.didUpdateWidget(oldWidget);
    if(oldWidget.characterId!=widget.characterId){items=[];_load();}
  }
  @override void dispose(){
    account.dispose();handle.dispose();url.dispose();evidence.dispose();super.dispose();
  }
  String _error(Object e){
    if(e is DioException){
      if(e.response?.statusCode==403)return 'Permission denied. Ask an authorized administrator.';
      if(e.response?.statusCode==409)return 'Account changed or already exists. Reload and try again.';
      if(e.response?.statusCode==401)return 'Session expired. Sign in again.';
      if(e.type==DioExceptionType.connectionError || e.type==DioExceptionType.connectionTimeout){
        return 'Offline. Existing accounts are not modified.';
      }
    }
    return 'Request failed. Retry when your connection is available.';
  }
  Future<void> _load()async{
    final character=widget.characterId;
    setState((){loading=true;error=null;});
    try{
      final result=await widget.api.list(character);
      if(!mounted || widget.characterId!=character)return;
      setState((){items=result;loading=false;});
    }catch(e){if(mounted && widget.characterId==character)setState((){loading=false;error=_error(e);});}
  }
  Future<void> _write(Future<void> Function() action)async{
    setState((){busy=true;error=null;});
    try{await action();if(mounted)await _load();}
    catch(e){if(mounted)setState(()=>error=_error(e));}
    finally{if(mounted)setState(()=>busy=false);}
  }
  @override Widget build(BuildContext context)=>Scaffold(
    appBar:AppBar(title:const Text('Masana social accounts')),
    body:ListView(padding:const EdgeInsets.all(16),children:[
      Text('Character: ${widget.characterId}',style:Theme.of(context).textTheme.titleMedium),
      const SizedBox(height:8),
      const Text('Personal WhatsApp uses the official phone app. This page only publishes verified links; no WhatsApp bot or Business API is connected.'),
      const SizedBox(height:16),
      if(loading)const LinearProgressIndicator(),
      if(error!=null)Card(child:Padding(padding:const EdgeInsets.all(12),child:Column(children:[
        Text(error!,style:TextStyle(color:Theme.of(context).colorScheme.error)),
        TextButton(onPressed:busy?null:_load,child:const Text('Reload')),
      ]))),
      if(!loading && items.isEmpty)const Text('No accounts yet. Add the official account below.'),
      for(final item in items)Card(child:Padding(
        padding:const EdgeInsets.all(12),
        child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
          Text('${item.provider.toUpperCase()} · ${item.handle}',style:Theme.of(context).textTheme.titleSmall),
          SelectableText(item.publicUrl),
          Text(item.publishState=='published'?'Published verified link':
            item.publishState=='revoked'?'Revoked — not visible to fans':'Draft — hidden from fans'),
          Text(item.paused?'Paused · automation disabled':'Profile link only · no WhatsApp automation'),
          Wrap(spacing:8,children:[
            if(item.verifiedAt==null && item.publishState!='revoked')
              OutlinedButton(onPressed:busy?null:(){
                if(evidence.text.trim().isEmpty){
                  setState(()=>error='Enter a real verification record first.');return;
                }
                _write(()=>widget.api.action(widget.characterId,item,'verify',
                  evidenceRef:evidence.text.trim()));
              },child:const Text('Verify')),
            if(item.verifiedAt!=null && item.publishState=='draft')
              OutlinedButton(onPressed:busy?null:()=>_write(
                ()=>widget.api.action(widget.characterId,item,'publish')),
                child:const Text('Publish')),
            if(!item.paused && item.publishState!='revoked')
              OutlinedButton(onPressed:busy?null:()=>_write(
                ()=>widget.api.action(widget.characterId,item,'pause')),
                child:const Text('Pause')),
            if(item.paused && item.publishState!='revoked')
              OutlinedButton(onPressed:busy?null:()=>_write(
                ()=>widget.api.action(widget.characterId,item,'resume')),
                child:const Text('Resume link-only')),
            if(item.publishState!='revoked')
              TextButton(onPressed:busy?null:()=>_write(
                ()=>widget.api.action(widget.characterId,item,'revoke')),
                child:const Text('Revoke')),
          ]),
        ]),
      )),
      const Divider(height:32),
      Text('Add account (draft)',style:Theme.of(context).textTheme.titleMedium),
      DropdownButtonFormField<String>(
        initialValue:provider,
        decoration:const InputDecoration(labelText:'Provider'),
        items:const ['whatsapp','telegram','instagram','facebook','youtube','tiktok','x']
          .map((v)=>DropdownMenuItem(value:v,child:Text(v))).toList(),
        onChanged:busy?null:(v)=>setState(()=>provider=v??'whatsapp'),
      ),
      TextField(controller:account,decoration:const InputDecoration(
        labelText:'Account identifier',hintText:'International digits for WhatsApp')),
      TextField(controller:handle,decoration:const InputDecoration(labelText:'Public handle')),
      TextField(controller:url,keyboardType:TextInputType.url,decoration:const InputDecoration(
        labelText:'Official HTTPS profile link',hintText:'https://wa.me/234...')),
      TextField(controller:evidence,decoration:const InputDecoration(
        labelText:'Staff verification record ID',hintText:'Evidence must exist before Verify')),
      const SizedBox(height:12),
      FilledButton(onPressed:busy?null:()=>_write(()=>widget.api.register(widget.characterId,
          provider:provider,accountId:account.text.trim(),handle:handle.text.trim(),
          publicUrl:url.text.trim())),child:const Text('Save draft')),
    ]),
  );
}
