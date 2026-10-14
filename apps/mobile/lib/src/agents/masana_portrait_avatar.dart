import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'agent_directory.dart';

/// Archived fictional vector illustrations, intentionally NOT used as the
/// owner's requested final photo portraits. Stable profile URLs are preferred;
/// unknown or unavailable artwork renders neutral initials instead.
const _names = ["Gwani","Gwana","Dr. Amina Yusuf","Nurse Fatima Abdullahi","Pharm. Salim Ibrahim","Barr. Zainab Bello","Prof. Sadiq Musa","Engr. Musa Garba","Engr. Bello Shehu","Engr. Umar Lawal","Arc. Safiya Kabir","Prof. Ruqayya Haruna","Dr. Idris Muhammad","Prof. Maryam Usman","Dr. Kabir Ahmad","Prof. Hauwa Sani","Dr. Yusuf Danladi","Prof. Haruna Adamu","Dr. Bilkisu Suleiman","Dr. Nura Abdullahi","Dr. Aisha Tanko","Prof. Abdulrahman Isah","Ustazah Layla Hassan","Prof. Grace Okonkwo","Madam Asha Verma","Prof. Mei Lin"];

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
  final url=agent.avatarUrl?.trim();
  // The archived SVG illustrations were placeholders, not the owner's
  // original portraits. Do not present them as the final profile photos.
  Widget fallback()=>_initial(context);
  // Only the server's identity-bound artwork is authoritative; absent or
  // failed URLs show initials rather than misrepresenting archived cartoons.
  final portrait=url==null||url.isEmpty?fallback():
    Uri.tryParse(url)?.path.toLowerCase().endsWith('.svg')==true?
      SvgPicture.network(url,width:size,height:size,fit:BoxFit.cover,
        semanticsLabel:'AI portrait of ${agent.displayName}',
        placeholderBuilder:(_)=>fallback(),errorBuilder:(_,_,_)=>fallback()):
      Image.network(url,width:size,height:size,fit:BoxFit.cover,
        semanticLabel:'AI portrait of ${agent.displayName}',
        errorBuilder:(_,_,_)=>fallback());
  return ClipOval(child:SizedBox(width:size,height:size,child:portrait));
 }
 Widget _initial(BuildContext context)=>ColoredBox(color:Theme.of(context).colorScheme.primary,
    child:Center(child:Text(agent.initial,style:TextStyle(
      color:Colors.white,fontSize:size*.37,fontWeight:FontWeight.bold))));
}
