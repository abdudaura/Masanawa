import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'device_security_client.dart';

/// C09. AF00 attaches from Settings; no offline session revocation is queued.
class DeviceSecurityScreen extends StatefulWidget {
  const DeviceSecurityScreen({super.key,required this.transport,
    this.onReauthenticate,this.onOpenRecovery});
  final FanDevicesTransport transport;
  final VoidCallback? onReauthenticate,onOpenRecovery;
  @override State<DeviceSecurityScreen> createState()=>_DeviceSecurityScreenState();
}
class _DeviceSecurityScreenState extends State<DeviceSecurityScreen> {
  List<FanDevice> items=[];
  String? error;
  final Map<String,String> retryKeys={};
  bool loading=true,offline=false,stepUpRequired=false,disabled=false;
  String? revoking;
  int generation=0;
  bool featureDisabled(DioException e) => e.response?.statusCode==503 &&
    e.response?.data is Map && (e.response!.data as Map)['code']=='feature_disabled';
  String t(String en,String ha)=>Localizations.localeOf(context).languageCode=='ha'?ha:en;
  @override void initState(){super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) { if(mounted)refresh(); });
  }
  @override void didUpdateWidget(covariant DeviceSecurityScreen old){
    super.didUpdateWidget(old);
    if(!identical(old.transport,widget.transport)||
      old.transport.ownerAccountId!=widget.transport.ownerAccountId||
      !widget.transport.isCurrentAccount){
      ++generation;items=[];retryKeys.clear();revoking=null;error=null;
      loading=true;offline=false;stepUpRequired=false;disabled=false;refresh();
    }
  }
  @override void dispose(){++generation;super.dispose();}
  Future<void> refresh()async{
    final ticket=++generation;
    if(!widget.transport.isCurrentAccount) {
      if(mounted)setState((){items=[];loading=false;error=t('Sign in to manage devices','Shiga domin sarrafa na’urori');});
      return;
    }
    setState((){loading=items.isEmpty;error=null;stepUpRequired=false;disabled=false;});
    try{
      final list=await widget.transport.list();
      if(!mounted||ticket!=generation||!widget.transport.isCurrentAccount)return;
      setState((){items=list;loading=false;offline=false;disabled=false;});
    }on DioException catch(e){
      if(!mounted||ticket!=generation)return;
      setState((){
        loading=false;
        disabled=featureDisabled(e);
        offline=!disabled && (e.type==DioExceptionType.connectionError||
          e.type==DioExceptionType.connectionTimeout);
        error=disabled?null:
          (e.response?.statusCode==401||e.response?.statusCode==403)?
          t('Session expired. Sign in again.','Lokaci ya kare. Sake shiga.'):
          t('Unable to load devices. Retry.','An kasa dauko na’urori. Sake gwadawa.');
      });
    }catch(_){
      if(mounted&&ticket==generation)setState((){
        loading=false;error=t('Unable to load devices. Retry.','An kasa dauko na’urori. Sake gwadawa.');});
    }
  }
  Future<void> revoke(FanDevice device)async{
    if(revoking!=null||device.current||offline||disabled||!widget.transport.isCurrentAccount)return;
    final confirmed=await showDialog<bool>(context:context,builder:(ctx)=>AlertDialog(
      title:Text(t('Sign out this device?','A fitar da wannan na’ura?')),
      content:Text(t('The other session will lose access. You can sign in again later.',
        'Za a fitar da wannan na’ura. Ana iya sake shiga daga baya.')),
      actions:[
        TextButton(onPressed:()=>Navigator.pop(ctx,false),child:Text(t('Cancel','Soke'))),
        FilledButton(onPressed:()=>Navigator.pop(ctx,true),child:Text(t('Sign out','Fita')))]));
    if(confirmed!=true||!mounted||!widget.transport.isCurrentAccount)return;
    final ticket=generation;
    final key=retryKeys.putIfAbsent(device.id,()=>
      'c09_${DateTime.now().microsecondsSinceEpoch}_${device.id.substring(0,8)}');
    setState((){revoking=device.id;error=null;});
    try{
      await widget.transport.revoke(device.id,key);
      if(!mounted||ticket!=generation||!widget.transport.isCurrentAccount)return;
      retryKeys.remove(device.id);await refresh();
    }on DioException catch(e){
      if(mounted&&ticket==generation)setState(() {
        disabled=featureDisabled(e);
        stepUpRequired=!disabled && e.response?.statusCode==428;
        error=disabled?null:stepUpRequired?
          t('Verify again to sign out another device. A new one-time code is required.',
            'Sake tabbatarwa don fitar da wata na’ura. Ana bukatar sabon lamba.'):
        e.response?.statusCode==401||e.response?.statusCode==403?
          t('Session expired. Sign in again.','Lokaci ya kare. Sake shiga.'):
          t('Could not sign out device. Retry is safe.','An kasa fitar da na’ura. Sake gwadawa ya dace.');});
    }catch(_){
      if(mounted&&ticket==generation)setState(()=>
        error=t('Could not sign out device. Retry is safe.','An kasa fitar da na’ura. Sake gwadawa ya dace.'));
    }finally{if(mounted&&ticket==generation)setState(()=>revoking=null);}
  }
  @override Widget build(BuildContext context){
    if(!widget.transport.isCurrentAccount)return Scaffold(appBar:AppBar(
      title:Text(t('Device security','Tsaron na’ura'))),
      body:Center(child:Text(t('Sign in to manage devices','Shiga domin sarrafa na’urori'))));
    return Scaffold(appBar:AppBar(title:Text(t('Device security','Tsaron na’ura')),
      actions:[IconButton(tooltip:t('Refresh','Sabunta'),icon:const Icon(Icons.refresh),
        onPressed:revoking==null?refresh:null)]),
      body:Column(children:[
        if(offline)MaterialBanner(content:Text(t('Offline. Signing out requires a connection.',
          'Babu intanet. Ana bukatar intanet domin fita.')),
          actions:[TextButton(onPressed:refresh,child:Text(t('Retry','Sake gwadawa')))]),
        if(error!=null)MaterialBanner(content:Text(error!),
          actions:[TextButton(onPressed:refresh,child:Text(t('Retry','Sake gwadawa')))]),
        if(stepUpRequired)Padding(padding:const EdgeInsets.all(12),
          child:Column(children:[
            FilledButton.icon(onPressed:widget.onReauthenticate,
              icon:const Icon(Icons.verified_user_outlined),
              label:Text(t('Verify with a one-time code','Tabbatar da lamba'))),
            TextButton(onPressed:widget.onOpenRecovery,
              child:Text(t('Need account recovery? Ask Gwani','Kana bukatar taimako? Tambayi Gwani'))),
          ])),
        Expanded(child:loading?const Center(child:CircularProgressIndicator()):
          disabled?Center(child:Padding(padding:const EdgeInsets.all(20),
            child:Text(t('Device security is temporarily unavailable.',
              'Ba a samun tsaron na’ura a yanzu.')))):
          items.isEmpty?Center(child:Text(t('No active devices.','Babu na’urar da ke aiki.'))):
          ListView.builder(itemCount:items.length,itemBuilder:(context,index){
            final d=items[index];
            return ListTile(key:ValueKey('device-${d.id}'),
              leading:const Icon(Icons.phone_android_outlined),
              title:Text(d.current?t('This device','Wannan na’ura'):
                t('Signed-in device','Na’urar da ta shiga')),
              subtitle:Text('${t('Last active','An yi aiki')}: ${d.lastSeenAt.toLocal()}'),
              trailing:d.current?Text(t('Current','Yanzu')):
                revoking==d.id?const SizedBox.square(dimension:20,
                  child:CircularProgressIndicator(strokeWidth:2)):
                TextButton(onPressed:revoking==null&&!offline&&!disabled?()=>revoke(d):null,
                  child:Text(t('Sign out','Fita'))),
            );
          })),
      ]));
  }
}
