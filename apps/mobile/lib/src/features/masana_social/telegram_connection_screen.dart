import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

/// C44/C78/C79: one existing verified public-social projection, no second
/// Telegram credential store or in-app fan-to-fan messaging authority.
class TelegramPublicConnection {
 const TelegramPublicConnection(this.name, this.uri, this.mode, this.availability);
 final String name, mode, availability;
 final Uri uri;
 static TelegramPublicConnection? fromJson(Object? raw) {
  if(raw is! Map)return null;
  final item=Map<String,dynamic>.from(raw);
  if(item['provider']!='telegram'||item['handle'] is! String)return null;
  final link=item['publicUrl'];
  if(link is! String)return null;
  final url=Uri.tryParse(link);
  if(url==null||url.scheme!='https'||!['t.me','telegram.me'].contains(url.host.toLowerCase())||
     url.userInfo.isNotEmpty||url.hasPort||url.hasQuery||url.hasFragment||
     url.pathSegments.isEmpty||url.pathSegments.any((v)=>v.isEmpty||v=='..'))return null;
  final availability=item['availability'];
  if(!['link_only','manual_operator','available'].contains(availability))return null;
  return TelegramPublicConnection(item['handle'] as String,url,
    item['mode'] is String?item['mode'] as String:'profile_link_only',
    availability as String);
 }
}

class MasanaTelegramScreen extends StatefulWidget {
 const MasanaTelegramScreen({super.key,required this.characterId,required this.dio,
   this.openExternal});
 final String characterId;
 final Dio dio;
 final Future<bool> Function(Uri)? openExternal;
 @override State<MasanaTelegramScreen> createState()=>_MasanaTelegramScreenState();
}
class _MasanaTelegramScreenState extends State<MasanaTelegramScreen> {
 bool loading=true,offline=false;
 String? error,notice;
 TelegramPublicConnection? connection;
 int requestEpoch=0;
 @override void initState(){super.initState();_refresh();}
 @override void didUpdateWidget(covariant MasanaTelegramScreen old) {
  super.didUpdateWidget(old);
  if(old.characterId!=widget.characterId||old.dio!=widget.dio) {
   requestEpoch++;connection=null;notice=null;_refresh();
  }
 }
 @override void dispose(){requestEpoch++;super.dispose();}
 Future<void> _refresh() async {
  final epoch=++requestEpoch;
  setState((){loading=true;offline=false;error=null;connection=null;});
  try {
   final res=await widget.dio.get<Map<String,dynamic>>(
    '/v1/masana/${Uri.encodeComponent(widget.characterId)}/social-links');
   final entries=res.data?['links'];
   if(entries is! List)throw const FormatException('Invalid social account projection');
   TelegramPublicConnection? verified;
   for(final record in entries){
    verified=TelegramPublicConnection.fromJson(record);
    if(verified!=null)break;
   }
   if(!mounted||epoch!=requestEpoch)return;
   setState((){connection=verified;loading=false;});
  }catch(e) {
   if(!mounted||epoch!=requestEpoch)return;
   final lost=e is DioException&&(e.type==DioExceptionType.connectionError||
       e.type==DioExceptionType.connectionTimeout||e.type==DioExceptionType.receiveTimeout);
   setState((){loading=false;offline=lost;error=lost
     ? 'Offline. No verified Telegram connection is available from cached data.'
     : 'Could not verify this Masana Telegram account. Retry.';});
  }
 }
 Future<void> _open() async {
  final url=connection?.uri;
  if(url==null)return;
  try{
   final opened=await(widget.openExternal?.call(url)??launchUrl(url,mode:LaunchMode.externalApplication));
   if(mounted)setState(()=>notice=opened?'You are opening Telegram. Telegram has its own privacy rules.'
      :'Telegram could not open; check whether it is installed.');
  }catch(_){
   if(mounted)setState(()=>notice='External app unavailable. Retry or use a browser.');
  }
 }
 @override Widget build(BuildContext context)=>Scaffold(
  appBar:AppBar(title:const Text('Masana on Telegram'),actions:[
   IconButton(onPressed:loading?null:_refresh,tooltip:'Refresh',icon:const Icon(Icons.refresh))
  ]),
  body:ListView(padding:const EdgeInsets.all(16),children:[
   if(loading)const Center(child:CircularProgressIndicator()),
   if(error!=null)Column(children:[
    Text(error!,style:TextStyle(color:Theme.of(context).colorScheme.error)),
    const SizedBox(height:8),
    OutlinedButton(onPressed:_refresh,child:const Text('Retry')),
   ]),
   if(!loading&&error==null&&connection==null)
    const Text('This Masana has no verified published Telegram account yet.'),
   if(connection!=null)...[
    Text(connection!.name,style:Theme.of(context).textTheme.titleLarge),
    const SizedBox(height:8),
    Text(connection!.availability=='available'?'Authorized bot messaging is available':
      connection!.availability=='manual_operator'?'Messages are managed by staff':
      'Official profile link only; automatic replies are disabled'),
    const SizedBox(height:12),
    const Text('Telegram is a separate service. Only use the official account link and review its privacy policy.'),
    const Text('For automated replies, start the bot and opt in explicitly using /agree. Send /stop to revoke.'),
    const SizedBox(height:18),
    FilledButton.icon(onPressed:_open,icon:const Icon(Icons.open_in_new),
      label:const Text('Open verified Telegram account')),
   ],
   if(notice!=null)Padding(padding:const EdgeInsets.only(top:14),child:Text(notice!)),
   if(offline)const Text('No stale account or personal data is displayed while offline.'),
  ]),
 );
}
