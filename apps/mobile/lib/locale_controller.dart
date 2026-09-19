import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class LocaleController extends Notifier<Locale?> {
  LocaleController({this.initialLocale});

  final Locale? initialLocale;

  @override
  Locale? build() => initialLocale;

  void setLocale(Locale locale) => state = locale;
}

final localeProvider = NotifierProvider<LocaleController, Locale?>(
  LocaleController.new,
);
