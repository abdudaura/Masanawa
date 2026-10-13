import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';
import 'package:audio_session/audio_session.dart';
import 'feed_media_api.dart';

typedef OriginalMediaRenderer = Widget Function(FeedMediaGrant grant);

/// C23: read-only approved original image/audio, never an external video embed.
/// AF00 injects the existing shared audio focus owner via onBeforeAudio.
class FeedMediaScreen extends StatefulWidget {
  const FeedMediaScreen({super.key,required this.api,required this.accountKey,
    required this.postId,required this.mediaIds,required this.kind,
    this.initialMediaId,this.onBeforeAudio,this.mediaRenderer,this.enabled=true});
  final FeedMediaApi api;
  final String accountKey,postId,kind;
  final List<String> mediaIds;
  final String? initialMediaId;
  final Future<void> Function()? onBeforeAudio;
  final OriginalMediaRenderer? mediaRenderer;
  final bool enabled;
  @override State<FeedMediaScreen> createState()=>_FeedMediaScreenState();
}
class _FeedMediaScreenState extends State<FeedMediaScreen>
    with WidgetsBindingObserver {
  late final AudioPlayer player=AudioPlayer();
  late int index;
  FeedMediaGrant? grant;
  String? error;
  bool loading=false,offline=false,starting=false;
  int generation=0;
  StreamSubscription<AudioInterruptionEvent>? _interruptions;
  StreamSubscription<void>? _becomingNoisy;
  String tr(String en,String ha)=>Localizations.localeOf(context).languageCode=='ha'?ha:en;
  @override void initState(){
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    unawaited(_listenForAudioInterruptions());
    final requested=widget.mediaIds.indexOf(widget.initialMediaId??'');
    index=requested<0?0:requested;
    WidgetsBinding.instance.addPostFrameCallback((_){if(mounted)load();});
  }
  Future<void> _listenForAudioInterruptions() async {
    final session=await AudioSession.instance;
    if(!mounted)return;
    _interruptions=session.interruptionEventStream.listen((event) {
      if(event.begin) unawaited(player.pause());
    });
    _becomingNoisy=session.becomingNoisyEventStream.listen((_) {
      unawaited(player.pause());
    });
  }
  @override void didUpdateWidget(covariant FeedMediaScreen old){
    super.didUpdateWidget(old);
    if(widget.accountKey!=old.accountKey||widget.api!=old.api||
        widget.postId!=old.postId||widget.kind!=old.kind||
        widget.mediaIds.join('|')!=old.mediaIds.join('|')){
      generation++;
      unawaited(player.stop());
      index=0;grant=null;error=null;offline=false;
      load();
    }else if(!old.enabled&&widget.enabled){load();}
    if(old.enabled&&!widget.enabled){generation++;unawaited(player.stop());grant=null;}
  }
  @override void didChangeAppLifecycleState(AppLifecycleState state){
    if(state!=AppLifecycleState.resumed)unawaited(player.pause());
  }
  Future<void> load() async {
    if(!mounted||!widget.enabled||widget.mediaIds.isEmpty)return;
    final ticket=++generation,mediaId=widget.mediaIds[index];
    unawaited(player.stop());
    setState((){grant=null;error=null;loading=true;offline=false;});
    try{
      final result=await widget.api.getGrant(widget.postId,mediaId);
      if(!mounted||ticket!=generation)return;
      if(result.mediaId!=mediaId||result.kind!=widget.kind)throw const FormatException('Mismatched media grant');
      setState((){grant=result;loading=false;});
    }catch(e){
      if(!mounted||ticket!=generation)return;
      final status=e is DioException?e.response?.statusCode:null;
      setState((){loading=false;offline=e is DioException&&(
        e.type==DioExceptionType.connectionError||e.type==DioExceptionType.connectionTimeout);
        error=status==401||status==403?tr('Access denied. Sign in again.','Ba a ba da izini ba. Sake shiga.'):
          status==404||status==410?tr('This media is no longer available.','Babu wannan hoton ko sautin yanzu.'):
          tr('Could not open media.','An kasa bude hoton ko sautin.');});
    }
  }
  Future<void> play() async {
    if(starting||widget.onBeforeAudio==null||grant==null||grant!.kind!='audio')return;
    final current=grant!,ticket=generation;
    setState(()=>starting=true);
    try{
      await widget.onBeforeAudio!();
      if(!mounted||ticket!=generation)return;
      if(current.expiresAt.isBefore(DateTime.now().add(const Duration(seconds:10)))){await load();return;}
      await player.setUrl(current.url.toString());
      if(!mounted||ticket!=generation){await player.stop();return;}
      unawaited(player.play().catchError((Object _) {
        if(mounted&&ticket==generation)setState(()=>error=tr('Audio playback failed. Try again.','An kasa kunna sauti. Sake gwadawa.'));
      }));
    }catch(_){
      if(mounted&&ticket==generation)setState(()=>
        error=tr('Audio playback failed. Try again.','An kasa kunna sauti. Sake gwadawa.'));
    }finally{if(mounted&&ticket==generation)setState(()=>starting=false);}
  }
  void select(int next){
    if(next<0||next>=widget.mediaIds.length||next==index)return;
    index=next;load();
  }
  @override void dispose(){
    generation++;WidgetsBinding.instance.removeObserver(this);
    unawaited(_interruptions?.cancel());
    unawaited(_becomingNoisy?.cancel());
    unawaited(player.dispose());super.dispose();
  }
  @override Widget build(BuildContext context){
    if(!widget.enabled)return Scaffold(appBar:AppBar(),body:Center(
      child:Text(tr('Media is unavailable right now.','Ba a samun hotuna ko sauti a yanzu.'))));
    return Scaffold(
      appBar:AppBar(title:Text(tr('Masana media','Hotuna da sautin Masana'))),
      body:SafeArea(child:widget.mediaIds.isEmpty
        ?Center(child:Text(tr('No media on this post.','Babu hoto ko sauti a wannan sakon.')))
        :Column(children:[
          Expanded(child:Center(child:loading
            ?const CircularProgressIndicator()
            :error!=null?Column(mainAxisSize:MainAxisSize.min,children:[
              Icon(offline?Icons.wifi_off:Icons.broken_image_outlined,size:40),
              const SizedBox(height:8),Text(error!,textAlign:TextAlign.center),
              TextButton(onPressed:load,child:Text(tr('Retry','Sake gwadawa')))])
            :grant==null?const SizedBox.shrink()
            :widget.mediaRenderer?.call(grant!)??(grant!.kind=='image'
              ?InteractiveViewer(minScale:1,maxScale:4,child:Image.network(
                grant!.url.toString(),fit:BoxFit.contain,
                errorBuilder:(_,__,___)=>Text(tr('Image failed to load. Retry.',
                  'An kasa nuna hoton. Sake gwadawa.'))))
              :Column(mainAxisSize:MainAxisSize.min,children:[
                const Icon(Icons.graphic_eq,size:64),
                StreamBuilder<PlayerState>(stream:player.playerStateStream,
                  builder:(ctx,snapshot)=>FilledButton.icon(
                    onPressed:widget.onBeforeAudio==null||starting?null:
                      snapshot.data?.playing==true?()=>unawaited(player.pause()):play,
                    icon:Icon(snapshot.data?.playing==true?Icons.pause:Icons.play_arrow),
                    label:Text(snapshot.data?.playing==true?tr('Pause','Dakatar'):
                      tr('Play audio','Kunna sauti')))),
                StreamBuilder<Duration>(stream:player.positionStream,builder:(ctx,snapshot){
                  final total=player.duration??Duration.zero;
                  final position=snapshot.data??Duration.zero;
                  final max=total.inMilliseconds.toDouble().clamp(1.0,double.infinity).toDouble();
                  return Slider(value:position.inMilliseconds.toDouble().clamp(0.0,max).toDouble(),
                    max:max,onChanged:widget.onBeforeAudio==null?null:
                      (value)=>unawaited(player.seek(Duration(milliseconds:value.round()))));
                }),
                Wrap(spacing:8,children:[
                  for(final speed in [1.0,1.5,2.0])
                    TextButton(onPressed:()=>player.setSpeed(speed),
                      child:Text('${speed}x')),
                ]),
                if(grant!.transcript!=null&&grant!.transcript!.trim().isNotEmpty)
                  Semantics(label:tr('Audio transcript','Rubutaccen sauti'),
                    child:Padding(padding:const EdgeInsets.all(16),
                      child:SelectableText(grant!.transcript!))),
                if(widget.onBeforeAudio==null)
                  Text(tr('Audio player unavailable.','Ba a samun mai kunna sauti.')),
              ])))),
          if(widget.mediaIds.length>1)Padding(
            padding:const EdgeInsets.all(8),child:Row(mainAxisAlignment:MainAxisAlignment.center,children:[
              IconButton(tooltip:tr('Previous','Na baya'),onPressed:index==0?null:()=>select(index-1),
                icon:const Icon(Icons.chevron_left)),
              Text('${index+1} / ${widget.mediaIds.length}'),
              IconButton(tooltip:tr('Next','Na gaba'),
                onPressed:index==widget.mediaIds.length-1?null:()=>select(index+1),
                icon:const Icon(Icons.chevron_right)),
            ]))
        ])),
    );
  }
}
