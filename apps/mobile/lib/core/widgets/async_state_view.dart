import 'package:flutter/material.dart';
import 'package:luvin/core/theme/luvin_theme.dart';
import 'package:luvin/l10n/app_localizations.dart';

enum AsyncViewState {
  loading,
  empty,
  offline,
  error,
  permissionDenied,
  stale,
  revoked,
  ready,
}

class AsyncStateView extends StatelessWidget {
  const AsyncStateView({
    super.key,
    required this.state,
    required this.child,
    this.onRetry,
  });

  final AsyncViewState state;
  final Widget child;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    switch (state) {
      case AsyncViewState.loading:
        return Center(
          child: Semantics(
            label: l10n.stateLoading,
            child: const CircularProgressIndicator(),
          ),
        );
      case AsyncViewState.empty:
        return Center(child: Text(l10n.stateEmpty));
      case AsyncViewState.offline:
        return _Message(
          text: l10n.stateOffline,
          onRetry: onRetry,
          retryLabel: l10n.actionRetry,
        );
      case AsyncViewState.error:
        return _Message(
          text: l10n.stateError,
          onRetry: onRetry,
          retryLabel: l10n.actionRetry,
        );
      case AsyncViewState.permissionDenied:
        return _Message(
          text: l10n.statePermissionDenied,
          onRetry: onRetry,
          retryLabel: l10n.actionOpenSettings,
        );
      case AsyncViewState.stale:
        return _Message(
          text: l10n.stateStale,
          onRetry: onRetry,
          retryLabel: l10n.actionRetry,
        );
      case AsyncViewState.revoked:
        return _Message(
          text: l10n.stateAccessRevoked,
          onRetry: onRetry,
          retryLabel: l10n.actionRetry,
        );
      case AsyncViewState.ready:
        return child;
    }
  }
}

class _Message extends StatelessWidget {
  const _Message({required this.text, required this.retryLabel, this.onRetry});

  final String text;
  final String retryLabel;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final tokens = Theme.of(context).extension<LuvinTokens>()!;
    return Center(
      child: Padding(
        padding: EdgeInsets.all(tokens.space6),
        child: Semantics(
          liveRegion: true,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(text, textAlign: TextAlign.center),
              if (onRetry != null) ...[
                SizedBox(height: tokens.space4),
                FilledButton(onPressed: onRetry, child: Text(retryLabel)),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
