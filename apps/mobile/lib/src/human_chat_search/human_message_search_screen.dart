import 'package:flutter/material.dart';
import 'human_message_search_controller.dart';
import 'human_message_search_models.dart';

/// Nested Chats UI; no sixth root tab, never shows Agent/Twin messages.
class HumanMessageSearchScreen extends StatefulWidget {
  const HumanMessageSearchScreen({
    super.key, required this.controller, required this.openAuthorizedMessage,
    this.conversationId,
  });
  final HumanMessageSearchController controller;
  /// Parent rechecks current C02 membership/tombstone before jumping to a message.
  final Future<void> Function(HumanMessageSearchHit) openAuthorizedMessage;
  final String? conversationId;
  @override
  State<HumanMessageSearchScreen> createState() => _HumanMessageSearchScreenState();
}
class _HumanMessageSearchScreenState extends State<HumanMessageSearchScreen> {
  final TextEditingController input = TextEditingController();
  @override
  void dispose() { input.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Search messages')),
      body: SafeArea(child: Column(children: [
        Padding(padding: const EdgeInsets.all(12), child: Row(children: [
          Expanded(child: TextField(
            controller: input,
            maxLength: 128,
            textInputAction: TextInputAction.search,
            autocorrect: false,
            decoration: const InputDecoration(
              hintText: 'Find a message', prefixIcon: Icon(Icons.search),
              border: OutlineInputBorder(),
            ),
            onSubmitted: (value) => widget.controller.find(
              value, inConversation: widget.conversationId),
          )),
          IconButton(tooltip: 'Search', icon: const Icon(Icons.arrow_forward),
            onPressed: () => widget.controller.find(input.text,
              inConversation: widget.conversationId)),
        ])),
        Expanded(child: AnimatedBuilder(
          animation: widget.controller,
          builder: (context, _) {
            final state = widget.controller;
            if (state.busy) return const Center(child: CircularProgressIndicator());
            if (state.error != null && state.hits.isEmpty) {
              return Center(child: Text(state.error!, textAlign: TextAlign.center));
            }
            if (state.hits.isEmpty) {
              return Center(child: Text(state.activeQuery == null
                ? 'Search your private human conversations.'
                : 'No accessible messages found.'));
            }
            return ListView.builder(
              itemCount: state.hits.length + (state.next != null ? 1 : 0),
              itemBuilder: (context, i) {
                if (i == state.hits.length) {
                  return Center(child: TextButton(
                    onPressed: state.loadingMore ? null : state.loadMore,
                    child: Text(state.loadingMore ? 'Loading…' : 'More results'),
                  ));
                }
                final hit = state.hits[i];
                return ListTile(
                  key: ValueKey(hit.messageId),
                  title: Text(hit.body, maxLines: 2, overflow: TextOverflow.ellipsis),
                  subtitle: Text(hit.editedAt == null ? 'Message' : 'Edited message'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => widget.openAuthorizedMessage(hit),
                );
              },
            );
          },
        )),
      ])),
    );
  }
}
