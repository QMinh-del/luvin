import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:luvin/core/theme/luvin_theme.dart';
import 'package:luvin/core/widgets/app_button.dart';
import 'package:luvin/core/widgets/app_empty_state.dart';
import 'package:luvin/core/widgets/app_feedback.dart';
import 'package:luvin/core/widgets/app_list_item.dart';
import 'package:luvin/core/widgets/app_skeleton.dart';
import 'package:luvin/core/widgets/app_text_field.dart';
import 'package:luvin/core/widgets/async_state_view.dart';
import 'package:luvin/core/widgets/permission_panel.dart';
import 'package:luvin/core/widgets/status_badge.dart';
import 'package:luvin/l10n/app_localizations.dart';

Widget testApp(Widget child) {
  return MaterialApp(
    theme: luvinTheme(brightness: Brightness.light),
    supportedLocales: AppLocalizations.supportedLocales,
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    home: Scaffold(body: child),
  );
}

void main() {
  testWidgets(
    'button keeps its dimensions while loading and exposes semantics',
    (tester) async {
      final semantics = tester.ensureSemantics();

      await tester.pumpWidget(
        testApp(AppButton(label: 'Continue', onPressed: () {}, expand: true)),
      );
      final readySize = tester.getSize(find.byType(AppButton));
      final readySemantics = tester.getSemantics(find.byType(AppButton));

      await tester.pumpWidget(
        testApp(
          AppButton(
            label: 'Continue',
            onPressed: () {},
            loading: true,
            expand: true,
          ),
        ),
      );
      final loadingSize = tester.getSize(find.byType(AppButton));

      expect(readySize, loadingSize);
      expect(readySize.height, greaterThanOrEqualTo(48));
      expect(readySemantics.label, 'Continue');
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      semantics.dispose();
    },
  );

  testWidgets('field error and status badge include text and icon', (
    tester,
  ) async {
    await tester.pumpWidget(
      testApp(
        const Column(
          children: [
            AppTextField(label: 'Email', errorText: 'Invalid email'),
            StatusBadge(label: 'Connected', tone: AppStatusTone.success),
          ],
        ),
      ),
    );

    expect(find.text('Invalid email'), findsOneWidget);
    expect(find.text('Connected'), findsOneWidget);
    expect(find.byIcon(Icons.check_circle_outline), findsOneWidget);
    expect(
      tester.getSize(find.byType(TextField)).height,
      greaterThanOrEqualTo(48),
    );
  });

  testWidgets('async view localizes denied stale and revoked states', (
    tester,
  ) async {
    final cases = {
      AsyncViewState.permissionDenied: 'Permission is required to continue',
      AsyncViewState.stale: 'This information may be out of date',
      AsyncViewState.revoked: 'You no longer have access',
    };
    for (final entry in cases.entries) {
      await tester.pumpWidget(
        testApp(
          AsyncStateView(
            state: entry.key,
            onRetry: () {},
            child: const Text('ready'),
          ),
        ),
      );
      expect(find.text(entry.value), findsOneWidget);
    }
  });

  testWidgets('permission empty list and skeleton components stay unframed', (
    tester,
  ) async {
    await tester.pumpWidget(
      testApp(
        MediaQuery(
          data: const MediaQueryData(disableAnimations: true),
          child: ListView(
            children: [
              PermissionPanel(
                title: 'Location permission',
                body: 'Needed for sharing',
                actionLabel: 'Open settings',
                onAction: () {},
              ),
              const AppListItem(title: 'Session', subtitle: 'Current device'),
              const AppEmptyState(title: 'No results'),
              const AppSkeleton(
                width: 120,
                height: 24,
                semanticLabel: 'Loading',
              ),
            ],
          ),
        ),
      ),
    );

    expect(find.byType(Card), findsNothing);
    final skeletonBlock = find.descendant(
      of: find.byType(AppSkeleton),
      matching: find.byType(DecoratedBox),
    );
    expect(tester.getSize(skeletonBlock), const Size(120, 24));
    expect(find.text('No results'), findsOneWidget);
  });

  testWidgets('destructive confirmation returns only explicit confirmation', (
    tester,
  ) async {
    bool? result;
    await tester.pumpWidget(
      testApp(
        Builder(
          builder: (context) => FilledButton(
            onPressed: () async {
              result = await showDestructiveConfirmDialog(
                context: context,
                title: 'Delete account',
                body: 'This action is destructive.',
                cancelLabel: 'Cancel',
                confirmLabel: 'Delete',
              );
            },
            child: const Text('Open'),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();
    expect(find.text('Delete account'), findsOneWidget);
    await tester.tap(find.text('Delete'));
    await tester.pumpAndSettle();
    expect(result, isTrue);
  });
}
