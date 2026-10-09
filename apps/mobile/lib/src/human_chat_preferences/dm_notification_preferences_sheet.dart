import 'package:flutter/material.dart';
import 'dm_notification_preferences.dart';

/// C02 human-only Chats sheet. F12 mounts it without changing the five-tab shell.
class DmNotificationPreferencesSheet extends StatefulWidget {
  const DmNotificationPreferencesSheet({super.key,required this.accountKey,
    required this.authorizationHeader,required this.conversationId,required this.controller});
  final String accountKey,authorizationHeader,conversationId;
  final DmNotificationPreferencesController controller;
  @override
  State<DmNotificationPreferencesSheet> createState()=>_DmNotificationPreferencesSheetState();
}
class _DmNotificationPreferencesSheetState extends State<DmNotificationPreferencesSheet> {
  DmMuteMode mute=DmMuteMode.off;
  DmPreviewMode preview=DmPreviewMode.hidden;
  DateTime? until;
  @override
  void initState(){super.initState();widget.controller.addListener(sync);refresh();}
  void refresh(){widget.controller.load(accountKey:widget.accountKey,
    authorizationHeader:widget.authorizationHeader,conversationId:widget.conversationId);}
  void sync(){
    if(!mounted)return;
    final value=widget.controller.current;
    if(value!=null&&widget.controller.state==DmPreferenceState.ready){
      mute=value.mute;preview=value.preview;until=value.until;
    }
    setState((){});
  }
  @override
  void didUpdateWidget(covariant DmNotificationPreferencesSheet old){
    super.didUpdateWidget(old);
    if(old.controller!=widget.controller){old.controller.removeListener(sync);widget.controller.addListener(sync);}
    if(old.accountKey!=widget.accountKey||old.conversationId!=widget.conversationId||
       old.authorizationHeader!=widget.authorizationHeader){widget.controller.clear();refresh();}
  }
  @override
  void dispose(){widget.controller.removeListener(sync);super.dispose();}
  @override
  Widget build(BuildContext context){
    final state=widget.controller.state,ready=state==DmPreferenceState.ready;
    return SafeArea(child:Padding(padding:const EdgeInsets.all(16),
      child:SingleChildScrollView(child:Column(mainAxisSize:MainAxisSize.min,
        crossAxisAlignment:CrossAxisAlignment.start,children:[
        Text('Chat notifications',style:Theme.of(context).textTheme.titleLarge),
        const SizedBox(height:8),
        const Text('Mute only this private human chat. Push notifications never include sender names or message text.'),
        if(state==DmPreferenceState.loading||state==DmPreferenceState.saving)const LinearProgressIndicator(),
        if(state==DmPreferenceState.forbidden)const Text('This conversation is no longer available.'),
        if(widget.controller.errorCode!=null)Text(widget.controller.errorCode!),
        if(ready)...[
          const SizedBox(height:12),
          DropdownButtonFormField<DmMuteMode>(initialValue:mute,decoration:const InputDecoration(labelText:'Mute messages'),
            items:const [
              DropdownMenuItem(value:DmMuteMode.off,child:Text('Unmuted')),
              DropdownMenuItem(value:DmMuteMode.until,child:Text('Mute for 8 hours')),
              DropdownMenuItem(value:DmMuteMode.forever,child:Text('Mute until I turn it off'))
            ],onChanged:(v)=>setState((){
              mute=v??DmMuteMode.off;
              until=mute==DmMuteMode.until?DateTime.now().toUtc().add(const Duration(hours:8)):null;
            })),
          SwitchListTile(contentPadding:EdgeInsets.zero,title:const Text('Allow generic preview'),
            subtitle:const Text('Never displays the sender or private content on the lock screen.'),
            value:preview==DmPreviewMode.generic,
            onChanged:(v)=>setState((){preview=v?DmPreviewMode.generic:DmPreviewMode.hidden;})),
        ],
        const SizedBox(height:12),
        Row(children:[
          OutlinedButton(onPressed:state==DmPreferenceState.saving?null:refresh,child:const Text('Reload')),
          const SizedBox(width:12),
          FilledButton(onPressed:!ready?null:()=>widget.controller.save(accountKey:widget.accountKey,
            authorizationHeader:widget.authorizationHeader,conversationId:widget.conversationId,
            mute:mute,preview:preview,until:until),child:const Text('Save')),
        ]),
      ]))));
  }
}
