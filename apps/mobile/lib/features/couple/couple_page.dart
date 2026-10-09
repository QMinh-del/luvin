import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:luvin/core/platform/sensitive_clipboard.dart';
import 'package:luvin/core/session/auth_session.dart';
import 'package:luvin/core/theme/luvin_theme.dart';
import 'package:luvin/core/widgets/app_button.dart';
import 'package:luvin/core/widgets/app_feedback.dart';
import 'package:luvin/core/widgets/app_skeleton.dart';
import 'package:luvin/features/couple/data/couple_api.dart';
import 'package:luvin/features/session/session_controller.dart';
import 'package:luvin/l10n/app_localizations.dart';

class CouplePage extends ConsumerStatefulWidget {
  const CouplePage({super.key});

  @override
  ConsumerState<CouplePage> createState() => _CouplePageState();
}

class _CouplePageState extends ConsumerState<CouplePage> {
  static const _clipboard = SensitiveClipboard();

  final _username = TextEditingController();
  final _code = TextEditingController();
  List<CoupleSummary> _couples = const [];
  PairingCodeIssue? _issued;
  PairingCodeStatus? _codeStatus;
  String? _error;
  bool _loading = true;
  bool _busy = false;
  Timer? _poll;
  StreamSubscription<RealtimeEvent>? _events;

  @override
  void initState() {
    super.initState();
    Future<void>.microtask(_reload);
    _events = ref.read(realtimeEventsProvider).listen((event) {
      if (event.event == 'couple.partnership.changed.v1' ||
          event.event == 'connection.invitation.created.v1') {
        unawaited(_refreshQuiet());
      }
    });
    _poll = Timer.periodic(const Duration(seconds: 45), (_) {
      unawaited(_refreshQuiet());
    });
  }

  @override
  void dispose() {
    _poll?.cancel();
    unawaited(_events?.cancel());
    _username.dispose();
    _code.dispose();
    super.dispose();
  }

  Future<void> _refreshQuiet() async {
    if (_busy) {
      return;
    }
    try {
      final couples = await ref.read(coupleRepositoryProvider).list();
      if (!mounted || _sameCouples(couples, _couples)) {
        return;
      }
      setState(() => _couples = couples);
    } on ApiException {
      return;
    }
  }

  bool _sameCouples(List<CoupleSummary> next, List<CoupleSummary> current) {
    if (next.length != current.length) {
      return false;
    }
    for (var index = 0; index < next.length; index += 1) {
      final left = next[index];
      final right = current[index];
      if (left.connectionId != right.connectionId ||
          left.state != right.state ||
          left.invitationId != right.invitationId) {
        return false;
      }
      if (left.partners.length != right.partners.length) {
        return false;
      }
      for (var partner = 0; partner < left.partners.length; partner += 1) {
        if (left.partners[partner].userId != right.partners[partner].userId ||
            left.partners[partner].membershipState !=
                right.partners[partner].membershipState) {
          return false;
        }
      }
    }
    return true;
  }

