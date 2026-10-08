import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/messages/realtime/human_dm_realtime_sync.dart';
import 'package:masanawa/src/messages/realtime/human_dm_realtime_transport.dart';

class _Store implements HumanDmRealtimeCursorStore {
  String? cursor;
  int saves=0;
  @override
  Future<String?> load({required String tenantId,required String userId}) async {
    expect(tenantId,'tenant_a');
    expect(userId,'user_a');
    return cursor;
  }

  @override
  Future<void> save({
    required String tenantId,required String userId,required String cursor,
  }) async {
    expect(tenantId,'tenant_a');
    expect(userId,'user_a');
    this.cursor=cursor;saves++;
  }
}

class _Projection implements HumanDmRealtimeProjection {
  int full=0;
  final changed=<String>[];
  final invalidated=<String>[];
  final receipts=<String>[];
  bool fail=false;
  @override
  Future<void> applyReadReceipt({
    required String conversationId,required String readerUserId,
    required String throughSequence,
  }) async {
    receipts.add(conversationId + ':' + readerUserId + ':' + throughSequence);
  }
  @override
  Future<void> refreshAll() async { full++; }
  @override
  Future<void> refreshConversation(String id) async {
    if(fail) throw StateError('C02 not ready');
    changed.add(id);
  }
  @override
  Future<void> invalidateConversation(String id) async {
    invalidated.add(id);
  }
}

class _Transport implements HumanDmRealtimeTransport {
  final responses=<HumanDmRealtimePage>[];
  Completer<HumanDmRealtimePage>? waiting;
  String? receivedCursor;
  int calls=0;
  @override
  Future<HumanDmRealtimePage> poll({
    String? cursor,int limit=50,int waitMs=10000,CancelToken? cancelToken,
  }) async {
    calls++;
    receivedCursor=cursor;
    if(waiting!=null) return waiting!.future;
    if(responses.isEmpty) throw StateError('No test response');
    return responses.removeAt(0);
  }
}

HumanDmRealtimePage _page({
  String cursor='1',bool hasMore=false,bool reset=false,
  List<HumanDmRealtimeEvent> events=const [],
}) => HumanDmRealtimePage(
  events:events,nextCursor:cursor,hasMore:hasMore,resetRequired:reset,
);

const _added=HumanDmRealtimeEvent(
  eventId:'1',conversationId:'thread_a',
  kind:HumanDmChange.messageAdded,actorUserId:'user_b',
  messageId:'message_a',messageSequence:'14',
);
const _revoked=HumanDmRealtimeEvent(
  eventId:'2',conversationId:'thread_a',
  kind:HumanDmChange.accessChanged,actorUserId:'user_b',
);

HumanDmRealtimeSync _sync(_Store store,_Projection projection,_Transport transport,
    {bool Function()? session}) => HumanDmRealtimeSync(
  tenantId:'tenant_a',userId:'user_a',transport:transport,
  store:store,projection:projection,
  isCurrentSession:session??()=>true,
);

