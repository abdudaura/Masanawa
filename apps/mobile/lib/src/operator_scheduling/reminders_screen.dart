import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/providers.dart';
import '../state/session_state.dart';
import 'reminder_models.dart';
import 'reminder_transport.dart';

/// Nested Assistant screen only. F12 owns route registration.
class RemindersScreen extends ConsumerStatefulWidget {
  const RemindersScreen({super.key, this.target, this.transport});
  final ReminderTarget? target;
  final ReminderTransport? transport;

  @override
  ConsumerState<RemindersScreen> createState() => _RemindersScreenState();
}

class _RemindersScreenState extends ConsumerState<RemindersScreen> {
  String? _owner;
  int _generation = 0;
  bool _loading = true;
  bool _working = false;
  String? _error;
  List<ScheduledReminder> _reminders = const [];
  ReminderCreateRequest? _pendingCreate;

  ReminderTransport get _transport =>
      widget.transport ?? GatewayReminderTransport(ref.read(apiClientProvider));

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _load();
    });
  }

  void _accountChanged(String? next) {
    _generation++;
    _owner = next;
    _reminders = const [];
    _error = null;
    _pendingCreate = null;
    _working = false;
    _loading = next != null;
    if (next != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _load();
      });
    }
  }

  Future<void> _load() async {
    final s = ref.read(sessionProvider);
    final account = s is SessionSignedIn ? s.user.id : null;
    if (account == null) return;
    if (_owner != account) {
      setState(() => _accountChanged(account));
      return;
    }
    final generation = ++_generation;
    setState(() { _loading = true; _error = null; });
    try {
      final rows = await _transport.list();
      if (!mounted || generation != _generation || _owner != account) return;
      setState(() { _reminders = rows; _loading = false; });
    } catch (_) {
      if (!mounted || generation != _generation || _owner != account) return;
      setState(() {
        _loading = false;
        _error = 'Reminders are unavailable. Check your connection and retry.';
      });
    }
  }

  Future<void> _create(Map<String,dynamic> spec) async {
    final key = canonicalReminderSpec(spec);
    if (_pendingCreate?.specKey != key) {
      _pendingCreate = ReminderCreateRequest.generate(spec);
    }
    setState(() { _working = true; _error = null; });
    final generation = _generation;
    final owner = _owner;
    try {
      await _transport.create(requestId: _pendingCreate!.requestId, spec: spec);
      if (!mounted || _generation != generation || _owner != owner) return;
      _pendingCreate = null;
      await _load();
      if (mounted && _owner == owner &&\n          ref.read(sessionProvider) is SessionSignedIn) {\n        Navigator.of(context).maybePop();\n      }
    } catch (_) {
      if (!mounted || _generation != generation || _owner != owner) return;
      setState(() {
        _error = 'Could not confirm this reminder. Retry without changing '
            'details, or refresh the list before trying again.';
      });
      rethrow; // The editor must show the error while remaining open.
    } finally {
      if (mounted && _generation == generation) setState(() => _working = false);
    }
  }

  Future<void> _change(ScheduledReminder entry, String action) async {
    if (_working) return;
    final generation = _generation;
    final owner = _owner;
    setState(() { _working = true; _error = null; });
    try {
      await _transport.change(
        id: entry.id,revision: entry.revision,action: action,
      );
      if (!mounted || _generation != generation || _owner != owner) return;
      await _load();
    } catch (_) {
      if (!mounted || _generation != generation || _owner != owner) return;
      setState(() {
        _error = 'Could not confirm this change. Refresh the list before retrying.';
      });
    } finally {
      if (mounted && _generation == generation) setState(() => _working = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    final account = session is SessionSignedIn ? session.user.id : null;
    ref.listen<SessionState>(sessionProvider, (previous,next) {
      final id = next is SessionSignedIn ? next.user.id : null;
      if (id != _owner && mounted) setState(() => _accountChanged(id));
    });
    final visible = account != null && account == _owner;
    return Scaffold(
      appBar: AppBar(title: const Text('Reminders')),
      body: account == null
        ? const Center(child: Text('Sign in to manage your reminders.'))
        : !visible || _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  const Text(
                    'Only reminders you approve run here. No automatic '
                    'purchases, transfers or messages to other people.',
                  ),
                  const SizedBox(height: 12),
                  if (_error != null) ...[
                    Text(_error!,style:TextStyle(color:Theme.of(context).colorScheme.error)),
                    TextButton(onPressed: _load,child:const Text('Refresh')),
                  ],
                  if (_reminders.isEmpty)
                    const Padding(
                      padding: EdgeInsets.all(24),
                      child: Text('No scheduled reminders yet.'),
                    ),
                  for (final reminder in _reminders)
                    Card(child: ListTile(
                      title: Text(reminder.kind.label),
                      subtitle: Text(
                        '${reminder.state} · ${reminder.timezone}\n'
                        '${reminder.nextDueAt == null ? "No upcoming run" : reminder.nextDueAt!.toLocal().toString()}',
                      ),
                      isThreeLine: true,
                      trailing: PopupMenuButton<String>(
                        enabled: !_working && reminder.state != 'cancelled',
                        onSelected: (action) => _change(reminder, action),
                        itemBuilder: (_) => [
                          PopupMenuItem(
                            value: reminder.state == 'paused' ? 'resume' : 'pause',
                            child: Text(reminder.state == 'paused' ? 'Resume' : 'Pause'),
                          ),
                          const PopupMenuItem(value: 'cancel',child:Text('Cancel')),
                        ],
                      ),
                    )),
                ],
              ),
            ),
      floatingActionButton: account != null && visible && widget.target != null
        ? FloatingActionButton.extended(
            onPressed: _working ? null : () => showModalBottomSheet<void>(
              context:context,isScrollControlled:true,
              builder: (ctx) => ReminderEditor(
                target:widget.target!,
                busy: () => _working,
                onSubmit: _create,
              ),
            ),
            icon:const Icon(Icons.alarm_add_outlined),
            label:const Text('Add reminder'),
          )
        : null,
    );
  }
}