  Future<void> _reload() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repository = ref.read(coupleRepositoryProvider);
      final couples = await repository.list();
      final status = _pendingOrActive(couples) == null
          ? await repository.currentPairingCode()
          : null;
      if (mounted) {
        setState(() {
          _couples = couples;
          _codeStatus = status;
        });
      }
    } on ApiException catch (error) {
      if (mounted) {
        setState(() => _error = error.code);
      }
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _run(Future<void> Function() action) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await action();
      final couples = await ref.read(coupleRepositoryProvider).list();
      if (mounted) {
        setState(() => _couples = couples);
      }
    } on ApiException catch (error) {
      if (mounted) {
        setState(() => _error = error.code);
      }
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final userId = ref.watch(sessionProvider).session?.userId;
    final open = _pendingOrActive(_couples);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.navCouple)),
      body: _loading
          ? _PairingSkeleton(label: l10n.coupleLoading)
          : SafeArea(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                children: [
                  Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 640),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          if (open == null) const _PairingHero(),
                          if (open == null) ...[
                            Text(
                              l10n.coupleHeroTitle,
                              style: Theme.of(context).textTheme.headlineMedium,
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 8),
                            Text(
                              l10n.coupleHeroBody,
                              style: Theme.of(context).textTheme.bodyMedium,
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 24),
                          ],
                          if (_error != null) ...[
                            _ErrorPanel(message: _errorMessage(l10n)),
                            const SizedBox(height: 16),
                          ],
                          if (open == null)
                            ..._requestForm(l10n)
                          else
                            ..._openCouple(context, l10n, userId, open),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  CoupleSummary? _pendingOrActive(List<CoupleSummary> couples) {
    for (final item in couples) {
      if (item.state == 'PENDING' || item.state == 'ACTIVE') {
        return item;
      }
    }
    return null;
  }

  String _clock(DateTime value) {
    final local = value.toLocal();
    final hour = local.hour.toString().padLeft(2, '0');
    final minute = local.minute.toString().padLeft(2, '0');
    return '$hour:$minute';
  }

  String _errorMessage(AppLocalizations l10n) {
    return switch (_error) {
      'PAIRING_CODE_INVALID' => l10n.coupleErrorInvalidCode,
      'COUPLE_SELF' => l10n.coupleErrorSelf,
      'COUPLE_BLOCKED' => l10n.coupleErrorBlocked,
      'COUPLE_ALREADY_CONNECTED' => l10n.coupleErrorAlreadyConnected,
      'COUPLE_USERNAME_INVALID' => l10n.coupleErrorUsernameInvalid,
      _ => l10n.coupleErrorGeneric,
    };
  }

  Future<void> _copyCode(String code, AppLocalizations l10n) async {
    final systemConfirmsCopy = await _clipboard.copy(
      text: code,
      label: l10n.coupleCodeLabel,
    );
    if (mounted && !systemConfirmsCopy) {
      showAppSnackbar(context: context, message: l10n.coupleCodeCopied);
    }
  }

  List<Widget> _requestForm(AppLocalizations l10n) {
    final issued = _issued;
    final activeUntil = _codeStatus?.expiresAt;
    return [
      _PairingSection(
        icon: Icons.alternate_email_rounded,
        title: l10n.coupleUsernameTitle,
        body: l10n.coupleUsernameBody,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              key: const Key('couple-username'),
              controller: _username,
              decoration: InputDecoration(labelText: l10n.fieldUsername),
              enabled: !_busy,
              autocorrect: false,
              enableSuggestions: false,
              inputFormatters: [LengthLimitingTextInputFormatter(20)],
              textInputAction: TextInputAction.done,
              onSubmitted: _busy
                  ? null
                  : (_) => _run(() async {
                      await ref
                          .read(coupleRepositoryProvider)
                          .requestByUsername(_username.text.trim());
                      _issued = null;
                    }),
            ),
            const SizedBox(height: 12),
            AppButton(
              label: l10n.coupleSendRequest,
              icon: Icons.send_rounded,
              loading: _busy,
              expand: true,
              onPressed: _busy
                  ? null
                  : () => _run(() async {
                      await ref
                          .read(coupleRepositoryProvider)
                          .requestByUsername(_username.text.trim());
                      _issued = null;
                    }),
            ),
          ],
        ),
      ),
      const SizedBox(height: 16),
      _PairingSection(
        icon: Icons.key_rounded,
        title: l10n.coupleCreateCodeTitle,
        body: l10n.coupleCreateCodeBody,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (issued != null)
              _IssuedCodeCard(
                code: issued.code,
                message: l10n.coupleCodeShownOnce,
                expiry: l10n.coupleCodeExpires(_clock(issued.expiresAt)),
                copyLabel: l10n.coupleCopyCode,
                onCopy: () => _copyCode(issued.code, l10n),
              )
            else if (_codeStatus?.active == true && activeUntil != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(l10n.coupleCodeActive(_clock(activeUntil))),
              ),
            AppButton(
              key: const Key('couple-create-code-button'),
              label: l10n.coupleCreateCode,
              icon: Icons.add_link_rounded,
              loading: _busy,
              expand: true,
              variant: AppButtonVariant.secondary,
              onPressed: _busy
                  ? null
                  : () => _run(() async {
                      final issue = await ref
                          .read(coupleRepositoryProvider)
                          .createPairingCode();
                      _issued = issue;
                    }),
            ),
          ],
        ),
      ),
      const SizedBox(height: 16),
      _PairingSection(
        icon: Icons.link_rounded,
        title: l10n.coupleEnterCodeTitle,
        body: l10n.coupleEnterCodeBody,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              key: const Key('couple-code'),
              controller: _code,
              decoration: InputDecoration(
                labelText: l10n.coupleCodeLabel,
                counterText: '',
              ),
              enabled: !_busy,
              autocorrect: false,
              enableSuggestions: false,
              maxLength: 8,
              textCapitalization: TextCapitalization.characters,
              inputFormatters: const [_PairingCodeFormatter()],
              textInputAction: TextInputAction.done,
              onSubmitted: _busy
                  ? null
                  : (_) => _run(() async {
                      await ref
                          .read(coupleRepositoryProvider)
                          .redeemPairingCode(_code.text.trim());
                      _issued = null;
                    }),
            ),
            const SizedBox(height: 12),
            AppButton(
              key: const Key('couple-redeem-code-button'),
              label: l10n.coupleRedeemCode,
              icon: Icons.arrow_forward_rounded,
              loading: _busy,
              expand: true,
              onPressed: _busy
                  ? null
                  : () => _run(() async {
                      await ref
                          .read(coupleRepositoryProvider)
                          .redeemPairingCode(_code.text.trim());
                      _issued = null;
                    }),
            ),
          ],
        ),
      ),
    ];
  }

  List<Widget> _openCouple(
    BuildContext context,
    AppLocalizations l10n,
    String? userId,
    CoupleSummary current,
  ) {
    final invited = current.partners.any(
      (partner) =>
          partner.userId == userId && partner.membershipState == 'INVITED',
    );
    final status = current.state == 'ACTIVE'
        ? l10n.coupleActive
        : invited
        ? l10n.couplePending
        : l10n.coupleWaiting;
    return [
      Row(
        children: [
          Expanded(child: Text(status)),
          if (current.state == 'ACTIVE')
            PopupMenuButton<String>(
              tooltip: l10n.coupleMore,
              onSelected: (value) =>
                  _confirmCoupleAction(context, l10n, value, current, userId),
              itemBuilder: (context) => [
                PopupMenuItem(
                  value: 'disconnect',
                  child: Text(l10n.coupleDisconnect),
                ),
                PopupMenuItem(value: 'block', child: Text(l10n.coupleBlock)),
              ],
            ),
        ],
      ),
      const SizedBox(height: 12),
      for (final partner in current.partners)
        if (partner.userId != userId)
          ListTile(
            title: Text(partner.displayName),
            subtitle: Text(partner.username),
          ),
      if (current.state == 'PENDING' &&
          invited &&
          current.invitationId != null) ...[
        FilledButton(
          onPressed: _busy
              ? null
              : () => _run(() async {
                  await ref
                      .read(coupleRepositoryProvider)
                      .accept(current.invitationId!);
                }),
          child: Text(l10n.coupleAccept),
        ),
        TextButton(
          onPressed: _busy
              ? null
              : () => _run(() async {
                  await ref
                      .read(coupleRepositoryProvider)
                      .reject(current.invitationId!);
                }),
          child: Text(l10n.coupleReject),
        ),
      ],
    ];
  }

  Future<void> _confirmCoupleAction(
    BuildContext context,
    AppLocalizations l10n,
    String action,
    CoupleSummary current,
    String? userId,
  ) async {
    final disconnecting = action == 'disconnect';
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(disconnecting ? l10n.coupleDisconnect : l10n.coupleBlock),
        content: Text(
          disconnecting
              ? l10n.coupleDisconnectConfirm
              : l10n.coupleBlockConfirm,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(l10n.actionCancel),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(
              disconnecting ? l10n.coupleDisconnect : l10n.coupleBlock,
            ),
          ),
        ],
      ),
    );
    if (confirmed != true) {
      return;
    }
    await _run(() async {
      if (disconnecting) {
        await ref
            .read(coupleRepositoryProvider)
            .disconnect(current.connectionId);
        return;
      }
      final partner = current.partners.firstWhere(
        (item) => item.userId != userId,
      );
      await ref.read(coupleRepositoryProvider).block(partner.userId);
    });
  }
}

