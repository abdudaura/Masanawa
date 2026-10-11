import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'rooms_plans_client.dart';

/// A11: pricing manager only. Exact minor units, immutable revisions, explicit activation.
class RoomPlansAdminScreen extends StatefulWidget {
 const RoomPlansAdminScreen({super.key,required this.roomId,required this.client});
 final String roomId;
 final RoomPlansAdminClient client;
 @override State<RoomPlansAdminScreen> createState()=>_RoomPlansAdminScreenState();
}
class _RoomPlansAdminScreenState extends State<RoomPlansAdminScreen> {
 final minor=TextEditingController(),sku=TextEditingController(),plan=TextEditingController();
 bool loading=true,busy=false,confirmActivation=false;
 String period='month',currency='NGN';
 String? failure,notice;
 List<AdminRoomPrice> prices=[];
 @override void initState(){super.initState();refresh();}
 @override void dispose(){minor.dispose();sku.dispose();plan.dispose();super.dispose();}
 String message(Object error) {
  if(error is DioException) {
   if(error.response?.statusCode==403)return 'You need pricing_manager permission.';
   if(error.response?.statusCode==409)return 'Price or plan conflict. Reload the latest version.';
   if(error.response?.statusCode==410)return 'Live subscriptions are not enabled.';
   if(error.type==DioExceptionType.connectionTimeout||error.type==DioExceptionType.connectionError)
    return 'Offline. Nothing was changed. Retry when online.';
  }
  return 'The operation did not complete. Review the details and retry.';
 }
 Future<void> refresh({bool force=false})async{
  if(busy&&!force)return;
  setState((){loading=true;failure=null;});
  try{final found=await widget.client.prices(widget.roomId);
   if(mounted)setState((){prices=found;loading=false;});
  }catch(e){if(mounted)setState((){failure=message(e);loading=false;});}
 }
 Future<void> createPlan()async{
  if(busy)return;setState(()=>busy=true);
  try{
   final id=await widget.client.createPlan(widget.roomId,period);
   if(mounted)setState((){plan.text=id;notice='Draft ${period} plan created. Add a Play product price.';});
   if(mounted)await refresh(force:true);
  }catch(e){if(mounted)setState(()=>failure=message(e));}
  finally{if(mounted)setState(()=>busy=false);}
 }
 Future<void> createPrice()async{
  if(busy)return;
  if(!RegExp(r'^[1-9][0-9]{0,14}$').hasMatch(minor.text)||
     !RegExp(r'^[a-z][a-z0-9._]{2,179}$').hasMatch(sku.text)){
   setState(()=>failure='Enter exact positive integer minor units and a valid Play SKU.');return;
  }
  setState(()=>busy=true);
  try{
   final record=await widget.client.addPrice(widget.roomId,plan.text,
    amountMinor:minor.text.trim(),currency:currency,storeProductId:sku.text.trim(),
    effectiveAt:DateTime.now().toUtc().toIso8601String());
   if(mounted)setState(()=>notice='Created immutable price version ${record.version}. Existing buyers retain their previous terms.');
   if(mounted)await refresh(force:true);
  }catch(e){if(mounted)setState(()=>failure=message(e));}
  finally{if(mounted)setState(()=>busy=false);}
 }
 Future<void> activatePaid()async{
  if(!confirmActivation||busy)return;setState(()=>busy=true);
  try{
   await widget.client.activatePaid(widget.roomId);
   if(mounted)setState(()=>notice='Paid mode activated. Entitlements are verified for every restricted read.');
  }catch(e){if(mounted)setState(()=>failure=message(e));}
  finally{if(mounted)setState(()=>busy=false);}
 }
 @override Widget build(BuildContext context)=>Scaffold(
  appBar:AppBar(title:const Text('Room plans & prices'),actions:[
   IconButton(onPressed:busy?null:refresh,icon:const Icon(Icons.refresh),tooltip:'Refresh')
  ]),
  body:loading?const Center(child:CircularProgressIndicator()):
   ListView(padding:const EdgeInsets.all(16),children:[
    Text('Google Play subscriptions',style:Theme.of(context).textTheme.titleLarge),
    const Text('Only pricing managers may update prices. No price change charges an existing member.'),
    const SizedBox(height:12),
    DropdownButtonFormField<String>(initialValue:period,
     decoration:const InputDecoration(labelText:'Billing period'),
     items:const [DropdownMenuItem(value:'month',child:Text('Monthly')),
      DropdownMenuItem(value:'year',child:Text('Yearly'))],
     onChanged:busy?null:(v)=>setState(()=>period=v??'month')),
    FilledButton(onPressed:busy?null:createPlan,child:const Text('Create draft plan')),
    TextField(controller:plan,decoration:const InputDecoration(labelText:'Plan ID from draft')),
    TextField(controller:minor,keyboardType:TextInputType.number,
     decoration:const InputDecoration(labelText:'Price (exact minor units)')),
    DropdownButtonFormField<String>(initialValue:currency,
     decoration:const InputDecoration(labelText:'Currency'),
     items:const [DropdownMenuItem(value:'NGN',child:Text('NGN')),
      DropdownMenuItem(value:'USD',child:Text('USD'))],
     onChanged:busy?null:(v)=>setState(()=>currency=v??'NGN')),
    TextField(controller:sku,decoration:const InputDecoration(labelText:'Play Console product ID')),
    OutlinedButton(onPressed:busy?null:createPrice,child:const Text('Add immutable price revision')),
    const Divider(),Text('Current plan prices',style:Theme.of(context).textTheme.titleMedium),
    if(prices.isEmpty)const ListTile(title:Text('No active prices'),
      subtitle:Text('Create a plan and Play SKU before activation.')),
    for(final p in prices)ListTile(title:Text('${p.currency} ${p.amountMinor} minor units'),
     subtitle:Text('${p.storeProductId} · version ${p.version}')),
    const Divider(),
    CheckboxListTile(value:confirmActivation,
     title:const Text('I confirmed the Play Console product, eligibility and test purchases.'),
     onChanged:busy?null:(v)=>setState(()=>confirmActivation=v==true)),
    FilledButton(onPressed:confirmActivation&&!busy&&prices.isNotEmpty?activatePaid:null,
     child:const Text('Activate paid Room')),
    if(notice!=null)ListTile(leading:const Icon(Icons.check_circle_outline),title:Text(notice!)),
    if(failure!=null)ListTile(leading:const Icon(Icons.warning_amber_outlined),title:Text(failure!)),
   ])
 );
}