void main() {
  test('only validated metadata accepted; no message text may be parsed',(){
    expect(HumanDmRealtimePage.fromJson({
      'events':[{
        'eventId':'1','conversationId':'thread_a',
        'kind':'message_added','actorUserId':'user_b',
        'messageId':'message_a','messageSequence':'14',
      }],'nextCursor':'1','hasMore':false,'resetRequired':false,
    }).events.single.kind,HumanDmChange.messageAdded);
    expect(()=>HumanDmRealtimePage.fromJson({
      'events':[{
        'eventId':'1','conversationId':'thread_a',
        'kind':'unknown','actorUserId':'user_b',
        'messageId':null,'messageSequence':null,
      }],'nextCursor':'1','hasMore':false,'resetRequired':false,
    }),throwsFormatException);
    expect(()=>HumanDmRealtimePage.fromJson({
      'events':[],'nextCursor':'01','hasMore':false,'resetRequired':false,
    }),throwsFormatException);
  });

  test('bootstraps C02 full inbox once, applies authorized events then persists cursor',() async {
    final store=_Store(),projection=_Projection(),transport=_Transport();
    transport.responses.add(_page(
      events:[_added],cursor:'1',reset:true,
    ));
    final sync=_sync(store,projection,transport);
    await sync.syncOnce();
    expect(projection.full,1);
    expect(projection.changed,['thread_a']);
    expect(store.cursor,'1');
    expect(store.saves,1);
    expect(transport.receivedCursor,isNull);
    transport.responses.add(_page(cursor:'1'));
    await sync.syncOnce();
    expect(transport.receivedCursor,'1');
    expect(projection.full,1);
    sync.stop();
  });

  test('server read cursor is applied as exact peer receipt',() async {
    final store=_Store()..cursor='1';
    final projection=_Projection(),transport=_Transport();
    transport.responses.add(_page(events:[
      const HumanDmRealtimeEvent(
        eventId:'2',conversationId:'thread_a',
        kind:HumanDmChange.readChanged,actorUserId:'user_b',
        messageSequence:'14',
      ),
    ],cursor:'2'));
    final sync=_sync(store,projection,transport);
    await sync.syncOnce();
    expect(projection.receipts,['thread_a:user_b:14']);
    expect(projection.changed,isEmpty);
    expect(store.cursor,'2');
    sync.stop();
  });

  test('access revocation wins over earlier new-message event',() async {
    final store=_Store()..cursor='0';
    final projection=_Projection(),transport=_Transport();
    transport.responses.add(_page(events:[_added,_revoked],cursor:'2'));
    final sync=_sync(store,projection,transport);
    await sync.syncOnce();
    expect(projection.changed,isEmpty);
    expect(projection.invalidated,['thread_a']);
    expect(store.cursor,'2');
    sync.stop();
  });

  test('projection failures do not advance the persisted cursor',() async {
    final store=_Store()..cursor='0';
    final projection=_Projection()..fail=true;
    final transport=_Transport()..responses.add(_page(events:[_added],cursor:'1'));
    final sync=_sync(store,projection,transport);
    await expectLater(sync.syncOnce(),throwsStateError);
    expect(store.cursor,'0');
    expect(store.saves,0);
    sync.stop();
  });

  test('A to B session switch ignores late A responses and cannot acknowledge',() async {
    final store=_Store()..cursor='0';
    final projection=_Projection(),transport=_Transport();
    transport.waiting=Completer<HumanDmRealtimePage>();
    var activeOwner='user_a';
    final sync=_sync(store,projection,transport,
      session:()=>activeOwner=='user_a');
    final outstanding=sync.syncOnce();
    await Future<void>.delayed(Duration.zero);
    activeOwner='user_b';
    transport.waiting!.complete(_page(events:[_added],cursor:'1'));
    await expectLater(outstanding,throwsStateError);
    expect(store.cursor,'0');
    expect(projection.changed,isEmpty);
    sync.stop();
  });

  test('sign-out cancels current long-poll even before response',() async {
    final store=_Store()..cursor='0';
    final projection=_Projection(),transport=_Transport();
    transport.waiting=Completer<HumanDmRealtimePage>();
    final sync=_sync(store,projection,transport);
    final outstanding=sync.syncOnce(waitMs:12000);
    await Future<void>.delayed(Duration.zero);
    sync.stop();
    transport.waiting!.complete(_page(events:[_added],cursor:'1'));
    await expectLater(outstanding,throwsStateError);
    expect(store.cursor,'0');
  });

  test('persisted C05 cursor resumes without loading inbox again',() async {
    final store=_Store()..cursor='123';
    final projection=_Projection(),transport=_Transport();
    transport.responses.add(_page(cursor:'123'));
    final sync=_sync(store,projection,transport);
    await sync.syncOnce();
    expect(projection.full,0);
    expect(transport.receivedCursor,'123');
    sync.stop();
  });

  test('rejects a server cursor moving backwards',() async {
    final store=_Store()..cursor='9';
    final projection=_Projection(),transport=_Transport();
    transport.responses.add(_page(cursor:'8'));
    final sync=_sync(store,projection,transport);
    await expectLater(sync.syncOnce(),throwsFormatException);
    expect(store.cursor,'9');
    sync.stop();
  });
}
 + '{conversationId}: async { full++; }
  @override
  Future<void> refreshConversation(String id) async {
    if(fail) throw StateError('C02 not ready');
    changed.add(id);
  }
  @override
  Future<void> invalidateConversation(String id) async {
    invalidated.add(id);
  }
}

