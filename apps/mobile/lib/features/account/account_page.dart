import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:luvin/core/session/auth_session.dart';
import 'package:luvin/core/telemetry/product_analytics.dart';
import 'package:luvin/features/session/session_controller.dart';
import 'package:luvin/features/social/data/social_api.dart';
import 'package:luvin/l10n/app_localizations.dart';
import 'package:luvin/locale_controller.dart';

class AccountPage extends ConsumerStatefulWidget {
  const AccountPage({super.key});

  @override
  ConsumerState<AccountPage> createState() => _AccountPageState();
}

class _AccountPageState extends ConsumerState<AccountPage> {
  final _name = TextEditingController();
  String? _username;
  String? _error;
  bool _loading = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    Future<void>.microtask(_load);
  }

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final profile = await ref.read(socialRepositoryProvider).profile();
      if (!mounted) {
        return;
      }
      _name.text = profile.displayName;
      setState(() {
        _username = profile.username;
        _loading = false;
      });
    } on ApiException catch (error) {
      if (mounted) {
        setState(() {
          _error = error.code;
          _loading = false;
        });
      }
    } on Object {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final profile = await ref
          .read(socialRepositoryProvider)
          .updateProfile(_name.text);
      if (mounted) {
        setState(() => _username = profile.username);
      }
    } on ApiException catch (error) {
      if (mounted) {
        setState(() => _error = error.code);
      }
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final analytics = ref.watch(analyticsProvider);
    final analyticsConsent = ref.watch(analyticsConsentProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.navAccount)),
      body: ListView(
              padding: const EdgeInsets.all(24),
              children: [
                if (_username != null) Text('@$_username'),
                const SizedBox(height: 12),
                TextField(
                  controller: _name,
                  enabled: !_loading && !_saving,
                  decoration: InputDecoration(labelText: l10n.profileName),
                ),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: _saving ? null : _save,
                  child: Text(l10n.profileSave),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    _error!,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ],
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: () {
                    ref
                        .read(localeProvider.notifier)
                        .setLocale(const Locale('en'));
                    unawaited(
                      analytics.feature(AnalyticsFeature.languageChanged),
                    );
                  },
                  child: Text(l10n.languageEnglish),
                ),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: () {
                    ref
                        .read(localeProvider.notifier)
                        .setLocale(const Locale('vi'));
                    unawaited(
                      analytics.feature(AnalyticsFeature.languageChanged),
                    );
                  },
                  child: Text(l10n.languageVietnamese),
                ),
                const SizedBox(height: 24),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(l10n.analyticsConsentTitle),
                  subtitle: Text(l10n.analyticsConsentBody),
                  value: analyticsConsent.value ?? false,
                  onChanged: analyticsConsent.isLoading
                      ? null
                      : ref.read(analyticsConsentProvider.notifier).setConsent,
                ),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: () => ref.read(sessionProvider.notifier).logout(),
                  child: Text(l10n.actionLogout),
                ),
              ],
            ),
    );
  }
}
