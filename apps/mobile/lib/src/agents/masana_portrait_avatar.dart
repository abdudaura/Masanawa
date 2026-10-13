import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'agent_directory.dart';

/// Curated offline vector portraits, keyed only by the server display label.
/// These are **fictional AI character illustrations**, not photographs of
/// licensed real-world professionals or a hard-coded contact directory.
const _names = ["Mallam Gwani Bodi","Malamah Gwana Sulafat","Dr. Amina Yusuf","Nurse Fatima Abdullahi","Pharm. Salim Ibrahim","Barr. Zainab Bello","Prof. Sadiq Musa","Engr. Musa Garba","Engr. Bello Shehu","Engr. Umar Lawal","Arc. Safiya Kabir","Prof. Ruqayya Haruna","Dr. Idris Muhammad","Prof. Maryam Usman","Dr. Kabir Ahmad","Prof. Hauwa Sani","Dr. Yusuf Danladi","Prof. Haruna Adamu","Dr. Bilkisu Suleiman","Dr. Nura Abdullahi","Dr. Aisha Tanko","Prof. Abdulrahman Isah","Ustazah Layla Hassan","Prof. Grace Okonkwo","Madam Asha Verma","Prof. Mei Lin"];

String? portraitAssetFor(String displayName){
 final index=_names.indexOf(displayName.trim());
 return index<0?null:'assets/masana/avatars/portrait_${index.toString().padLeft(2,'0')}.svg';
}
String? bannerAssetFor(String displayName){
 final index=_names.indexOf(displayName.trim());
 return index<0?null:'assets/masana/banners/banner_${index.toString().padLeft(2,'0')}.svg';
}

class MasanaPortraitAvatar extends StatelessWidget{
 const MasanaPortraitAvatar({super.key,required this.agent,this.size=52});
 final AgentDirectoryEntry agent;
 final double size;
 @override Widget build(BuildContext context){
  final asset=portraitAssetFor(agent.displayName),url=agent.avatarUrl;
  return ClipOval(child: SizedBox(width:size,height:size,child:
   asset!=null?SvgPicture.asset(asset,width:size,height:size,fit:BoxFit.cover,
       semanticsLabel:'AI portrait of ${agent.displayName}'):
   url!=null&&url.isNotEmpty?Image.network(url,width:size,height:size,
       fit:BoxFit.cover,errorBuilder:(_,__,___)=>_initial()):
   _initial()));
 }
 Widget _initial()=>ColoredBox(color:const Color(0xFF1E63D6),
    child:Center(child:Text(agent.initial,style:TextStyle(
      color:Colors.white,fontSize:size*.37,fontWeight:FontWeight.bold))));
}