class _Transport implements HumanDmRealtimeTransport {
  final responses=<HumanDmRealtimePage>[];
  Completer<HumanDmRealtimePage>? waiting;
  String? receivedCursor;
  int calls=0;
  @override
  Future<HumanDmRealtimePage> poll({
    String? cursor,int limit=50,int waitMs=10000,CancelToken? cancelToken,
  }) async {
    calls++;
    receivedCursor=cursor;
    if(waiting!=null) return waiting!.future;
    if(responses.isEmpty) throw StateError('No test response');
    return responses.removeAt(0);
  }
}

HumanDmRealtimePage _page({
  String cursor='1',bool hasMore=false,bool reset=false,
  List<HumanDmRealtimeEvent> events=const [],
}) => HumanDmRealtimePage(
  events:events,nextCursor:cursor,hasMore:hasMore,resetRequired:reset,
);

const _added=HumanDmRealtimeEvent(
  eventId:'1',conversationId:'thread_a',
  kind:HumanDmChange.messageAdded,actorUserId:'user_b',
  messageId:'message_a',messageSequence:'14',
);
const _revoked=HumanDmRealtimeEvent(
  eventId:'2',conversationId:'thread_a',
  kind:HumanDmChange.accessChanged,actorUserId:'user_b',
);

HumanDmRealtimeSync _sync(_Store store,_Projection projection,_Transport transport,
    {bool Function()? session}) => HumanDmRealtimeSync(
  tenantId:'tenant_a',userId:'user_a',transport:transport,
  store:store,projection:projection,
  isCurrentSession:session??()=>true,
);

