import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import 'fan_account_repository.dart';

/// C05: private account landing, not a public fan profile.
/// AF00 injects authenticated Dio and the existing nested-tab navigation.
/// Absent destinations are visibly unavailable, never silently redirected to Chats.
class FanAccountScreen extends StatefulWidget {
  const FanAccountScreen({
    super.key,
    required this.accountKey,
    required this.repository,
    this.onSignIn,
    this.onCompleteSetup,
    this.onFollowing,
    this.onJoinedRooms,
    this.onSaved,
    this.onSubscriptions,
    this.onWallet,
    this.onSettings,
  });

  final String accountKey;
  final FanAccountRepository repository;
  final VoidCallback? onSignIn;
  final VoidCallback? onCompleteSetup;
  final VoidCallback? onFollowing;
  final VoidCallback? onJoinedRooms;
  final VoidCallback? onSaved;
  final VoidCallback? onSubscriptions;
  final VoidCallback? onWallet;
  final VoidCallback? onSettings;

  @override
  State<FanAccountScreen> createState() => _FanAccountScreenState();
}

enum _AccountLoadState { loading, ready, missing, denied, offline, disabled, stale, error }

class _FanAccountScreenState extends State<FanAccountScreen> {
  FanAccountSummary? _profile;
  _AccountLoadState _state = _AccountLoadState.loading;
  int _generation = 0;

  bool get _active =>
      widget.accountKey.isNotEmpty &&
      widget.accountKey == widget.repository.accountKey &&
      widget.repository.isCurrentAccount;

