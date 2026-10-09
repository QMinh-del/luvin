import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:luvin/core/telemetry/product_analytics.dart';
import 'package:luvin/core/theme/luvin_theme.dart';
import 'package:luvin/core/widgets/app_scaffold.dart';
import 'package:luvin/features/account/account_page.dart';
import 'package:luvin/features/chat/chat_page.dart';
import 'package:luvin/features/couple/couple_page.dart';
import 'package:luvin/features/home/dashboard_page.dart';
import 'package:luvin/features/home/shell_pages.dart';
import 'package:luvin/features/location/map_page.dart';
import 'package:luvin/features/auth/login_page.dart';
import 'package:luvin/features/auth/register_page.dart';
import 'package:luvin/features/bootstrap/splash_page.dart';
import 'package:luvin/features/session/session_controller.dart';
import 'package:luvin/features/session/access_gate_page.dart';
import 'package:luvin/l10n/app_localizations.dart';

class _RouterRefresh extends ChangeNotifier {
  void ping() => notifyListeners();
}

final routerProvider = Provider<GoRouter>((ref) {
  ref.watch(protectedCacheGenerationProvider);
  final refresh = _RouterRefresh();
  ref.listen(sessionProvider, (_, _) => refresh.ping());
  ref.onDispose(refresh.dispose);

  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: refresh,
    errorBuilder: (context, state) => const _SafeRouteError(),
    redirect: (context, state) {
      final session = ref.read(sessionProvider);
      final loc = state.matchedLocation;
      if (session.status == SessionStatus.restoring) {
        return loc == '/splash' ? null : '/splash';
      }
      if (session.status == SessionStatus.authenticated) {
        final canUseProduct = session.session?.canUseProduct ?? false;
        if (!canUseProduct) {
          return loc == '/access-required' ? null : '/access-required';
        }
        if (loc == '/access-required') {
          return '/home';
        }
        if (loc == '/login' ||
            loc == '/register' ||
            loc == '/splash' ||
            loc == '/') {
          return '/home';
        }
        return null;
      }
      if (loc == '/login' || loc == '/register') {
        return null;
      }
      return '/login';
    },
    routes: [
      GoRoute(path: '/splash', builder: (context, state) => const SplashPage()),
      GoRoute(
        path: '/login',
        builder: (context, state) {
          unawaited(
            ref.read(analyticsProvider).screenView(AnalyticsScreen.login),
          );
          return const LoginPage();
        },
      ),
      GoRoute(
        path: '/register',
        builder: (context, state) {
          unawaited(
            ref.read(analyticsProvider).screenView(AnalyticsScreen.register),
          );
          return const RegisterPage();
        },
      ),
      GoRoute(
        path: '/access-required',
        builder: (context, state) => const AccessGatePage(),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            AppScaffold(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/home',
                builder: (context, state) {
                  unawaited(
                    ref.read(analyticsProvider).screenView(AnalyticsScreen.map),
                  );
                  return const DashboardPage();
                },
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/pets',
                builder: (context, state) => const PetsPage(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/moments',
                builder: (context, state) => const MomentsPage(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/chat',
                builder: (context, state) {
                  unawaited(
                    ref
                        .read(analyticsProvider)
                        .screenView(AnalyticsScreen.chat),
                  );
                  return const ChatPage();
                },
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/account',
                builder: (context, state) {
                  unawaited(
                    ref
                        .read(analyticsProvider)
                        .screenView(AnalyticsScreen.account),
                  );
                  return const AccountPage();
                },
              ),
            ],
          ),
        ],
      ),
      GoRoute(
        path: '/map',
        builder: (context, state) {
          unawaited(
            ref.read(analyticsProvider).screenView(AnalyticsScreen.map),
          );
          return const MapPage();
        },
      ),
      GoRoute(
        path: '/couple',
        builder: (context, state) {
          unawaited(
            ref.read(analyticsProvider).screenView(AnalyticsScreen.couple),
          );
          return const CouplePage();
        },
      ),
    ],
  );
});

class _SafeRouteError extends StatelessWidget {
  const _SafeRouteError();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final tokens = Theme.of(context).extension<LuvinTokens>()!;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: EdgeInsets.all(tokens.space6),
            child: Semantics(
              liveRegion: true,
              child: Text(l10n.stateError, textAlign: TextAlign.center),
            ),
          ),
        ),
      ),
    );
  }
}