void main() {
  test('only validated metadata accepted; no message text may be parsed',(){
    expect(HumanDmRealtimePage.fromJson({
      'events':[{
        'eventId':'1','conversationId':'thread_a',
        'kind':'message_added','actorUserId':'user_b',
        'messageId':'message_a','messageSequence':'14',
      }],'nextCursor':'1','hasMore':false,'resetRequired':false,
    }).events.single.kind,HumanDmChange.messageAdded);
    expect(()=>HumanDmRealtimePage.fromJson({
      'events':[{
        'eventId':'1','conversationId':'thread_a',
        'kind':'unknown','actorUserId':'user_b',
        'messageId':null,'messageSequence':null,
      }],'nextCursor':'1','hasMore':false,'resetRequired':false,
    }),throwsFormatException);
    expect(()=>HumanDmRealtimePage.fromJson({
      'events':[],'nextCursor':'01','hasMore':false,'resetRequired':false,
    }),throwsFormatException);
  });

  test('bootstraps C02 full inbox once, applies authorized events then persists cursor',() async {
    final store=_Store(),projection=_Projection(),transport=_Transport();
    transport.responses.add(_page(
      events:[_added],cursor:'1',reset:true,
    ));
    final sync=_sync(store,projection,transport);
    await sync.syncOnce();
    expect(projection.full,1);
    expect(projection.changed,['thread_a']);
    expect(store.cursor,'1');
    expect(store.saves,1);
    expect(transport.receivedCursor,isNull);
    transport.responses.add(_page(cursor:'1'));
    await sync.syncOnce();
    expect(transport.receivedCursor,'1');
    expect(projection.full,1);
    sync.stop();
  });

  test('access revocation wins over earlier new-message event',() async {
    final store=_Store()..cursor='0';
    final projection=_Projection(),transport=_Transport();
    transport.responses.add(_page(events:[_added,_revoked],cursor:'2'));
    final sync=_sync(store,projection,transport);
    await sync.syncOnce();
    expect(projection.changed,isEmpty);
    expect(projection.invalidated,['thread_a']);
    expect(store.cursor,'2');
    sync.stop();
  });

  test('projection failures do not advance the persisted cursor',() async {
    final store=_Store()..cursor='0';
    final projection=_Projection()..fail=true;
    final transport=_Transport()..responses.add(_page(events:[_added],cursor:'1'));
    final sync=_sync(store,projection,transport);
    await expectLater(sync.syncOnce(),throwsStateError);
    expect(store.cursor,'0');
    expect(store.saves,0);
    sync.stop();
  });

  test('A to B session switch ignores late A responses and cannot acknowledge',() async {
    final store=_Store()..cursor='0';
    final projection=_Projection(),transport=_Transport();
    transport.waiting=Completer<HumanDmRealtimePage>();
    var activeOwner='user_a';
    final sync=_sync(store,projection,transport,
      session:()=>activeOwner=='user_a');
    final outstanding=sync.syncOnce();
    await Future<void>.delayed(Duration.zero);
    activeOwner='user_b';
    transport.waiting!.complete(_page(events:[_added],cursor:'1'));
    await expectLater(outstanding,throwsStateError);
    expect(store.cursor,'0');
    expect(projection.changed,isEmpty);
    sync.stop();
  });

  test('sign-out cancels current long-poll even before response',() async {
    final store=_Store()..cursor='0';
    final projection=_Projection(),transport=_Transport();
    transport.waiting=Completer<HumanDmRealtimePage>();
    final sync=_sync(store,projection,transport);
    final outstanding=sync.syncOnce(waitMs:12000);
    await Future<void>.delayed(Duration.zero);
    sync.stop();
    transport.waiting!.complete(_page(events:[_added],cursor:'1'));
    await expectLater(outstanding,throwsStateError);
    expect(store.cursor,'0');
  });

  test('persisted C05 cursor resumes without loading inbox again',() async {
    final store=_Store()..cursor='123';
    final projection=_Projection(),transport=_Transport();
    transport.responses.add(_page(cursor:'123'));
    final sync=_sync(store,projection,transport);
    await sync.syncOnce();
    expect(projection.full,0);
    expect(transport.receivedCursor,'123');
    sync.stop();
  });

  test('rejects a server cursor moving backwards',() async {
    final store=_Store()..cursor='9';
    final projection=_Projection(),transport=_Transport();
    transport.responses.add(_page(cursor:'8'));
    final sync=_sync(store,projection,transport);
    await expectLater(sync.syncOnce(),throwsFormatException);
    expect(store.cursor,'9');
    sync.stop();
  });
}
 + '{readerUserId}: async { full++; }
  @override
  Future<void> refreshConversation(String id) async {
    if(fail) throw StateError('C02 not ready');
    changed.add(id);
  }
  @override
  Future<void> invalidateConversation(String id) async {
    invalidated.add(id);
  }
}

class _Transport implements HumanDmRealtimeTransport {
  final responses=<HumanDmRealtimePage>[];
  Completer<HumanDmRealtimePage>? waiting;
  String? receivedCursor;
  int calls=0;
  @override
  Future<HumanDmRealtimePage> poll({
    String? cursor,int limit=50,int waitMs=10000,CancelToken? cancelToken,
  }) async {
    calls++;
    receivedCursor=cursor;
    if(waiting!=null) return waiting!.future;
    if(responses.isEmpty) throw StateError('No test response');
    return responses.removeAt(0);
  }
}

HumanDmRealtimePage _page({
  String cursor='1',bool hasMore=false,bool reset=false,
  List<HumanDmRealtimeEvent> events=const [],
}) => HumanDmRealtimePage(
  events:events,nextCursor:cursor,hasMore:hasMore,resetRequired:reset,
);

