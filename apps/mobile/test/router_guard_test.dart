import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:luvin/app.dart';
import 'package:luvin/app_router.dart';
import 'package:luvin/core/config/app_config.dart';
import 'package:luvin/core/realtime/app_websocket.dart';
import 'package:luvin/core/session/auth_session.dart';
import 'package:luvin/core/telemetry/product_analytics.dart';
import 'package:luvin/features/couple/data/couple_api.dart';
import 'package:luvin/features/location/data/location_api.dart';
import 'package:luvin/features/session/session_controller.dart';

AuthSession session({
  AccountState accountState = AccountState.active,
  List<RequiredLegalAction> legalActions = const [],
}) {
  return AuthSession(
    accessToken: 'access',
    refreshToken: 'refresh',
    userId: '11111111-1111-4111-8111-111111111111',
    sessionId: '22222222-2222-4222-8222-222222222222',
    devicePublicId: '33333333-3333-4333-8333-333333333333',
    accountState: accountState,
    requiredLegalActions: legalActions,
  );
}

class FakeSessionController extends SessionController {
  FakeSessionController(this.initial);

  final SessionSnapshot initial;

  @override
  SessionSnapshot build() => initial;

  @override
  Future<void> restore() async {}
}

class _SilentLocation implements LocationRepository {
  @override
  Future<PartnerLocation?> latest(String connectionId) async => null;

  @override
  Future<void> publish({
    required String connectionId,
    required LocationFix fix,
    required int sequence,
  }) async {}

  @override
  Future<void> setSharing({
    required String connectionId,
    required String viewerUserId,
    required bool enabled,
  }) async {}

  @override
  Future<void> setMode(String mode) async {}

  @override
  Future<LocationSettings> settings() async {
    return const LocationSettings(mode: 'PAUSED', viewerUserIds: []);
  }
}

class _EmptyCouples implements CoupleRepository {
  @override
  Future<CoupleSummary> accept(String invitationId) =>
      throw UnimplementedError();

  @override
  Future<void> block(String userId) => throw UnimplementedError();

  @override
  Future<CoupleSummary> disconnect(String connectionId) =>
      throw UnimplementedError();

  @override
  Future<List<CoupleSummary>> list() async => const [];

  @override
  Future<CoupleSummary> reject(String invitationId) =>
      throw UnimplementedError();

  @override
  Future<CoupleSummary> requestByUsername(String username) =>
      throw UnimplementedError();

  @override
  Future<PairingCodeIssue> createPairingCode() => throw UnimplementedError();

  @override
  Future<PairingCodeStatus> currentPairingCode() async {
    return const PairingCodeStatus(active: false, expiresAt: null);
  }

  @override
  Future<CoupleSummary> redeemPairingCode(String code) =>
      throw UnimplementedError();
}

Future<ProviderContainer> pumpWithSession(
  WidgetTester tester,
  SessionSnapshot snapshot,
) async {
  final analytics = ProductAnalytics(MemoryAnalyticsSink());
  await analytics.initialize();
  final container = ProviderContainer(
    overrides: [
      sessionProvider.overrideWith(() => FakeSessionController(snapshot)),
      analyticsProvider.overrideWithValue(analytics),
      coupleRepositoryProvider.overrideWithValue(_EmptyCouples()),
      locationRepositoryProvider.overrideWithValue(_SilentLocation()),
      webSocketProvider.overrideWithValue(
        AppWebSocket(config: AppConfig.fromBaseUrl('http://127.0.0.1:9/v1')),
      ),
    ],
  );
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: const LuvinMaterialApp(),
    ),
  );
  await tester.pumpAndSettle();
  return container;
}

void main() {
  testWidgets('authenticated shell exposes the five home destinations', (
    tester,
  ) async {
    final container = await pumpWithSession(
      tester,
      SessionSnapshot(status: SessionStatus.authenticated, session: session()),
    );
    addTearDown(container.dispose);

    expect(find.byType(NavigationDestination), findsNWidgets(5));
    expect(find.text('Home'), findsWidgets);
    expect(find.text('Pets'), findsOneWidget);
    expect(find.text('Moments'), findsOneWidget);
    expect(find.text('Chat'), findsOneWidget);
    expect(find.text('Settings'), findsOneWidget);
    expect(find.text('Add partner'), findsOneWidget);
    await tester.tap(find.text('Claim now'));
    await tester.pumpAndSettle();
    expect(
      find.text('Premium billing is not connected. Nothing will be charged.'),
      findsOneWidget,
    );
  });

  testWidgets('legal gate blocks protected deep links without cached content', (
    tester,
  ) async {
    final container = await pumpWithSession(
      tester,
      SessionSnapshot(
        status: SessionStatus.authenticated,
        session: session(legalActions: [RequiredLegalAction.acceptPrivacy]),
      ),
    );
    addTearDown(container.dispose);

    container.read(routerProvider).go('/chat/private-conversation');
    await tester.pumpAndSettle();

    expect(find.text('Review required'), findsOneWidget);
    expect(find.textContaining('Chat opens'), findsNothing);
    expect(find.byType(NavigationBar), findsNothing);
  });

  testWidgets('anonymous deep links resolve to login', (tester) async {
    final container = await pumpWithSession(
      tester,
      const SessionSnapshot(status: SessionStatus.anonymous),
    );
    addTearDown(container.dispose);

    container.read(routerProvider).go('/couple/private-connection');
    await tester.pumpAndSettle();

    expect(find.text('Welcome back'), findsOneWidget);
    expect(find.byType(NavigationBar), findsNothing);
  });

  testWidgets('age-ineligible account cannot open the product shell', (
    tester,
  ) async {
    final container = await pumpWithSession(
      tester,
      SessionSnapshot(
        status: SessionStatus.authenticated,
        session: session(accountState: AccountState.ageIneligible),
      ),
    );
    addTearDown(container.dispose);

    expect(find.text('Account access is limited'), findsOneWidget);
    expect(find.byType(NavigationBar), findsNothing);
  });
}