class _PairingCodeFormatter extends TextInputFormatter {
  const _PairingCodeFormatter();

  static final _allowed = RegExp(r'^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]*$');

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final normalized = newValue.text.toUpperCase().replaceAll(' ', '');
    if (normalized.length > 8 || !_allowed.hasMatch(normalized)) {
      return oldValue;
    }
    return TextEditingValue(
      text: normalized,
      selection: TextSelection.collapsed(offset: normalized.length),
    );
  }
}

class _PairingHero extends StatelessWidget {
  const _PairingHero();

  @override
  Widget build(BuildContext context) {
    final tokens = Theme.of(context).extension<LuvinTokens>()!;
    return Center(
      child: Container(
        width: 112,
        height: 88,
        margin: EdgeInsets.only(bottom: tokens.space4),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(tokens.radius * 2),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              tokens.brandPrimary.withValues(alpha: 0.18),
              tokens.brandWarm.withValues(alpha: 0.18),
            ],
          ),
        ),
        child: Stack(
          alignment: Alignment.center,
          children: [
            Positioned(
              left: 18,
              child: CircleAvatar(
                radius: 23,
                backgroundColor: tokens.brandPrimary,
                child: Icon(
                  Icons.person_rounded,
                  color: Theme.of(context).colorScheme.onPrimary,
                ),
              ),
            ),
            Positioned(
              right: 18,
              child: CircleAvatar(
                radius: 23,
                backgroundColor: tokens.brandWarm,
                child: Icon(
                  Icons.person_rounded,
                  color: Theme.of(context).colorScheme.surface,
                ),
              ),
            ),
            CircleAvatar(
              radius: 14,
              backgroundColor: tokens.surface,
              child: Icon(
                Icons.favorite_rounded,
                size: 17,
                color: tokens.danger,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PairingSection extends StatelessWidget {
  const _PairingSection({
    required this.icon,
    required this.title,
    required this.body,
    required this.child,
  });

  final IconData icon;
  final String title;
  final String body;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final tokens = Theme.of(context).extension<LuvinTokens>()!;
    return Card(
      child: Padding(
        padding: EdgeInsets.all(tokens.space4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                DecoratedBox(
                  decoration: BoxDecoration(
                    color: tokens.brandPrimary.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(tokens.radius),
                  ),
                  child: Padding(
                    padding: EdgeInsets.all(tokens.space2),
                    child: Icon(icon, color: tokens.brandPrimary),
                  ),
                ),
                SizedBox(width: tokens.space3),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      SizedBox(height: tokens.space1),
                      Text(body, style: Theme.of(context).textTheme.bodySmall),
                    ],
                  ),
                ),
              ],
            ),
            SizedBox(height: tokens.space4),
            child,
          ],
        ),
      ),
    );
  }
}