const _added=HumanDmRealtimeEvent(
  eventId:'1',conversationId:'thread_a',
  kind:HumanDmChange.messageAdded,actorUserId:'user_b',
  messageId:'message_a',messageSequence:'14',
);
const _revoked=HumanDmRealtimeEvent(
  eventId:'2',conversationId:'thread_a',
  kind:HumanDmChange.accessChanged,actorUserId:'user_b',
);

HumanDmRealtimeSync _sync(_Store store,_Projection projection,_Transport transport,
    {bool Function()? session}) => HumanDmRealtimeSync(
  tenantId:'tenant_a',userId:'user_a',transport:transport,
  store:store,projection:projection,
  isCurrentSession:session??()=>true,
);

void main() {
  test('only validated metadata accepted; no message text may be parsed',(){
    expect(HumanDmRealtimePage.fromJson({
      'events':[{
        'eventId':'1','conversationId':'thread_a',
        'kind':'message_added','actorUserId':'user_b',
        'messageId':'message_a','messageSequence':'14',
      }],'nextCursor':'1','hasMore':false,'resetRequired':false,
    }).events.single.kind,HumanDmChange.messageAdded);
    expect(()=>HumanDmRealtimePage.fromJson({
      'events':[{
        'eventId':'1','conversationId':'thread_a',
        'kind':'unknown','actorUserId':'user_b',
        'messageId':null,'messageSequence':null,
      }],'nextCursor':'1','hasMore':false,'resetRequired':false,
    }),throwsFormatException);
    expect(()=>HumanDmRealtimePage.fromJson({
      'events':[],'nextCursor':'01','hasMore':false,'resetRequired':false,
    }),throwsFormatException);
  });

  test('bootstraps C02 full inbox once, applies authorized events then persists cursor',() async {
    final store=_Store(),projection=_Projection(),transport=_Transport();
    transport.responses.add(_page(
      events:[_added],cursor:'1',reset:true,
    ));
    final sync=_sync(store,projection,transport);
    await sync.syncOnce();
    expect(projection.full,1);
    expect(projection.changed,['thread_a']);
    expect(store.cursor,'1');
    expect(store.saves,1);
    expect(transport.receivedCursor,isNull);
    transport.responses.add(_page(cursor:'1'));
    await sync.syncOnce();
    expect(transport.receivedCursor,'1');
    expect(projection.full,1);
    sync.stop();
  });

  test('access revocation wins over earlier new-message event',() async {
    final store=_Store()..cursor='0';
    final projection=_Projection(),transport=_Transport();
    transport.responses.add(_page(events:[_added,_revoked],cursor:'2'));
    final sync=_sync(store,projection,transport);
    await sync.syncOnce();
    expect(projection.changed,isEmpty);
    expect(projection.invalidated,['thread_a']);
    expect(store.cursor,'2');
    sync.stop();
  });

  test('projection failures do not advance the persisted cursor',() async {
    final store=_Store()..cursor='0';
    final projection=_Projection()..fail=true;
    final transport=_Transport()..responses.add(_page(events:[_added],cursor:'1'));
    final sync=_sync(store,projection,transport);
    await expectLater(sync.syncOnce(),throwsStateError);
    expect(store.cursor,'0');
    expect(store.saves,0);
    sync.stop();
  });

  test('A to B session switch ignores late A responses and cannot acknowledge',() async {
    final store=_Store()..cursor='0';
    final projection=_Projection(),transport=_Transport();
    transport.waiting=Completer<HumanDmRealtimePage>();
    var activeOwner='user_a';
    final sync=_sync(store,projection,transport,
      session:()=>activeOwner=='user_a');
    final outstanding=sync.syncOnce();
    await Future<void>.delayed(Duration.zero);
    activeOwner='user_b';
    transport.waiting!.complete(_page(events:[_added],cursor:'1'));
    await expectLater(outstanding,throwsStateError);
    expect(store.cursor,'0');
    expect(projection.changed,isEmpty);
    sync.stop();
  });

  test('sign-out cancels current long-poll even before response',() async {
    final store=_Store()..cursor='0';
    final projection=_Projection(),transport=_Transport();
    transport.waiting=Completer<HumanDmRealtimePage>();
    final sync=_sync(store,projection,transport);
    final outstanding=sync.syncOnce(waitMs:12000);
    await Future<void>.delayed(Duration.zero);
    sync.stop();
    transport.waiting!.complete(_page(events:[_added],cursor:'1'));
    await expectLater(outstanding,throwsStateError);
    expect(store.cursor,'0');
  });

  test('persisted C05 cursor resumes without loading inbox again',() async {
    final store=_Store()..cursor='123';
    final projection=_Projection(),transport=_Transport();
    transport.responses.add(_page(cursor:'123'));
    final sync=_sync(store,projection,transport);
    await sync.syncOnce();
    expect(projection.full,0);
    expect(transport.receivedCursor,'123');
    sync.stop();
  });

  test('rejects a server cursor moving backwards',() async {
    final store=_Store()..cursor='9';
    final projection=_Projection(),transport=_Transport();
    transport.responses.add(_page(cursor:'8'));
    final sync=_sync(store,projection,transport);
    await expectLater(sync.syncOnce(),throwsFormatException);
    expect(store.cursor,'9');
    sync.stop();
  });
}
 + '{throughSequence}');
  }
  @override
  Future<void> refreshAll() async { full++; }
  @override
  Future<void> refreshConversation(String id) async {
    if(fail) throw StateError('C02 not ready');
    changed.add(id);
  }
  @override
  Future<void> invalidateConversation(String id) async {
    invalidated.add(id);
  }
}

