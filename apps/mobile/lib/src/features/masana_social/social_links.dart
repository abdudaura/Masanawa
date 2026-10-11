import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

/// Shared J21 social identity projection. Never exposes unverified account links.
class MasanaSocialLink {
 const MasanaSocialLink({required this.provider,required this.handle,
  required this.publicUrl,required this.mode,required this.availability});
 final String provider,handle,publicUrl,mode,availability;
 factory MasanaSocialLink.fromJson(Map<String,dynamic> j)=>MasanaSocialLink(
  provider:j['provider'] as String,handle:j['handle'] as String,
  publicUrl:j['publicUrl'] as String,mode:j['mode'] as String,
  availability:j['availability'] as String);
 Uri? get approvedUri {
  final url=Uri.tryParse(publicUrl);
  if(url==null||url.scheme!='https'||url.userInfo.isNotEmpty||url.hasPort||
      url.hasQuery||url.hasFragment||url.path.isEmpty||url.path=='/'||
      url.path.contains('\\')||url.path.contains('//')||
      RegExp(r'%2f|%5c|%2e|%00',caseSensitive:false).hasMatch(publicUrl))return null;
  const hosts=<String,List<String>>{
   'whatsapp':['wa.me'],'telegram':['t.me','telegram.me'],
   'instagram':['instagram.com','www.instagram.com'],
   'facebook':['facebook.com','www.facebook.com','m.facebook.com'],
   'youtube':['youtube.com','www.youtube.com','youtu.be'],
   'tiktok':['tiktok.com','www.tiktok.com'],
   'x':['x.com','www.x.com','twitter.com','www.twitter.com']
  };
  if(!(hosts[provider]?.contains(url.host.toLowerCase())??false))return null;
  if(provider=='whatsapp'&&!RegExp(r'^/[1-9][0-9]{7,14}$').hasMatch(url.path))return null;
  if(url.pathSegments.any((part)=>part.isEmpty||part=='.'||part=='..'))return null;
  return url;
 }
}
class MasanaSocialApi {
 MasanaSocialApi(this.dio);
 final Dio dio;
 Future<List<MasanaSocialLink>> list(String characterId)async{
  final response=await dio.get<Map<String,dynamic>>(
   '/v1/masana/${Uri.encodeComponent(characterId)}/social-links');
  final data=response.data?['links'];
  if(data is! List)throw const FormatException('Social links unavailable');
  return data.map((x)=>MasanaSocialLink.fromJson(Map<String,dynamic>.from(x as Map)))
   .where((x)=>x.approvedUri!=null).toList(growable:false);
 }
}
class MasanaSocialLinks extends StatefulWidget {
 const MasanaSocialLinks({super.key,required this.characterId,required this.loadLinks,this.openLink});
 final String characterId;
 final Future<List<MasanaSocialLink>> Function() loadLinks;
 final Future<bool> Function(Uri)? openLink;
 @override State<MasanaSocialLinks> createState()=>_MasanaSocialLinksState();
}
class _MasanaSocialLinksState extends State<MasanaSocialLinks> {
 Future<List<MasanaSocialLink>>? future;
 String? notice;
 int epoch=0;
 @override void initState(){super.initState();_reload();}
 @override void didUpdateWidget(covariant MasanaSocialLinks old){
  super.didUpdateWidget(old);
  if(old.characterId!=widget.characterId||old.loadLinks!=widget.loadLinks){
   epoch++;_reload();
  }
 }
 @override void dispose(){epoch++;super.dispose();}
 void _reload(){
  setState((){notice=null;future=widget.loadLinks();});
 }
 Future<void> _open(MasanaSocialLink link)async{
  final uri=link.approvedUri;
  if(uri==null){if(mounted)setState(()=>notice='This link is unavailable.');return;}
  final at=epoch;
  bool ok=false;
  try{ok=await(widget.openLink?.call(uri)??launchUrl(uri,mode:LaunchMode.externalApplication));}
  catch(_){ok=false;}
  if(!mounted||at!=epoch)return;
  setState(()=>notice=ok?'Opening the external service. Review its privacy policy.':
     'Could not open the app. Try the web link.');
 }
 @override Widget build(BuildContext context)=>FutureBuilder<List<MasanaSocialLink>>(
  key:ValueKey(widget.characterId),future:future,builder:(ctx,snapshot){
   if(snapshot.connectionState!=ConnectionState.done){
    return const LinearProgressIndicator(semanticsLabel:'Loading verified social accounts');
   }
   if(snapshot.hasError)return Column(mainAxisSize:MainAxisSize.min,children:[
    const Text('Social accounts unavailable. Check your connection.'),
    TextButton(onPressed:_reload,child:const Text('Retry')),
   ]);
   final links=(snapshot.data??const <MasanaSocialLink>[])
     .where((v)=>v.approvedUri!=null).toList();
   if(links.isEmpty)return const Text('No verified social accounts are published yet.');
   return Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
    const Text('Official social accounts',style:TextStyle(fontWeight:FontWeight.bold)),
    const Text('Opening these accounts uses an external service with its own privacy rules.'),
    for(final link in links)ListTile(contentPadding:EdgeInsets.zero,
     title:Text('${link.provider.toUpperCase()} · ${link.handle}'),
     subtitle:Text(link.availability=='link_only'?'Link only · no automated replies':
      link.availability=='manual_operator'?'Manual replies':'Authorized messaging'),
     trailing:const Icon(Icons.open_in_new),onTap:()=>_open(link)),
    if(notice!=null)Text(notice!,style:TextStyle(color:Theme.of(context).colorScheme.error)),
   ]);
  });
}
