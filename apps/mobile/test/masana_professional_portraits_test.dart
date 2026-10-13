import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/services.dart';
import 'package:masanawa/src/agents/masana_portrait_avatar.dart';
void main(){
 TestWidgetsFlutterBinding.ensureInitialized();
 test('all 26 professional AI Masana identities have packaged portrait and banner',()async{
  const names=["Mallam Gwani Bodi","Malamah Gwana Sulafat","Dr. Amina Yusuf","Nurse Fatima Abdullahi","Pharm. Salim Ibrahim","Barr. Zainab Bello","Prof. Sadiq Musa","Engr. Musa Garba","Engr. Bello Shehu","Engr. Umar Lawal","Arc. Safiya Kabir","Prof. Ruqayya Haruna","Dr. Idris Muhammad","Prof. Maryam Usman","Dr. Kabir Ahmad","Prof. Hauwa Sani","Dr. Yusuf Danladi","Prof. Haruna Adamu","Dr. Bilkisu Suleiman","Dr. Nura Abdullahi","Dr. Aisha Tanko","Prof. Abdulrahman Isah","Ustazah Layla Hassan","Prof. Grace Okonkwo","Madam Asha Verma","Prof. Mei Lin"];
  expect(names.length,26);
  for(final name in names){
   final avatar=portraitAssetFor(name);
   final banner=bannerAssetFor(name);
   expect(avatar,isNotNull,reason:name);
   expect(banner,isNotNull,reason:name);
   expect((await rootBundle.loadString(avatar!)).contains('<svg'),true);
   expect((await rootBundle.loadString(banner!)).contains('<svg'),true);
  }
  expect(portraitAssetFor('Admin-managed custom AI'),isNull);
 });
}