/// Opt-in form. Never fabricates a target; consumer passes a real typed domain reference.
class ReminderEditor extends StatefulWidget {
  const ReminderEditor({
    super.key,required this.target,required this.onSubmit,required this.busy,
  });
  final ReminderTarget target;
  final Future<void> Function(Map<String,dynamic>) onSubmit;
  final bool Function() busy;

  @override
  State<ReminderEditor> createState() => _ReminderEditorState();
}

class _ReminderEditorState extends State<ReminderEditor> {
  String _frequency = 'daily';
  String _timezone = 'Africa/Lagos';
  TimeOfDay _time = const TimeOfDay(hour: 15,minute: 0);
  int _weekday = 1;
  bool _consent = false;
  bool _sending = false;
  String? _formError;
  final _zones = const ['Africa/Lagos','Etc/UTC','Europe/London',
    'Europe/Berlin','America/New_York'];

  @override
  Widget build(BuildContext context) {
    final time = '${_time.hour.toString().padLeft(2, '0')}:'
        '${_time.minute.toString().padLeft(2, '0')}';
    return SafeArea(child: SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(20,20,20,
        MediaQuery.of(context).viewInsets.bottom+28),
      child: Column(mainAxisSize:MainAxisSize.min,crossAxisAlignment:CrossAxisAlignment.start,
      children: [
        Text('Schedule ${widget.target.kind.label}',
          style:Theme.of(context).textTheme.titleLarge),
        const SizedBox(height:12),
        DropdownButtonFormField<String>(
          value:_frequency,decoration:const InputDecoration(labelText:'Repeat'),
          items: const [
            DropdownMenuItem(value:'daily',child:Text('Every day')),
            DropdownMenuItem(value:'weekly',child:Text('Every week')),
          ],
          onChanged:_sending?null:(v)=>setState(()=>_frequency=v??'daily'),
        ),
        DropdownButtonFormField<String>(
          value:_timezone,decoration:const InputDecoration(labelText:'Time zone'),
          items:_zones.map((z)=>DropdownMenuItem(value:z,child:Text(z))).toList(),
          onChanged:_sending?null:(v)=>setState(()=>_timezone=v??'Africa/Lagos'),
        ),
        if (_frequency=='weekly') DropdownButtonFormField<int>(
          value:_weekday,decoration:const InputDecoration(labelText:'Day'),
          items:List.generate(7,(i)=>DropdownMenuItem(
            value:i+1,child:Text(const ['Monday','Tuesday','Wednesday',
              'Thursday','Friday','Saturday','Sunday'][i]))),
          onChanged:_sending?null:(v)=>setState(()=>_weekday=v??1),
        ),
        ListTile(
          title:const Text('Reminder time'),subtitle:Text(time),
          trailing:const Icon(Icons.schedule),
          onTap:_sending?null:() async {
            final selected=await showTimePicker(context:context,initialTime:_time);
            if (selected!=null && mounted) setState(()=>_time=selected);
          },
        ),
        const Text('Quiet hours: 22:00–07:00 in the selected time zone. '
          'Reminders in quiet hours are rejected; late deliveries may be skipped.'),
        CheckboxListTile(
          contentPadding:EdgeInsets.zero,
          title:const Text('I want this reminder'),
          subtitle:const Text('Notifications require device permission. '
            'No financial action will be performed.'),
          value:_consent,
          onChanged:_sending?null:(v)=>setState(()=>_consent=v??false),
        ),
        if (_formError != null) Padding(
          padding: const EdgeInsets.symmetric(vertical:8),
          child: Text(_formError!,
            style:TextStyle(color:Theme.of(context).colorScheme.error)),
        ),
        const SizedBox(height:12),
        FilledButton(
          onPressed:!_consent||_sending||widget.busy()?null:() async {
            setState(() { _sending=true; _formError=null; });
            try {
              await widget.onSubmit({
                'kind':widget.target.kind.wireName,
                'referenceId':widget.target.referenceId,
                'frequency':_frequency,
                'timezone':_timezone,
                'localTime':time,
                if(_frequency=='weekly') 'dayOfWeek':_weekday,
                'quietStart':'22:00','quietEnd':'07:00','optedIn':true,
              });
            } catch (_) {
              if (mounted) {
                setState(() => _formError =
                    'Could not confirm this reminder. Retry the same details '
                    'or close and refresh your list.');
              }
            } finally {
              if (mounted) setState(()=>_sending=false);
            }
          },
          child: const Text('Save reminder'),
        ),
      ],
    )));
  }
}
