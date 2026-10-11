import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'fan_setup_repository.dart';

/// C04/J01, mounted by the existing auth shell after signup.
class FanSetupScreen extends StatefulWidget {
 const FanSetupScreen({super.key,required this.accountKey,required this.repository,
   required this.onComplete,this.onSignIn,this.onChooseVerifiedAvatar});
 final String accountKey;
 final FanSetupRepository repository;
 final VoidCallback onComplete;
 final VoidCallback? onSignIn;
 final Future<String?> Function()? onChooseVerifiedAvatar;
 @override State<FanSetupScreen> createState()=>_FanSetupScreenState();
}
class _FanSetupScreenState extends State<FanSetupScreen> {
 final name=TextEditingController();
 final picked=<String>{};
 final followed=<String>{};
 static const interests=['technology','learning','creative','business','wellbeing'];
 static const labels=<String,List<String>>{
  'title':['Welcome to Masanawa','Barka da zuwa Masanawa'],
  'name':['Display name','Sunan da za a nuna'],
  'language':['Language','Harshe'],
  'interests':['Interests','Abubuwan sha’awa'],
  'age':['I confirm I am at least 18.','Na tabbatar na kai shekara 18.'],
  'ai':['Masana are AI characters created by Masanawa. I understand.','Masana jaruman AI ne da Masanawa ta kirkira. Na fahimta.'],
  'save':['Save and continue','Ajiye ka ci gaba'],
  'retry':['Retry','Sake gwadawa'],
  'finish':['Continue to Home','Ci gaba zuwa Gida'],
  'follow':['Follow','Bi'],
  'following':['Following','Ana bi'],
  'suggestions':['Suggested Masana','Masana da aka ba da shawara'],
  'none':['No suggestions now. You can continue.','Babu shawarwari yanzu. Kana iya ci gaba.'],
  'avatar':['Choose photo (optional)','Zaɓi hoto (na zaɓi)'],
  'avatarOff':['Photo upload unavailable','Ba a iya loda hoto yanzu'],
  'required':['Confirm you are 18+ and accept the AI disclosure.','Tabbatar shekarunka da sanarwar AI.'],
  'nameInvalid':['Enter a name of 2–60 characters.','Rubuta suna mai haruffa 2–60.'],
  'offline':['Offline. Retry when connected.','Babu intanet. Sake gwadawa.'],
  'unauthorized':['Please sign in again.','Da fatan sake shiga.'],
  'disabled':['Setup is not available yet.','Ba a buɗe saitin asusu ba.'],
  'stale':['Account changed. Reload and retry.','An sauya asusu. Sake ɗaukowa.'],
  'error':['Could not load or save. Retry.','Ba a iya ɗaukowa ko ajiyewa ba. Sake gwadawa.'],
 };
 int generation=0;
 bool loading=true,saving=false,age=false,disclosed=false,completed=false,loadingSuggestions=false;
 String language='en';
 String? avatarId,error,notice;
 FanProfile? profile;
 List<FollowSuggestion> suggestions=const [];
 String t(String key)=>labels[key]![language=='ha'?1:0];
 @override void initState(){super.initState();load();}
 @override void didUpdateWidget(covariant FanSetupScreen previous){
  super.didUpdateWidget(previous);
  if(previous.accountKey!=widget.accountKey||previous.repository!=widget.repository){
   generation++;profile=null;completed=false;picked.clear();followed.clear();
   suggestions=const [];name.clear();age=false;disclosed=false;avatarId=null;
   language='en';notice=null;error=null;load();
  }
 }
 String explain(Object e){
  if(e is DioException){
   switch(e.response?.statusCode){
    case 401:case 403:return t('unauthorized');
    case 503:return t('disabled');
    case 409:return t('stale');
   }
   if(e.response==null)return t('offline');
  }
  return t('error');
 }
 Future<void> load() async{
  final token=++generation;
  setState((){loading=true;error=null;});
  if(widget.accountKey.isEmpty){
   setState((){loading=false;error=t('unauthorized');});return;
  }
  try{
   final value=await widget.repository.read();
   if(!mounted||token!=generation)return;
   setState((){
    loading=false;profile=value;completed=value.completed;
    name.text=value.displayName??'';language=value.language;
    avatarId=value.avatarMediaId;picked..clear()..addAll(value.interests);
   });
   if(value.completed)loadSuggestions(token);
  }catch(e){
   if(mounted&&token==generation)setState((){loading=false;error=explain(e);});
  }
 }
 Future<void> loadSuggestions(int token) async{
  setState(()=>loadingSuggestions=true);
  try{
   final data=await widget.repository.suggestions();
   if(mounted&&token==generation)setState(()=>suggestions=data);
  }catch(e){
   if(mounted&&token==generation)setState(()=>notice=explain(e));
  }finally{
   if(mounted&&token==generation)setState(()=>loadingSuggestions=false);
  }
 }
 Future<void> chooseAvatar() async{
  final pick=widget.onChooseVerifiedAvatar;
  if(pick==null)return;
  final token=generation;
  try{
   final result=await pick();
   if(mounted&&token==generation&&result!=null)setState(()=>avatarId=result);
  }catch(e){if(mounted&&token==generation)setState(()=>notice=explain(e));}
 }
 Future<void> save() async{
  if(saving||profile==null)return;
  if(name.text.trim().length<2||name.text.trim().length>60){
   setState(()=>error=t('nameInvalid'));return;
  }
  if(!age||!disclosed){setState(()=>error=t('required'));return;}
  final token=generation;
  setState((){saving=true;error=null;});
  try{
   final value=await widget.repository.save(FanSetupDraft(
    expectedRevision:profile!.revision,displayName:name.text.trim(),
    language:language,interests:picked.toList()..sort(),
    ageConfirmed:age,disclosureAccepted:disclosed,avatarMediaId:avatarId));
   if(!mounted||token!=generation)return;
   setState((){profile=value;completed=true;saving=false;});
   loadSuggestions(token);
  }catch(e){if(mounted&&token==generation)setState((){saving=false;error=explain(e);});}
 }
 Future<void> follow(FollowSuggestion value) async{
  if(followed.contains(value.characterId))return;
  final token=generation;
  try{
   await widget.repository.follow(value.characterId);
   if(mounted&&token==generation)setState(()=>followed.add(value.characterId));
  }catch(e){if(mounted&&token==generation)setState(()=>notice=explain(e));}
 }
 @override void dispose(){generation++;name.dispose();super.dispose();}
 @override Widget build(BuildContext context){
  final theme=Theme.of(context);
  return Scaffold(appBar:AppBar(title:Text(t('title'))),
   body:SafeArea(child:ListView(padding:const EdgeInsets.all(16),children:[
    if(loading)const Center(key:Key('fan-loading'),child:CircularProgressIndicator()),
    if(!loading&&profile==null)...[
     Text(error??t('error'),key:const Key('fan-error')),
     TextButton(onPressed:widget.accountKey.isEmpty?widget.onSignIn:load,
       child:Text(t('retry'))),
    ],
    if(!loading&&profile!=null&&!completed)...[
     TextField(key:const Key('fan-name'),controller:name,maxLength:60,
       decoration:InputDecoration(labelText:t('name'))),
     DropdownButtonFormField<String>(key:const Key('fan-language'),initialValue:language,
      decoration:InputDecoration(labelText:t('language')),
      items:const [DropdownMenuItem(value:'en',child:Text('English')),
        DropdownMenuItem(value:'ha',child:Text('Hausa'))],
      onChanged:saving?null:(v)=>setState(()=>language=v??'en')),
     const SizedBox(height:12),Text(t('interests')),
     Wrap(spacing:8,runSpacing:4,children:[
      for(final interest in interests)
       FilterChip(label:Text(interest),selected:picked.contains(interest),
        onSelected:saving?null:(checked)=>setState((){
         if(checked&&picked.length<5)picked.add(interest);
         if(!checked)picked.remove(interest);
        })),
     ]),
     const SizedBox(height:12),
     OutlinedButton.icon(onPressed:widget.onChooseVerifiedAvatar==null?null:chooseAvatar,
      icon:const Icon(Icons.person_outline),label:Text(t('avatar'))),
     if(widget.onChooseVerifiedAvatar==null)Text(t('avatarOff'),
       style:theme.textTheme.bodySmall),
     CheckboxListTile(key:const Key('fan-age'),value:age,
      contentPadding:EdgeInsets.zero,title:Text(t('age')),
      onChanged:saving?null:(v)=>setState(()=>age=v==true)),
     CheckboxListTile(key:const Key('fan-ai'),value:disclosed,
      contentPadding:EdgeInsets.zero,title:Text(t('ai')),
      onChanged:saving?null:(v)=>setState(()=>disclosed=v==true)),
     if(error!=null)Text(error!,style:TextStyle(color:theme.colorScheme.error)),
     FilledButton(key:const Key('fan-save'),onPressed:saving?null:save,
      child:saving?const CircularProgressIndicator():Text(t('save'))),
    ],
    if(!loading&&completed)...[
     Text(t('suggestions'),style:theme.textTheme.titleLarge),
     if(loadingSuggestions)const LinearProgressIndicator(),
     if(!loadingSuggestions&&suggestions.isEmpty)Text(t('none')),
     for(final value in suggestions)ListTile(
      title:Text(value.name),subtitle:Text(value.profession),
      trailing:OutlinedButton(key:Key('fan-follow-${value.characterId}'),
       onPressed:followed.contains(value.characterId)?null:()=>follow(value),
       child:Text(t(followed.contains(value.characterId)?'following':'follow')))),
     FilledButton(key:const Key('fan-finish'),onPressed:widget.onComplete,
      child:Text(t('finish'))),
    ],
    if(notice!=null)Text(notice!,style:TextStyle(color:theme.colorScheme.error)),
   ])),
  );
 }
}