class _Transport implements HumanDmRealtimeTransport {
  final responses=<HumanDmRealtimePage>[];
  Completer<HumanDmRealtimePage>? waiting;
  String? receivedCursor;
  int calls=0;
  @override
  Future<HumanDmRealtimePage> poll({
    String? cursor,int limit=50,int waitMs=10000,CancelToken? cancelToken,
  }) async {
    calls++;
    receivedCursor=cursor;
    if(waiting!=null) return waiting!.future;
    if(responses.isEmpty) throw StateError('No test response');
    return responses.removeAt(0);
  }
}

HumanDmRealtimePage _page({
  String cursor='1',bool hasMore=false,bool reset=false,
  List<HumanDmRealtimeEvent> events=const [],
}) => HumanDmRealtimePage(
  events:events,nextCursor:cursor,hasMore:hasMore,resetRequired:reset,
);

const _added=HumanDmRealtimeEvent(
  eventId:'1',conversationId:'thread_a',
  kind:HumanDmChange.messageAdded,actorUserId:'user_b',
  messageId:'message_a',messageSequence:'14',
);
const _revoked=HumanDmRealtimeEvent(
  eventId:'2',conversationId:'thread_a',
  kind:HumanDmChange.accessChanged,actorUserId:'user_b',
);

HumanDmRealtimeSync _sync(_Store store,_Projection projection,_Transport transport,
    {bool Function()? session}) => HumanDmRealtimeSync(
  tenantId:'tenant_a',userId:'user_a',transport:transport,
  store:store,projection:projection,
  isCurrentSession:session??()=>true,
);

