import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../social/talk_social_profiles.dart';
import '../../state/talk_social_profile_state.dart';
import '../../theme/masanawa_theme.dart';
import '../talks/talk_home_screen.dart';
import 'persona_report_sheet.dart';

class PersonaProfileScreen extends ConsumerWidget {
  const PersonaProfileScreen({
    super.key,
    required this.publicId,
    this.onOpenTalk,
    this.onOpenOwner,
    this.onUsePersona,
  });

  final String publicId;
  final void Function(String talkId)? onOpenTalk;
  final void Function(String handle)? onOpenOwner;
  final void Function(PersonaProfile persona)? onUsePersona;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncProfile = ref.watch(personaProfileProvider(publicId));
    return asyncProfile.when(
      loading: () => const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      ),
      error: (_, __) => _PersonaUnavailable(
        label: 'Couldn’t load this AI persona.',
        onRetry: () => ref.invalidate(personaProfileProvider(publicId)),
      ),
      data: (profile) {
        if (profile == null) {
          return const _PersonaUnavailable(
            label: 'This AI persona is unavailable.',
          );
        }
        return _PersonaBody(
          profile: profile,
          onOpenTalk: onOpenTalk,
          onOpenOwner: onOpenOwner,
          onUsePersona: onUsePersona,
        );
      },
    );
  }
}

class _PersonaBody extends StatelessWidget {
  const _PersonaBody({
    required this.profile,
    this.onOpenTalk,
    this.onOpenOwner,
    this.onUsePersona,
  });

  final PersonaProfile profile;
  final void Function(String talkId)? onOpenTalk;
  final void Function(String handle)? onOpenOwner;
  final void Function(PersonaProfile persona)? onUsePersona;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final avatar = profile.avatarUrl?.trim();
    final isExpert = profile.kind == PersonaProfileKind.expert;
    final ownerHandle = profile.ownerHandle?.trim();

    return Scaffold(
      backgroundColor: u.surfaceCard,
      appBar: AppBar(
        title: Text(isExpert ? 'Expert' : 'Twin'),
        actions: [IconButton(
          key: const ValueKey('persona-profile-report'),
          tooltip: 'Report AI persona',
          icon: const Icon(Icons.flag_outlined),
          onPressed: profile.publicId.trim().isEmpty ? null : () => showPersonaReportSheet(
            context, publicId: profile.publicId, displayName: profile.displayName),
        )],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(12, 18, 12, 28),
        children: [
          Center(
            child: CircleAvatar(
              radius: 45,
              backgroundColor: u.surfaceMuted,
              backgroundImage:
                  avatar != null && avatar.isNotEmpty ? NetworkImage(avatar) : null,
              child: avatar == null || avatar.isEmpty
                  ? Icon(
                      isExpert
                          ? Icons.verified_rounded
                          : Icons.auto_awesome_rounded,
                      color: u.brandStrong,
                      size: 42,
                    )
                  : null,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Flexible(
                child: Text(
                  profile.displayName,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: u.textPrimary,
                    fontSize: 23,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              if (profile.isVerified || isExpert) ...[
                const SizedBox(width: 6),
                Icon(Icons.verified_rounded, color: u.brandStrong, size: 20),
              ],
            ],
          ),
          const SizedBox(height: 4),
          Text(
            isExpert
                ? (profile.role.trim().isEmpty
                    ? 'Masanawa Expert'
                    : 'Masanawa Expert · ' + profile.role)
                : (profile.role.trim().isEmpty
                    ? 'User Twin'
                    : 'User Twin · ' + profile.role),
            textAlign: TextAlign.center,
            style: TextStyle(color: u.textMuted, fontSize: 13),
          ),
          if (profile.bio.trim().isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              profile.bio,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: u.textPrimary,
                fontSize: 14,
                height: 1.35,
              ),
            ),
          ],
          if (!isExpert &&
              ownerHandle != null &&
              ownerHandle.isNotEmpty) ...[
            const SizedBox(height: 12),
            Center(
              child: TextButton.icon(
                onPressed:
                    onOpenOwner == null ? null : () => onOpenOwner!(ownerHandle),
                icon: const Icon(Icons.person_outline_rounded, size: 18),
                label: Text(
                  profile.ownerDisplayName?.trim().isNotEmpty == true
                      ? 'Owned by ' + profile.ownerDisplayName!
                      : 'View owner',
                ),
              ),
            ),
          ],
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: u.surfaceCard,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: u.structuralBorder),
            ),
            child: Row(
              children: [
                Expanded(
                  child: _PersonaMetric(
                    label: 'Seat fee',
                    value: profile.seatFeeLabel.trim().isEmpty
                        ? 'Price on quote'
                        : profile.seatFeeLabel,
                  ),
                ),
                Container(
                  width: 1,
                  height: 38,
                  color: u.structuralBorder,
                ),
                Expanded(
                  child: _PersonaMetric(
                    label: 'Status',
                    value: profile.isAvailable ? 'Available' : 'Unavailable',
                  ),
                ),
              ],
            ),
          ),
          if (profile.topics.isNotEmpty) ...[
            const SizedBox(height: 14),
            Wrap(
              spacing: 7,
              runSpacing: 7,
              alignment: WrapAlignment.center,
              children: [
                for (final topic in profile.topics)
                  Chip(
                    label: Text(topic),
                    visualDensity: VisualDensity.compact,
                  ),
              ],
            ),
          ],
          if (onUsePersona != null) ...[
            const SizedBox(height: 16),
            FilledButton.icon(
              key: const ValueKey('persona-use-in-talk'),
              onPressed:
                  profile.isAvailable ? () => onUsePersona!(profile) : null,
              icon: const Icon(Icons.podcasts_rounded),
              label: const Text('Use in a Talk'),
            ),
          ],
          const SizedBox(height: 22),
          Text(
            'Talk appearances',
            style: TextStyle(
              color: u.textPrimary,
              fontSize: 17,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 9),
          if (profile.appearances.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 26),
              child: Text(
                'No public Talk appearances yet.',
                textAlign: TextAlign.center,
                style: TextStyle(color: u.textMuted),
              ),
            )
          else
            for (var i = 0; i < profile.appearances.length; i++) ...[
              TalkFeedCard(
                talk: profile.appearances[i],
                onTap: onOpenTalk == null
                    ? null
                    : () => onOpenTalk!(profile.appearances[i].id),
              ),
              if (i != profile.appearances.length - 1)
                const SizedBox(height: 10),
            ],
        ],
      ),
    );
  }
}

class _PersonaMetric extends StatelessWidget {
  const _PersonaMetric({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Column(
      children: [
        Text(
          value,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: u.textPrimary,
            fontSize: 15,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 3),
        Text(
          label,
          style: TextStyle(color: u.textMuted, fontSize: 11.5),
        ),
      ],
    );
  }
}

class _PersonaUnavailable extends StatelessWidget {
  const _PersonaUnavailable({required this.label, this.onRetry});

  final String label;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.auto_awesome_outlined, size: 42),
              const SizedBox(height: 12),
              Text(label, textAlign: TextAlign.center),
              if (onRetry != null) ...[
                const SizedBox(height: 12),
                FilledButton(onPressed: onRetry, child: const Text('Try again')),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

