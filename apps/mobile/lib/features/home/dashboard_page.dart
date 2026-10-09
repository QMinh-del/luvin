import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:luvin/core/session/auth_session.dart';
import 'package:luvin/features/chat/data/chat_api.dart';
import 'package:luvin/features/couple/data/couple_api.dart';
import 'package:luvin/features/session/session_controller.dart';
import 'package:luvin/l10n/app_localizations.dart';

class DashboardPage extends ConsumerStatefulWidget {
  const DashboardPage({super.key, this.openSettings});

  final Future<void> Function()? openSettings;

  @override
  ConsumerState<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends ConsumerState<DashboardPage>
    with SingleTickerProviderStateMixin {
  CoupleSummary? _couple;
  var _loading = true;
  StreamSubscription<RealtimeEvent>? _events;
  late final AnimationController _heart;

  @override
  void initState() {
    super.initState();
    _heart = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    _events = ref.read(realtimeEventsProvider).listen((event) {
      if (event.event == 'couple.partnership.changed.v1' ||
          event.event == 'connection.invitation.created.v1') {
        unawaited(_load());
      }
    });
    Future<void>.microtask(_load);
  }

  @override
  void dispose() {
    _heart.dispose();
    unawaited(_events?.cancel());
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final couple = await activeCouple(ref.read(coupleRepositoryProvider));
      if (mounted) {
        setState(() {
          _couple = couple;
          _loading = false;
        });
        if (couple != null && couple.state == 'ACTIVE') {
          _heart.repeat(reverse: true);
        } else {
          _heart.stop();
        }
      }
    } on ApiException {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final userId = ref.watch(sessionProvider).session?.userId;
    final partner = _partner(_couple, userId);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.navHome)),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(24),
              children: [
                if (partner == null) ...[
                  Text(l10n.dashboardUnpaired),
                  const SizedBox(height: 12),
                  FilledButton(
                    onPressed: () => context.push('/couple'),
                    child: Text(l10n.dashboardAddPartner),
                  ),
                ] else
                  _PairedHeader(
                    partnerName: partner.displayName,
                    animation: _heart,
                  ),
                const SizedBox(height: 16),
                Card(
                  color: const Color(0xFF7A1F3D),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          l10n.dashboardPremiumBody,
                          style: const TextStyle(color: Colors.white),
                        ),
                        const SizedBox(height: 12),
                        FilledButton(
                          onPressed: () {
                            showDialog<void>(
                              context: context,
                              builder: (context) => AlertDialog(
                                content: Text(l10n.dashboardPremiumBlocked),
                                actions: [
                                  TextButton(
                                    onPressed: () => Navigator.pop(context),
                                    child: Text(l10n.actionCancel),
                                  ),
                                ],
                              ),
                            );
                          },
                          child: Text(l10n.dashboardClaim),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(l10n.dashboardPermissions),
                  onTap: () {
                    final open =
                        widget.openSettings ?? Geolocator.openAppSettings;
                    unawaited(open());
                  },
                ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(l10n.dashboardFaq),
                  onTap: () {
                    showDialog<void>(
                      context: context,
                      builder: (context) => AlertDialog(
                        title: Text(l10n.dashboardFaq),
                        content: Text(
                          '${l10n.dashboardFaqLocation}\n\n${l10n.dashboardFaqChat}\n\n${l10n.dashboardFaqCouple}',
                        ),
                        actions: [
                          TextButton(
                            onPressed: () => Navigator.pop(context),
                            child: Text(l10n.actionCancel),
                          ),
                        ],
                      ),
                    );
                  },
                ),
                const SizedBox(height: 8),
                Text(l10n.dashboardRecovery),
                const SizedBox(height: 16),
                OutlinedButton(
                  onPressed: () => context.push('/map'),
                  child: Text(l10n.dashboardOpenMap),
                ),
              ],
            ),
    );
  }

  CouplePartner? _partner(CoupleSummary? couple, String? userId) {
    if (couple == null || couple.state != 'ACTIVE') {
      return null;
    }
    for (final partner in couple.partners) {
      if (partner.userId != userId) {
        return partner;
      }
    }
    return null;
  }
}

class _PairedHeader extends StatelessWidget {
  const _PairedHeader({required this.partnerName, required this.animation});

  final String partnerName;
  final Animation<double> animation;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const _Avatar(label: 'You'),
        ScaleTransition(
          scale: Tween<double>(begin: 0.9, end: 1.1).animate(animation),
          child: const Padding(
            padding: EdgeInsets.symmetric(horizontal: 12),
            child: Icon(Icons.favorite, color: Color(0xFF7A1F3D)),
          ),
        ),
        _Avatar(label: partnerName),
      ],
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final letter = label.isEmpty ? '?' : label.substring(0, 1).toUpperCase();
    return Column(
      children: [
        CircleAvatar(child: Text(letter)),
        const SizedBox(height: 4),
        Text(label),
      ],
    );
  }
}
