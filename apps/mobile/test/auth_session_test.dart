import 'package:flutter_test/flutter_test.dart';
import 'package:luvin/core/session/auth_session.dart';

void main() {
  test('session storage preserves account and legal gates', () {
    final original = AuthSession(
      accessToken: 'access',
      refreshToken: 'refresh',
      userId: 'user',
      sessionId: 'session',
      devicePublicId: 'device',
      accountState: AccountState.pendingDeletion,
      requiredLegalActions: const [RequiredLegalAction.acceptPrivacy],
    );

    final restored = AuthSession.fromStorage(original.toStorage())!;

    expect(restored.accountState, AccountState.pendingDeletion);
    expect(restored.requiredLegalActions, [RequiredLegalAction.acceptPrivacy]);
    expect(restored.canUseProduct, isFalse);
  });

  test('unknown server states fail closed', () {
    final restored = AuthSession.fromStorage({
      'accessToken': 'access',
      'refreshToken': 'refresh',
      'userId': 'user',
      'sessionId': 'session',
      'devicePublicId': 'device',
      'accountState': 'FUTURE_STATE',
      'requiredLegalActions': 'FUTURE_ACTION',
    })!;

    expect(restored.accountState, AccountState.unknown);
    expect(restored.requiredLegalActions, [RequiredLegalAction.unknown]);
    expect(restored.canUseProduct, isFalse);
  });
}
