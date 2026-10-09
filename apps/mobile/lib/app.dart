import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:luvin/app_router.dart';
import 'package:luvin/core/theme/luvin_theme.dart';
import 'package:luvin/features/session/session_controller.dart';
import 'package:luvin/l10n/app_localizations.dart';
import 'package:luvin/locale_controller.dart';

class LuvinApp extends StatelessWidget {
  const LuvinApp({super.key, this.initialLocale, this.overrides = const []});

  final Locale? initialLocale;
  final List<Override> overrides;

  @override
  Widget build(BuildContext context) {
    return ProviderScope(
      overrides: [
        if (initialLocale != null)
          localeProvider.overrideWith(
            () => LocaleController(initialLocale: initialLocale),
          ),
        ...overrides,
      ],
      child: const LuvinMaterialApp(),
    );
  }
}

class LuvinMaterialApp extends ConsumerStatefulWidget {
  const LuvinMaterialApp({super.key});

  @override
  ConsumerState<LuvinMaterialApp> createState() => _LuvinMaterialAppState();
}

class _LuvinMaterialAppState extends ConsumerState<LuvinMaterialApp> {
  var _restored = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_restored) {
        return;
      }
      _restored = true;
      ref.read(sessionProvider.notifier).restore();
    });
  }

  @override
  Widget build(BuildContext context) {
    final locale = ref.watch(localeProvider);
    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      locale: locale,
      theme: luvinTheme(brightness: Brightness.light),
      darkTheme: luvinTheme(brightness: Brightness.dark),
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
      routerConfig: router,
    );
  }
}
