import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:luvin/core/session/auth_session.dart';
import 'package:luvin/core/theme/luvin_theme.dart';
import 'package:luvin/core/widgets/app_button.dart';
import 'package:luvin/features/session/session_controller.dart';
import 'package:luvin/l10n/app_localizations.dart';

class AccessGatePage extends ConsumerWidget {
  const AccessGatePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final session = ref.watch(sessionProvider).session;
    final content = _content(l10n, session);
    final tokens = Theme.of(context).extension<LuvinTokens>()!;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.appTitle)),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: EdgeInsets.all(tokens.space6),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 480),
              child: Semantics(
                liveRegion: true,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    ExcludeSemantics(
                      child: Icon(
                        content.icon,
                        size: 40,
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                    SizedBox(height: tokens.space4),
                    Text(
                      content.title,
                      style: Theme.of(context).textTheme.headlineSmall,
                      textAlign: TextAlign.center,
                    ),
                    SizedBox(height: tokens.space2),
                    Text(content.body, textAlign: TextAlign.center),
                    SizedBox(height: tokens.space6),
                    AppButton(
                      label: l10n.actionLogout,
                      onPressed: () =>
                          ref.read(sessionProvider.notifier).logout(),
                      variant: AppButtonVariant.secondary,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  _GateContent _content(AppLocalizations l10n, AuthSession? session) {
    if (session == null) {
      return _GateContent(
        icon: Icons.lock_outline,
        title: l10n.sessionExpired,
        body: l10n.stateAccessRevoked,
      );
    }
    if (session.requiredLegalActions.isNotEmpty) {
      return _GateContent(
        icon: Icons.description_outlined,
        title: l10n.legalUpdateRequiredTitle,
        body: l10n.legalUpdateRequiredBody,
      );
    }
    return switch (session.accountState) {
      AccountState.pendingDeletion => _GateContent(
        icon: Icons.schedule_outlined,
        title: l10n.accountPendingDeletionTitle,
        body: l10n.accountPendingDeletionBody,
      ),
      AccountState.ageIneligible => _GateContent(
        icon: Icons.person_off_outlined,
        title: l10n.accountAgeIneligibleTitle,
        body: l10n.accountAgeIneligibleBody,
      ),
      AccountState.suspended => _GateContent(
        icon: Icons.block_outlined,
        title: l10n.accountSuspendedTitle,
        body: l10n.accountSuspendedBody,
      ),
      AccountState.deleted || AccountState.unknown => _GateContent(
        icon: Icons.lock_outline,
        title: l10n.accountUnavailableTitle,
        body: l10n.accountUnavailableBody,
      ),
      AccountState.active => _GateContent(
        icon: Icons.lock_outline,
        title: l10n.accountUnavailableTitle,
        body: l10n.accountUnavailableBody,
      ),
    };
  }
}

class _GateContent {
  const _GateContent({
    required this.icon,
    required this.title,
    required this.body,
  });

  final IconData icon;
  final String title;
  final String body;
}
