import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:luvin/l10n/app_localizations.dart';
import 'package:luvin/locale_controller.dart';

class LuvinApp extends StatelessWidget {
  const LuvinApp({super.key, this.initialLocale});

  final Locale? initialLocale;

  @override
  Widget build(BuildContext context) {
    return ProviderScope(
      overrides: [
        if (initialLocale != null)
          localeProvider.overrideWith(
            () => LocaleController(initialLocale: initialLocale),
          ),
      ],
      child: const LuvinMaterialApp(),
    );
  }
}

class LuvinMaterialApp extends ConsumerWidget {
  const LuvinMaterialApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final locale = ref.watch(localeProvider);

    return MaterialApp(
      locale: locale,
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      localeResolutionCallback: (deviceLocale, supported) {
        if (deviceLocale != null) {
          for (final item in supported) {
            if (item.languageCode == deviceLocale.languageCode) {
              return item;
            }
          }
        }
        return const Locale('en');
      },
      onGenerateTitle: (context) => AppLocalizations.of(context).appTitle,
      home: const LocaleShellPage(),
    );
  }
}

class LocaleShellPage extends ConsumerWidget {
  const LocaleShellPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);

    return Scaffold(
      appBar: AppBar(title: Text(l10n.appTitle)),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(l10n.shellHeadline),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: () => ref
                  .read(localeProvider.notifier)
                  .setLocale(const Locale('en')),
              child: Text(l10n.languageEnglish),
            ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: () => ref
                  .read(localeProvider.notifier)
                  .setLocale(const Locale('vi')),
              child: Text(l10n.languageVietnamese),
            ),
          ],
        ),
      ),
    );
  }
}