void main() {
  test('only validated metadata accepted; no message text may be parsed',(){
    expect(HumanDmRealtimePage.fromJson({
      'events':[{
        'eventId':'1','conversationId':'thread_a',
        'kind':'message_added','actorUserId':'user_b',
        'messageId':'message_a','messageSequence':'14',
      }],'nextCursor':'1','hasMore':false,'resetRequired':false,
    }).events.single.kind,HumanDmChange.messageAdded);
    expect(()=>HumanDmRealtimePage.fromJson({
      'events':[{
        'eventId':'1','conversationId':'thread_a',
        'kind':'unknown','actorUserId':'user_b',
        'messageId':null,'messageSequence':null,
      }],'nextCursor':'1','hasMore':false,'resetRequired':false,
    }),throwsFormatException);
    expect(()=>HumanDmRealtimePage.fromJson({
      'events':[],'nextCursor':'01','hasMore':false,'resetRequired':false,
    }),throwsFormatException);
  });

  test('bootstraps C02 full inbox once, applies authorized events then persists cursor',() async {
    final store=_Store(),projection=_Projection(),transport=_Transport();
    transport.responses.add(_page(
      events:[_added],cursor:'1',reset:true,
    ));
    final sync=_sync(store,projection,transport);
    await sync.syncOnce();
    expect(projection.full,1);
    expect(projection.changed,['thread_a']);
    expect(store.cursor,'1');
    expect(store.saves,1);
    expect(transport.receivedCursor,isNull);
    transport.responses.add(_page(cursor:'1'));
    await sync.syncOnce();
    expect(transport.receivedCursor,'1');
    expect(projection.full,1);
    sync.stop();
  });

  test('access revocation wins over earlier new-message event',() async {
    final store=_Store()..cursor='0';
    final projection=_Projection(),transport=_Transport();
    transport.responses.add(_page(events:[_added,_revoked],cursor:'2'));
    final sync=_sync(store,projection,transport);
    await sync.syncOnce();
    expect(projection.changed,isEmpty);
    expect(projection.invalidated,['thread_a']);
    expect(store.cursor,'2');
    sync.stop();
  });

  test('projection failures do not advance the persisted cursor',() async {
    final store=_Store()..cursor='0';
    final projection=_Projection()..fail=true;
    final transport=_Transport()..responses.add(_page(events:[_added],cursor:'1'));
    final sync=_sync(store,projection,transport);
    await expectLater(sync.syncOnce(),throwsStateError);
    expect(store.cursor,'0');
    expect(store.saves,0);
    sync.stop();
  });

  test('A to B session switch ignores late A responses and cannot acknowledge',() async {
    final store=_Store()..cursor='0';
    final projection=_Projection(),transport=_Transport();
    transport.waiting=Completer<HumanDmRealtimePage>();
    var activeOwner='user_a';
    final sync=_sync(store,projection,transport,
      session:()=>activeOwner=='user_a');
    final outstanding=sync.syncOnce();
    await Future<void>.delayed(Duration.zero);
    activeOwner='user_b';
    transport.waiting!.complete(_page(events:[_added],cursor:'1'));
    await expectLater(outstanding,throwsStateError);
    expect(store.cursor,'0');
    expect(projection.changed,isEmpty);
    sync.stop();
  });

  test('sign-out cancels current long-poll even before response',() async {
    final store=_Store()..cursor='0';
    final projection=_Projection(),transport=_Transport();
    transport.waiting=Completer<HumanDmRealtimePage>();
    final sync=_sync(store,projection,transport);
    final outstanding=sync.syncOnce(waitMs:12000);
    await Future<void>.delayed(Duration.zero);
    sync.stop();
    transport.waiting!.complete(_page(events:[_added],cursor:'1'));
    await expectLater(outstanding,throwsStateError);
    expect(store.cursor,'0');
  });

  test('persisted C05 cursor resumes without loading inbox again',() async {
    final store=_Store()..cursor='123';
    final projection=_Projection(),transport=_Transport();
    transport.responses.add(_page(cursor:'123'));
    final sync=_sync(store,projection,transport);
    await sync.syncOnce();
    expect(projection.full,0);
    expect(transport.receivedCursor,'123');
    sync.stop();
  });

  test('rejects a server cursor moving backwards',() async {
    final store=_Store()..cursor='9';
    final projection=_Projection(),transport=_Transport();
    transport.responses.add(_page(cursor:'8'));
    final sync=_sync(store,projection,transport);
    await expectLater(sync.syncOnce(),throwsFormatException);
    expect(store.cursor,'9');
    sync.stop();
  });
}
