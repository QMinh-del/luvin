import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:luvin/core/session/auth_session.dart';
import 'package:luvin/features/auth/register_page.dart';
import 'package:luvin/features/session/session_controller.dart';
import 'package:luvin/l10n/app_localizations.dart';

class RecordingSessionController extends SessionController {
  RecordingSessionController({this.errorCode});

  String? dateOfBirth;
  final String? errorCode;

  @override
  SessionSnapshot build() =>
      const SessionSnapshot(status: SessionStatus.anonymous);

  @override
  Future<void> register({
    required String email,
    required String password,
    required String username,
    required String displayName,
    required String dateOfBirth,
  }) async {
    this.dateOfBirth = dateOfBirth;
    if (errorCode != null) {
      throw ApiException(code: errorCode!, statusCode: 409);
    }
  }
}

void main() {
  testWidgets('registration requires the date picker and submits an ISO date', (
    tester,
  ) async {
    final container = ProviderContainer(
      overrides: [sessionProvider.overrideWith(RecordingSessionController.new)],
    );
    addTearDown(container.dispose);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: const RegisterPage(),
        ),
      ),
    );

    final registerButton = find.widgetWithText(FilledButton, 'Create account');
    expect(tester.widget<FilledButton>(registerButton).onPressed, isNull);

    await tester.enterText(find.byType(TextField).at(0), 'test@example.com');
    await tester.enterText(find.byType(TextField).at(1), 'StrongPassword1!');
    await tester.enterText(find.byType(TextField).at(2), 'test_user');
    await tester.enterText(find.byType(TextField).at(3), 'Test User');
    await tester.tap(find.byType(Checkbox));
    await tester.pump();

    await tester.tap(registerButton);
    await tester.pump();
    expect(find.text('Select your date of birth.'), findsOneWidget);

    await tester.tap(find.byKey(const Key('register-date-of-birth')));
    await tester.pumpAndSettle();
    final calendar = tester.widget<CalendarDatePicker>(
      find.byType(CalendarDatePicker),
    );
    calendar.onDateChanged(DateTime(2004, 10, 11));
    await tester.pump();
    await tester.tap(find.text('OK'));
    await tester.pumpAndSettle();

    final dateOfBirthField = tester.widget<TextField>(
      find.byKey(const Key('register-date-of-birth')),
    );
    expect(dateOfBirthField.readOnly, isTrue);
    expect(dateOfBirthField.controller?.text, isNotEmpty);

    await tester.tap(registerButton);
    await tester.pumpAndSettle();
    final controller =
        container.read(sessionProvider.notifier) as RecordingSessionController;
    expect(controller.dateOfBirth, '2004-10-11');
  });

  testWidgets('registration shows the specific email error from the API', (
    tester,
  ) async {
    final container = ProviderContainer(
      overrides: [
        sessionProvider.overrideWith(
          () => RecordingSessionController(errorCode: 'EMAIL_UNAVAILABLE'),
        ),
      ],
    );
    addTearDown(container.dispose);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: const RegisterPage(),
        ),
      ),
    );

    await tester.enterText(find.byType(TextField).at(0), 'used@example.com');
    await tester.enterText(find.byType(TextField).at(1), 'StrongPassword1!');
    await tester.enterText(find.byType(TextField).at(2), 'used_user');
    await tester.enterText(find.byType(TextField).at(3), 'Used User');
    await tester.tap(find.byType(Checkbox));
    await tester.tap(find.byKey(const Key('register-date-of-birth')));
    await tester.pumpAndSettle();
    tester
        .widget<CalendarDatePicker>(find.byType(CalendarDatePicker))
        .onDateChanged(DateTime(2004, 10, 11));
    await tester.pump();
    await tester.tap(find.text('OK'));
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(FilledButton, 'Create account'));
    await tester.pumpAndSettle();
    expect(find.text('This email is already in use.'), findsOneWidget);
  });
}
