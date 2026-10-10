import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

class MasanaSocialLink {
  const MasanaSocialLink({required this.provider,required this.handle,
    required this.publicUrl,required this.mode,required this.availability});
  final String provider,handle,publicUrl,mode,availability;
  factory MasanaSocialLink.fromJson(Map<String,dynamic> json)=>MasanaSocialLink(
    provider: json['provider'] as String,handle:json['handle'] as String,
    publicUrl:json['publicUrl'] as String,mode:json['mode'] as String,
    availability:json['availability'] as String,
  );
  /// Client-side allowlist complements the server's strict validation.
  Uri? get approvedUri {
    final uri=Uri.tryParse(publicUrl);
    if(uri==null || uri.scheme!='https' || uri.hasPort || uri.userInfo.isNotEmpty ||
       uri.hasQuery || uri.hasFragment) return null;
    const domains={
      'whatsapp':['wa.me'], 'telegram':['t.me','telegram.me'],
      'instagram':['instagram.com','www.instagram.com'],
      'facebook':['facebook.com','www.facebook.com','m.facebook.com'],
      'youtube':['youtube.com','www.youtube.com','youtu.be'],
      'tiktok':['tiktok.com','www.tiktok.com'],
      'x':['x.com','www.x.com','twitter.com','www.twitter.com'],
    };
    if(!(domains[provider]?.contains(uri.host.toLowerCase())??false))return null;
    if(provider=='whatsapp' && !RegExp(r'^/[1-9][0-9]{7,14}
    return uri;
  }
}
class MasanaSocialApi {
  MasanaSocialApi(this.dio);
  final Dio dio;
  Future<List<MasanaSocialLink>> list(String characterId) async {
    final response=await dio.get<Map<String,dynamic>>(
      '/v1/masana/${Uri.encodeComponent(characterId)}/social-links');
    final data=response.data?['links'];
    if(data is! List)throw const FormatException('Social links unavailable');
    return data.map((value)=>MasanaSocialLink.fromJson(
      Map<String,dynamic>.from(value as Map))).toList(growable:false);
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
  late Future<List<MasanaSocialLink>> future;
  String? notice;
  @override void initState(){super.initState();_reload();}
  @override void didUpdateWidget(covariant MasanaSocialLinks oldWidget){
    super.didUpdateWidget(oldWidget);
    if(oldWidget.characterId!=widget.characterId){_reload();}
  }
  void _reload(){setState((){notice=null;future=widget.loadLinks();});}
  Future<void> _open(MasanaSocialLink link) async {
    final uri=link.approvedUri;
    if(uri==null){setState(()=>notice='This external link is unavailable.');return;}
    bool ok=false;
    try{ok=await (widget.openLink?.call(uri) ??
      launchUrl(uri,mode:LaunchMode.externalApplication));}catch(_){ok=false;}
    if(!mounted)return;
    if(!ok)setState(()=>notice='Could not open the app. Try the web link.');
  }
  @override Widget build(BuildContext context)=>FutureBuilder<List<MasanaSocialLink>>(
    future:future,builder:(context,snapshot) {
      if(snapshot.connectionState!=ConnectionState.done){
        return Semantics(label:'Loading social links',child:LinearProgressIndicator());
      }
      if(snapshot.hasError){
        return Column(mainAxisSize:MainAxisSize.min,children:[
          const Text('Social accounts unavailable. Check your connection.'),
          TextButton(onPressed:_reload,child:const Text('Retry')),
        ]);
      }
      final links=snapshot.data??const <MasanaSocialLink>[];
      if(links.isEmpty)return const Text('No verified social accounts are published yet.');
      return Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
        const Text('Official social accounts',style:TextStyle(fontWeight:FontWeight.bold)),
        const Text('Opening these accounts uses an external service with its own privacy rules.'),
        for(final link in links)
          ListTile(
            contentPadding:EdgeInsets.zero,
            title:Text('${link.provider.toUpperCase()} · ${link.handle}'),
            subtitle:Text(link.availability=='link_only'?'Link only · no automated replies':
              link.availability=='manual_operator'?'Manual replies':'Authorized messaging'),
            trailing:const Icon(Icons.open_in_new),
            onTap:()=>_open(link),
          ),
        if(notice!=null) Text(notice!,style:TextStyle(color:Theme.of(context).colorScheme.error)),
      ]);
    });
}
).hasMatch(uri.path)){return null;}
    return uri;
  }
}
class MasanaSocialApi {
  MasanaSocialApi(this.dio);
  final Dio dio;
  Future<List<MasanaSocialLink>> list(String characterId) async {
    final response=await dio.get<Map<String,dynamic>>(
      '/v1/masana/${Uri.encodeComponent(characterId)}/social-links');
    final data=response.data?['links'];
    if(data is! List)throw const FormatException('Social links unavailable');
    return data.map((value)=>MasanaSocialLink.fromJson(
      Map<String,dynamic>.from(value as Map))).toList(growable:false);
  }
}
class MasanaSocialLinks extends StatefulWidget {
  const MasanaSocialLinks({super.key,required this.loadLinks,this.openLink});
  final Future<List<MasanaSocialLink>> Function() loadLinks;
  final Future<bool> Function(Uri)? openLink;
  @override State<MasanaSocialLinks> createState()=>_MasanaSocialLinksState();
}
class _MasanaSocialLinksState extends State<MasanaSocialLinks> {
  late Future<List<MasanaSocialLink>> future;
  String? notice;
  @override void initState(){super.initState();_reload();}
  void _reload(){setState((){notice=null;future=widget.loadLinks();});}
  Future<void> _open(MasanaSocialLink link) async {
    final uri=link.approvedUri;
    if(uri==null){setState(()=>notice='This external link is unavailable.');return;}
    bool ok=false;
    try{ok=await (widget.openLink?.call(uri) ??
      launchUrl(uri,mode:LaunchMode.externalApplication));}catch(_){ok=false;}
    if(!mounted)return;
    if(!ok)setState(()=>notice='Could not open the app. Try the web link.');
  }
  @override Widget build(BuildContext context)=>FutureBuilder<List<MasanaSocialLink>>(
    future:future,builder:(context,snapshot) {
      if(snapshot.connectionState!=ConnectionState.done){
        return Semantics(label:'Loading social links',child:LinearProgressIndicator());
      }
      if(snapshot.hasError){
        return Column(mainAxisSize:MainAxisSize.min,children:[
          const Text('Social accounts unavailable. Check your connection.'),
          TextButton(onPressed:_reload,child:const Text('Retry')),
        ]);
      }
      final links=snapshot.data??const <MasanaSocialLink>[];
      if(links.isEmpty)return const Text('No verified social accounts are published yet.');
      return Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
        const Text('Official social accounts',style:TextStyle(fontWeight:FontWeight.bold)),
        const Text('Opening these accounts uses an external service with its own privacy rules.'),
        for(final link in links)
          ListTile(
            contentPadding:EdgeInsets.zero,
            title:Text('${link.provider.toUpperCase()} · ${link.handle}'),
            subtitle:Text(link.availability=='link_only'?'Link only · no automated replies':
              link.availability=='manual_operator'?'Manual replies':'Authorized messaging'),
            trailing:const Icon(Icons.open_in_new),
            onTap:()=>_open(link),
          ),
        if(notice!=null) Text(notice!,style:TextStyle(color:Theme.of(context).colorScheme.error)),
      ]);
    });
}
