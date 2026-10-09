import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:luvin/core/session/auth_session.dart';
import 'package:luvin/features/couple/couple_page.dart';
import 'package:luvin/features/couple/data/couple_api.dart';
import 'package:luvin/core/config/app_config.dart';
import 'package:luvin/core/realtime/app_websocket.dart';
import 'package:luvin/core/theme/luvin_theme.dart';
import 'package:luvin/features/session/session_controller.dart';
import 'package:luvin/l10n/app_localizations.dart';

class _FakeCouples implements CoupleRepository {
  String? requested;
  String? redeemed;
  var created = false;

  CoupleSummary get _pending => CoupleSummary(
    connectionId: 'c',
    state: 'PENDING',
    invitationId: 'i',
    partners: const [
      CouplePartner(
        userId: '11111111-1111-4111-8111-111111111111',
        username: 'me_user',
        displayName: 'Me',
        membershipState: 'ACTIVE',
      ),
      CouplePartner(
        userId: '22222222-2222-4222-8222-222222222222',
        username: 'mina',
        displayName: 'Mina',
        membershipState: 'INVITED',
      ),
    ],
  );

  @override
  Future<CoupleSummary> accept(String invitationId) =>
      throw UnimplementedError();

  @override
  Future<void> block(String userId) => throw UnimplementedError();

  @override
  Future<CoupleSummary> disconnect(String connectionId) =>
      throw UnimplementedError();

  @override
  Future<List<CoupleSummary>> list() async =>
      requested == null ? const [] : [_pending];

  @override
  Future<CoupleSummary> reject(String invitationId) =>
      throw UnimplementedError();

  @override
  Future<CoupleSummary> requestByUsername(String username) async {
    requested = username;
    return _pending;
  }

  @override
  Future<PairingCodeIssue> createPairingCode() async {
    created = true;
    return PairingCodeIssue(
      code: 'ABCD2345',
      expiresAt: DateTime.utc(2026, 9, 26, 16, 45),
    );
  }

  @override
  Future<PairingCodeStatus> currentPairingCode() async {
    return const PairingCodeStatus(active: false, expiresAt: null);
  }

  @override
  Future<CoupleSummary> redeemPairingCode(String code) async {
    redeemed = code;
    return _pending;
  }
}

void main() {
  testWidgets('couple page sends a username request', (tester) async {
    final couples = _FakeCouples();
    final container = ProviderContainer(
      overrides: [
        coupleRepositoryProvider.overrideWithValue(couples),
        webSocketProvider.overrideWithValue(
          AppWebSocket(config: AppConfig.fromBaseUrl('http://127.0.0.1:9/v1')),
        ),
        sessionProvider.overrideWith(
          () => _FixedSession(
            SessionSnapshot(
              status: SessionStatus.authenticated,
              session: AuthSession(
                accessToken: 'access',
                refreshToken: 'refresh',
                userId: '11111111-1111-4111-8111-111111111111',
                sessionId: '33333333-3333-4333-8333-333333333333',
                devicePublicId: 'device',
                accountState: AccountState.active,
                requiredLegalActions: const [],
              ),
            ),
          ),
        ),
      ],
    );
    addTearDown(container.dispose);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          theme: luvinTheme(brightness: Brightness.light),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: const CouplePage(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('A private space for two'), findsOneWidget);
    await tester.enterText(find.byKey(const Key('couple-username')), 'mina');
    await tester.tap(find.widgetWithText(FilledButton, 'Send request'));
    await tester.pumpAndSettle();

    expect(couples.requested, 'mina');
    expect(find.text('Mina'), findsOneWidget);
    expect(find.text('Waiting for your partner to accept.'), findsOneWidget);
    expect(find.text('Disconnect'), findsNothing);
  });

  testWidgets('couple page creates and redeems a pairing code', (tester) async {
    final couples = _FakeCouples();
    final container = ProviderContainer(
      overrides: [
        coupleRepositoryProvider.overrideWithValue(couples),
        webSocketProvider.overrideWithValue(
          AppWebSocket(config: AppConfig.fromBaseUrl('http://127.0.0.1:9/v1')),
        ),
        sessionProvider.overrideWith(
          () => _FixedSession(
            SessionSnapshot(
              status: SessionStatus.authenticated,
              session: AuthSession(
                accessToken: 'access',
                refreshToken: 'refresh',
                userId: '11111111-1111-4111-8111-111111111111',
                sessionId: '33333333-3333-4333-8333-333333333333',
                devicePublicId: 'device',
                accountState: AccountState.active,
                requiredLegalActions: const [],
              ),
            ),
          ),
        ),
      ],
    );
    addTearDown(container.dispose);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          theme: luvinTheme(brightness: Brightness.light),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: const CouplePage(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    final createButton = find.byKey(const Key('couple-create-code-button'));
    await tester.drag(find.byType(ListView), const Offset(0, -240));
    await tester.pumpAndSettle();
    await tester.tap(createButton);
    await tester.pumpAndSettle();
    expect(couples.created, isTrue);
    expect(find.text('ABCD2345'), findsOneWidget);
    expect(find.textContaining('does not share location'), findsOneWidget);

    couples.requested = null;
    await tester.drag(find.byType(ListView), const Offset(0, -360));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('couple-code')), 'wxyz6789');
    final redeemButton = find.byKey(const Key('couple-redeem-code-button'));
    await tester.ensureVisible(redeemButton);
    await tester.tap(redeemButton);
    await tester.pumpAndSettle();
    expect(couples.redeemed, 'WXYZ6789');
  });
}

class _FixedSession extends SessionController {
  _FixedSession(this.initial);

  final SessionSnapshot initial;

  @override
  SessionSnapshot build() => initial;
}
