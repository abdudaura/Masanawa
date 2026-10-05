import 'package:flutter/material.dart';

import '../theme/masanawa_theme.dart';

class DecisionCenterPage extends StatelessWidget {
  const DecisionCenterPage({super.key});

  @override
  Widget build(BuildContext context) => ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            'JEV Decision Center',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 4),
          Text(
            'JEV is Masanawa’s bounded decision model. It classifies and '
            'recommends; it is not an Agent, operator, permission engine, or '
            'side-effect executor.',
            style: TextStyle(color: context.masanawa.textMuted),
          ),
          const SizedBox(height: 14),
          const Card(
            child: ListTile(
              leading: Icon(Icons.psychology_alt_outlined),
              title: Text('Decision role'),
              subtitle: Text(
                'Typed questions over prepared state: routing, ambiguity, '
                'risk, escalation, evidence need, and confidence.',
              ),
            ),
          ),
          const Card(
            child: ListTile(
              leading: Icon(Icons.visibility_outlined),
              title: Text('Shadow first'),
              subtitle: Text(
                'New decision classes should begin in shadow mode, compare '
                'against deterministic/general-model behavior, gather outcome '
                'evidence, and require an explicit activation decision.',
              ),
            ),
          ),
          const Card(
            child: ListTile(
              leading: Icon(Icons.security_outlined),
              title: Text('No authority'),
              subtitle: Text(
                'A JEV result can never grant a capability, approve a payment, '
                'authorize a destructive mutation, bypass current authority, '
                'or replace reconciliation/provider truth.',
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'Admin decision flow',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          const _DecisionStep(
            number: 1,
            title: 'Operator → Gwani',
            text: 'You tell Gwani what you want done.',
          ),
          const _DecisionStep(
            number: 2,
            title: 'Gwani proposes canonical actions',
            text:
                'Gwani interprets the request and prepares explicit admin actions.',
          ),
          const _DecisionStep(
            number: 3,
            title: 'JEV evaluates bounded questions',
            text:
                'JEV can classify intent fit, ambiguity, risk, evidence need, '
                'escalation, or confidence.',
          ),
          const _DecisionStep(
            number: 4,
            title: 'Deterministic policy decides authority',
            text:
                'Masanawa intersects operator authority, Character delegation, '
                'tool capability, action risk, resource scope, and approvals.',
          ),
          const _DecisionStep(
            number: 5,
            title: 'Canonical command executes',
            text:
                'Only admitted actions cross the domain command, Operation, '
                'provider, receipt, and reconciliation boundaries.',
          ),
          const _DecisionStep(
            number: 6,
            title: 'Evidence returns to Gwani',
            text:
                'Gwani explains the verified outcome to you; JEV never invents '
                'execution truth.',
          ),
          const SizedBox(height: 18),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(
                    Icons.info_outline,
                    color: context.masanawa.brand,
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Text(
                      'Live JEV definitions, replay metrics, disagreement '
                      'rates, calibration, and activation controls will appear '
                      'here only after the canonical Decisions runtime exposes '
                      'an authorized admin read/release contract. This screen '
                      'does not fabricate that authority.',
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      );
}

class _DecisionStep extends StatelessWidget {
  const _DecisionStep({
    required this.number,
    required this.title,
    required this.text,
  });

  final int number;
  final String title;
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CircleAvatar(
              radius: 16,
              backgroundColor: context.masanawa.surfaceMuted,
              child: Text('$number'),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: Theme.of(context).textTheme.titleSmall),
                  const SizedBox(height: 2),
                  Text(text),
                ],
              ),
            ),
          ],
        ),
      );
}
