import 'package:flutter/material.dart';
import 'package:luvin/l10n/app_localizations.dart';

class UnavailableDestinationPage extends StatelessWidget {
  const UnavailableDestinationPage({
    super.key,
    required this.title,
    required this.message,
  });

  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(message),
        ),
      ),
    );
  }
}

class PetsPage extends StatelessWidget {
  const PetsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return UnavailableDestinationPage(
      title: l10n.navPets,
      message: l10n.petsUnavailable,
    );
  }
}

class MomentsPage extends StatelessWidget {
  const MomentsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return UnavailableDestinationPage(
      title: l10n.navMoments,
      message: l10n.momentsUnavailable,
    );
  }
}