  bool get _ha => Localizations.localeOf(context).languageCode == 'ha';
  String _t(String en, String ha) => _ha ? ha : en;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant FanAccountScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.accountKey != widget.accountKey ||
        !identical(oldWidget.repository, widget.repository) ||
        !widget.repository.isCurrentAccount) {
      // Erase the prior fan's projection immediately, before a new frame paints.
      _generation++;
      _profile = null;
      _state = _AccountLoadState.loading;
      _load();
    }
  }

  @override
  void dispose() {
    _generation++;
    super.dispose();
  }

  Future<void> _load() async {
    final generation = ++_generation;
    if (!_active) {
      if (mounted) {
        setState(() {
          _profile = null;
          _state = _AccountLoadState.denied;
        });
      }
      return;
    }
    setState(() => _state = _AccountLoadState.loading);
    try {
      final profile = await widget.repository.read();
      if (!mounted || generation != _generation || !_active) return;
      setState(() {
        _profile = profile;
        _state = _AccountLoadState.ready;
      });
    } catch (error) {
      if (!mounted || generation != _generation) return;
      final next = _classify(error);
      setState(() {
        _state = next;
        // Never retain private data after authorization loss or account change.
        if (next == _AccountLoadState.denied ||
            next == _AccountLoadState.missing ||
            !_active) {
          _profile = null;
        }
      });
    }
  }

  _AccountLoadState _classify(Object error) {
    if (!_active || error is StateError) return _AccountLoadState.denied;
    if (error is DioException) {
      switch (error.response?.statusCode) {
        case 401:
        case 403:
          return _AccountLoadState.denied;
        case 404:
          return _AccountLoadState.missing;
        case 409:
          return _AccountLoadState.stale;
        case 503:
          return _AccountLoadState.disabled;
      }
      if (error.response == null) return _AccountLoadState.offline;
    }
    return _AccountLoadState.error;
  }

  Widget _message(IconData icon, String title, {bool signIn = false}) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 42),
          const SizedBox(height: 12),
          Text(title, textAlign: TextAlign.center),
          const SizedBox(height: 16),
          OutlinedButton(
            onPressed: signIn ? widget.onSignIn : _load,
            child: Text(signIn ? _t('Sign in', 'Shiga') : _t('Retry', 'Sake gwadawa')),
          ),
        ]),
      ),
    );
  }

  Widget _destination({
    required String keyName,
    required IconData icon,
    required String english,
    required String hausa,
    required VoidCallback? onTap,
  }) => ListTile(
        key: Key('account-' + keyName),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
        leading: Icon(icon),
        title: Text(_t(english, hausa)),
        trailing: onTap == null
            ? const Icon(Icons.lock_outline, size: 18)
            : const Icon(Icons.chevron_right),
        enabled: onTap != null && _active,
        onTap: onTap,
      );

  Widget _accountHome(FanAccountSummary profile, {required bool offline}) {
    final name = profile.displayName?.trim();
    final display = name == null || name.isEmpty
        ? _t('Masanawa fan', 'Mai bin Masanawa')
        : name;
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          if (offline)
            MaterialBanner(
              content: Text(_t(
                'Offline: showing this account’s last loaded details. Some links need internet.',
                'Babu intanet: ana nuna bayanan asusun da aka ɗauka. Wasu hanyoyi na buƙatar intanet.',
              )),
              actions: [
                TextButton(onPressed: _load, child: Text(_t('Retry', 'Sake gwadawa'))),
              ],
            ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 20, 16, 8),
            child: Row(children: [
              CircleAvatar(
                radius: 30,
                child: Text(display.characters.first.toUpperCase()),
              ),
              const SizedBox(width: 16),
              Expanded(child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(display, maxLines: 2, overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 4),
                  Text(_t('Private fan account', 'Asusun mai bi na sirri'),
                      style: Theme.of(context).textTheme.bodySmall),
                ],
              )),
            ]),
          ),
          if (!profile.completed)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: OutlinedButton.icon(
                key: const Key('account-complete-setup'),
                onPressed: widget.onCompleteSetup,
                icon: const Icon(Icons.edit_outlined),
                label: Text(_t('Complete your setup', 'Kammala saitin asusunka')),
              ),
            ),
          const Divider(),
          _destination(keyName: 'following', icon: Icons.people_outline,
              english: 'Following', hausa: 'Masana da ake bi',
              onTap: widget.onFollowing),
          _destination(keyName: 'rooms', icon: Icons.school_outlined,
              english: 'Joined Rooms', hausa: 'Ɗakunan da aka shiga',
              onTap: widget.onJoinedRooms),
          _destination(keyName: 'saved', icon: Icons.bookmark_outline,
              english: 'Saved', hausa: 'Abubuwan da aka ajiye',
              onTap: widget.onSaved),
          _destination(keyName: 'subscriptions', icon: Icons.card_membership_outlined,
              english: 'Subscriptions', hausa: 'Biyan kuɗin rajista',
              onTap: widget.onSubscriptions),
          _destination(keyName: 'wallet', icon: Icons.account_balance_wallet_outlined,
              english: 'Wallet', hausa: 'Wallet',
              onTap: widget.onWallet),
          const Divider(),
          _destination(keyName: 'settings', icon: Icons.settings_outlined,
              english: 'Settings and privacy', hausa: 'Saituna da sirri',
              onTap: widget.onSettings),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    // Never show the previous account's details even for one stale build.
    final active = _active;
    final profile = active ? _profile : null;
    final state = active ? _state : _AccountLoadState.denied;
    final Widget body;
    if (profile != null && (state == _AccountLoadState.ready ||
        state == _AccountLoadState.offline ||
        state == _AccountLoadState.stale ||
        state == _AccountLoadState.error)) {
      body = _accountHome(profile, offline: state != _AccountLoadState.ready);
    } else {
      body = switch (state) {
        _AccountLoadState.loading => const Center(
            child: CircularProgressIndicator(key: Key('account-loading'))),
        _AccountLoadState.denied => _message(Icons.lock_outline,
            _t('Sign in to view your private account.', 'Shiga don ganin asusunka na sirri.'),
            signIn: true),
        _AccountLoadState.missing => _message(Icons.person_add_alt_outlined,
            _t('Account setup is incomplete.', 'Ba a kammala saitin asusu ba.')),
        _AccountLoadState.disabled => _message(Icons.pause_circle_outline,
            _t('Account information is temporarily unavailable.', 'An dakatar da bayanan asusu na ɗan lokaci.')),
        _AccountLoadState.stale => _message(Icons.sync_problem_outlined,
            _t('Account information changed. Refresh.', 'Bayanan asusu sun sauya. Sake ɗaukowa.')),
        _AccountLoadState.offline => _message(Icons.wifi_off,
            _t('Offline. Connect and retry.', 'Babu intanet. Haɗa sannan a sake.')),
        _AccountLoadState.error => _message(Icons.error_outline,
            _t('Could not load your account.', 'Ba a iya ɗauko asusun ba.')),
        _AccountLoadState.ready => _message(Icons.person_outline,
            _t('Account information is empty.', 'Bayanan asusu babu su.')),
      };
    }
    return Scaffold(
      appBar: AppBar(
        title: Text(_t('Account', 'Asusu')),
        actions: [
          IconButton(
            tooltip: _t('Refresh account', 'Sake ɗauko asusu'),
            onPressed: active ? _load : null,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: SafeArea(child: body),
    );
  }
}
