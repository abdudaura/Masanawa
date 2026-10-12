import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

class TelegramStaffConnection {
 const TelegramStaffConnection({required this.id,required this.handle,required this.revision,
  required this.state,required this.mode,required this.paused,required this.verified});
 final String id,handle,state,mode;
 final bool paused,verified;
 final int revision;
 factory TelegramStaffConnection.fromJson(Map<String,dynamic> x)=>TelegramStaffConnection(
  id:x['identityId'] as String,handle:x['handle'] as String,
  revision:(x['revision'] as num).toInt(),state:x['publishState'] as String,
  mode:x['mode'] is String?x['mode'] as String:'profile_link_only',
  paused:x['paused']==true,verified:x['verifiedAt'] is String,
 );
}

/// A22/A24/A25: staff-view of official Telegram identities. Tokens are NEVER
/// requested in Flutter; eligibility is provisioned and verified server-side.
class TelegramConnectionAdminPage extends StatefulWidget {
 const TelegramConnectionAdminPage({super.key,required this.characterId,required this.dio});
 final String characterId;
 final Dio dio;
 @override State<TelegramConnectionAdminPage> createState()=>_TelegramConnectionAdminPageState();
}
class _TelegramConnectionAdminPageState extends State<TelegramConnectionAdminPage> {
 final credentialAlias=TextEditingController();
 List<TelegramStaffConnection> accounts=const[];
 bool loading=true,busy=false;
 String? notice,error;
 int epoch=0;
 @override void initState(){super.initState();_reload();}
 @override void didUpdateWidget(covariant TelegramConnectionAdminPage old){
  super.didUpdateWidget(old);
  if(old.characterId!=widget.characterId||old.dio!=widget.dio){
   epoch++;accounts=const[];_reload();
  }
 }
 @override void dispose(){epoch++;credentialAlias.dispose();super.dispose();}
 String _error(Object value){
  if(value is DioException){
   if(value.response?.statusCode==403)return 'Staff permission denied. No changes made.';
   if(value.response?.statusCode==401)return 'Session expired. Sign in again.';
   if(value.response?.statusCode==409)return 'Revision changed. Reload and retry.';
   if(value.response?.statusCode==410)return 'Telegram automation is disabled by server policy.';
   if(value.response?.statusCode==422)return 'Invalid credential alias or revision. Nothing changed.';
   if(value.type==DioExceptionType.connectionError||
      value.type==DioExceptionType.connectionTimeout)return 'Offline. Cannot change the account.';
  }
  return 'The authorized social-account service is unavailable. Retry.';
 }
 Future<void> _reload()async{
  final sequence=++epoch;
  setState((){loading=true;error=null;accounts=const[];notice=null;});
  try{
   final res=await widget.dio.get<Map<String,dynamic>>(
     '/v1/admin/masana/${Uri.encodeComponent(widget.characterId)}/social-accounts');
   final identities=res.data?['identities'];
   if(identities is! List)throw const FormatException('Invalid social account list');
   final telegram=identities.where((v)=>v is Map&&v['provider']=='telegram').map((v)=>
      TelegramStaffConnection.fromJson(Map<String,dynamic>.from(v as Map))).toList();
   if(!mounted||sequence!=epoch)return;
   setState((){loading=false;accounts=telegram;});
  }catch(e){
   if(mounted&&sequence==epoch)setState((){loading=false;error=_error(e);});
  }
 }
 Future<void> _control(TelegramStaffConnection item,String action)async{
  if(busy)return;
  final yes=await showDialog<bool>(context:context,builder:(ctx)=>AlertDialog(
   title:Text('${action=='revoke'?'Revoke':'Pause'} Telegram identity?'),
   content:const Text('The verified public link and permitted message handling may stop. This action is audited.'),
   actions:[TextButton(onPressed:()=>Navigator.pop(ctx,false),child:const Text('Cancel')),
    FilledButton(onPressed:()=>Navigator.pop(ctx,true),child:const Text('Confirm'))]));
  if(yes!=true||!mounted)return;
  final character=widget.characterId;
  setState((){busy=true;error=null;});
  try{
   await widget.dio.post<void>('/v1/admin/masana/${Uri.encodeComponent(character)}/social-accounts/'
      '${Uri.encodeComponent(item.id)}/$action',data:{'revision':item.revision});
   if(mounted&&character==widget.characterId){
    await _reload();
    if(mounted)setState(()=>notice='Server confirmed the audited account change.');
   }
  }catch(e){if(mounted)setState(()=>error=_error(e));}
  finally{if(mounted)setState(()=>busy=false);}
 }
 Future<void> _authorize(TelegramStaffConnection item)async{
  if(busy)return;
  final alias=credentialAlias.text.trim();
  if(!RegExp(r'^[A-Za-z0-9_-]{4,80}
  appBar:AppBar(title:const Text('Telegram · Masana accounts'),actions:[
   IconButton(tooltip:'Refresh',icon:const Icon(Icons.refresh),
     onPressed:busy||loading?null:_reload)]),
  body:ListView(padding:const EdgeInsets.all(16),children:[
   Text('Masana: ${widget.characterId}',style:Theme.of(context).textTheme.titleMedium),
   const SizedBox(height:10),
   const Text('Register and verify the official bot identity in Masana Social Accounts first. '
     'Link-only mode stays safe by default. An ops administrator must separately verify official '
     'Telegram API authorization, server-side token vault access, consent and an expiry. '
     'Do not paste bot tokens into this app.'),
   TextField(controller:credentialAlias,autocorrect:false,enableSuggestions:false,
    decoration:const InputDecoration(labelText:"Server-vault credential alias",
     helperText:"Alias only. Never paste bot tokens or private keys here.")),
   if(loading)const LinearProgressIndicator(),
   if(error!=null)Column(children:[Text(error!,style:TextStyle(color:Theme.of(context).colorScheme.error)),
     OutlinedButton(onPressed:_reload,child:const Text('Retry'))]),
   if(!loading&&error==null&&accounts.isEmpty)
     const Padding(padding:EdgeInsets.all(12),child:Text('No verified Telegram identity is configured.')),
   for(final account in accounts)Card(child:Padding(padding:const EdgeInsets.all(12),child:Column(
    crossAxisAlignment:CrossAxisAlignment.start,children:[
     Text(account.handle,style:Theme.of(context).textTheme.titleMedium),
     Text('State: ${account.state} · ${account.verified?'verified':'unverified'}'),
     Text(account.paused?'Paused: all messaging is disabled':
       account.mode=='verified_automation_eligible'?'Eligibility recorded; runtime still subject to server gate':
       'Link only: no automated messaging'),
     if(account.state!='revoked')Wrap(children:[
      if(account.verified&&account.state=='published'&&!account.paused)
       FilledButton(onPressed:busy?null:()=>_authorize(account),
        child:const Text('Validate official bot')),

      OutlinedButton(onPressed:busy||account.paused?null:()=>_control(account,'pause'),
        child:const Text('Pause')),
      TextButton(onPressed:busy?null:()=>_control(account,'revoke'),
        child:const Text('Revoke')),
     ]),
    ]))),
   if(notice!=null)Text(notice!),
  ]),
 );
}
).hasMatch(alias)){
   setState(()=>error="Choose an existing server-vault credential alias, never a bot token.");return;
  }
  final confirmed=await showDialog<bool>(context:context,builder:(ctx)=>AlertDialog(
   title:const Text("Authorize official Telegram Bot API?"),
   content:const Text("Server checks getMe, webhook ownership and an already stored credential. This action is audited and does not bypass the global messaging switch."),
   actions:[TextButton(onPressed:()=>Navigator.pop(ctx,false),child:const Text("Cancel")),
    FilledButton(onPressed:()=>Navigator.pop(ctx,true),child:const Text("Verify"))]));
  if(confirmed!=true||!mounted)return;
  final char=widget.characterId;
  setState((){busy=true;error=null;});
  try{
   await widget.dio.post<void>("/v1/admin/masana/${Uri.encodeComponent(char)}/telegram/"
     "${Uri.encodeComponent(item.id)}/authorize",data:{"revision":item.revision,"credentialAlias":alias});
   credentialAlias.clear();
   if(mounted&&char==widget.characterId){await _reload();
    if(mounted)setState(()=>notice="Official bot eligibility verified by server. Runtime may remain disabled.");}
  }catch(e){if(mounted)setState(()=>error=_error(e));}
  finally{if(mounted)setState(()=>busy=false);}
 }
 @override Widget build(BuildContext context)=>Scaffold(
  appBar:AppBar(title:const Text('Telegram · Masana accounts'),actions:[
   IconButton(tooltip:'Refresh',icon:const Icon(Icons.refresh),
     onPressed:busy||loading?null:_reload)]),
  body:ListView(padding:const EdgeInsets.all(16),children:[
   Text('Masana: ${widget.characterId}',style:Theme.of(context).textTheme.titleMedium),
   const SizedBox(height:10),
   const Text('Register and verify the official bot identity in Masana Social Accounts first. '
     'Link-only mode stays safe by default. An ops administrator must separately verify official '
     'Telegram API authorization, server-side token vault access, consent and an expiry. '
     'Do not paste bot tokens into this app.'),
   if(loading)const LinearProgressIndicator(),
   if(error!=null)Column(children:[Text(error!,style:TextStyle(color:Theme.of(context).colorScheme.error)),
     OutlinedButton(onPressed:_reload,child:const Text('Retry'))]),
   if(!loading&&error==null&&accounts.isEmpty)
     const Padding(padding:EdgeInsets.all(12),child:Text('No verified Telegram identity is configured.')),
   for(final account in accounts)Card(child:Padding(padding:const EdgeInsets.all(12),child:Column(
    crossAxisAlignment:CrossAxisAlignment.start,children:[
     Text(account.handle,style:Theme.of(context).textTheme.titleMedium),
     Text('State: ${account.state} · ${account.verified?'verified':'unverified'}'),
     Text(account.paused?'Paused: all messaging is disabled':
       account.mode=='verified_automation_eligible'?'Eligibility recorded; runtime still subject to server gate':
       'Link only: no automated messaging'),
     if(account.state!='revoked')Wrap(children:[
      OutlinedButton(onPressed:busy||account.paused?null:()=>_control(account,'pause'),
        child:const Text('Pause')),
      TextButton(onPressed:busy?null:()=>_control(account,'revoke'),
        child:const Text('Revoke')),
     ]),
    ]))),
   if(notice!=null)Text(notice!),
  ]),
 );
}
