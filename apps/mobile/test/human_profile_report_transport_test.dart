import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/screens/profile/human_profile_report_transport.dart';
import 'package:masanawa/src/talks/talk_safety.dart';

void main() {
  test('authenticated report uses stable handle, caller ID, and exact 202 receipt',() async {
    final dio=Dio(BaseOptions(baseUrl:'https://example.invalid'));
    final client=ApiClient(dio:dio)..accessToken='signed-in-token';
    RequestOptions? captured;
    dio.interceptors.add(InterceptorsWrapper(
      onRequest:(options,handler){
        captured=options;
        handler.resolve(Response<dynamic>(
          requestOptions:options,statusCode:202,
          data:{'accepted':true,'reportId':'report-server-001'},
        ));
      },
    ));
    final id=await GatewayHumanProfileReportTransport(client).report(
      '@Amina',reason:TalkSafetyReportReason.impersonation,
      requestId:'human-profile-1234567890',detail:'Suspicious account',
      reporterUserId:'user-a',
    );
    expect(id,'report-server-001');
    expect(captured?.path,'/safety/reports');
    expect(captured?.headers['Authorization'],'Bearer signed-in-token');
    expect(captured?.extra['masanawaAuthRetried'],true);
    expect(captured?.data,{
      'targetKind':'profile',
      'targetId':'amina',
      'reason':'impersonation',
      'detail':'Suspicious account',
      'clientRequestId':'human-profile-1234567890',
      'expectedReporterUserId':'user-a',
    });
  });

  test('missing bearer refuses transmission',() async {
    final client=ApiClient(dio:Dio(BaseOptions(baseUrl:'https://example.invalid')));
    await expectLater(
      GatewayHumanProfileReportTransport(client).report(
        'amina',reason:TalkSafetyReportReason.spam,
        requestId:'human-profile-1234567890',detail:'',
        reporterUserId:'user-a',
      ),
      throwsStateError,
    );
  });

  test('200 without accepted true and receipt cannot be reported as success',() async {
    final dio=Dio(BaseOptions(baseUrl:'https://example.invalid'));
    final client=ApiClient(dio:dio)..accessToken='token';
    dio.interceptors.add(InterceptorsWrapper(
      onRequest:(options,handler)=>handler.resolve(Response<dynamic>(
        requestOptions:options,statusCode:200,data:{'accepted':true},
      )),
    ));
    await expectLater(
      GatewayHumanProfileReportTransport(client).report(
        'amina',reason:TalkSafetyReportReason.spam,
        requestId:'human-profile-1234567890',detail:'',
        reporterUserId:'user-a',
      ),
      throwsFormatException,
    );
  });

}