class _IssuedCodeCard extends StatelessWidget {
  const _IssuedCodeCard({
    required this.code,
    required this.message,
    required this.expiry,
    required this.copyLabel,
    required this.onCopy,
  });

  final String code;
  final String message;
  final String expiry;
  final String copyLabel;
  final VoidCallback onCopy;

  @override
  Widget build(BuildContext context) {
    final tokens = Theme.of(context).extension<LuvinTokens>()!;
    return Semantics(
      liveRegion: true,
      child: Container(
        margin: EdgeInsets.only(bottom: tokens.space3),
        padding: EdgeInsets.all(tokens.space3),
        decoration: BoxDecoration(
          color: tokens.brandPrimary.withValues(alpha: 0.08),
          border: Border.all(
            color: tokens.brandPrimary.withValues(alpha: 0.28),
          ),
          borderRadius: BorderRadius.circular(tokens.radius),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: SelectableText(
                    code,
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      letterSpacing: 4,
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  ),
                ),
                IconButton(
                  tooltip: copyLabel,
                  onPressed: onCopy,
                  icon: const Icon(Icons.copy_rounded),
                ),
              ],
            ),
            Text(message, style: Theme.of(context).textTheme.bodySmall),
            SizedBox(height: tokens.space1),
            Text(expiry, style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
      ),
    );
  }
}

class _ErrorPanel extends StatelessWidget {
  const _ErrorPanel({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final tokens = Theme.of(context).extension<LuvinTokens>()!;
    return Semantics(
      liveRegion: true,
      child: Container(
        padding: EdgeInsets.all(tokens.space3),
        decoration: BoxDecoration(
          color: tokens.danger.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(tokens.radius),
          border: Border.all(color: tokens.danger.withValues(alpha: 0.28)),
        ),
        child: Row(
          children: [
            Icon(Icons.error_outline_rounded, color: tokens.danger),
            SizedBox(width: tokens.space2),
            Expanded(child: Text(message)),
          ],
        ),
      ),
    );
  }
}

class _PairingSkeleton extends StatelessWidget {
  const _PairingSkeleton({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final tokens = Theme.of(context).extension<LuvinTokens>()!;
    return SafeArea(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 640),
          child: ListView(
            padding: EdgeInsets.all(tokens.space4),
            children: [
              Center(
                child: AppSkeleton(
                  width: 112,
                  height: 88,
                  semanticLabel: label,
                ),
              ),
              SizedBox(height: tokens.space4),
              const Center(child: AppSkeleton(width: 260, height: 28)),
              SizedBox(height: tokens.space2),
              const Center(child: AppSkeleton(width: 320, height: 18)),
              SizedBox(height: tokens.space6),
              for (var index = 0; index < 3; index++) ...[
                const AppSkeleton(width: double.infinity, height: 176),
                SizedBox(height: tokens.space4),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
