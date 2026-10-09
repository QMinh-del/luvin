import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:luvin/core/session/auth_session.dart';
import 'package:luvin/features/session/session_controller.dart';
import 'package:luvin/l10n/app_localizations.dart';

class RegisterPage extends ConsumerStatefulWidget {
  const RegisterPage({super.key});

  @override
  ConsumerState<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends ConsumerState<RegisterPage> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _username = TextEditingController();
  final _displayName = TextEditingController();
  final _dob = TextEditingController();
  DateTime? _selectedDateOfBirth;
  bool _accepted = false;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _username.dispose();
    _displayName.dispose();
    _dob.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_selectedDateOfBirth == null) {
      setState(() => _error = 'DATE_OF_BIRTH_REQUIRED');
      return;
    }
    if (!_accepted) {
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref
          .read(sessionProvider.notifier)
          .register(
            email: _email.text.trim(),
            password: _password.text,
            username: _username.text.trim(),
            displayName: _displayName.text.trim(),
            dateOfBirth: DateFormat('yyyy-MM-dd').format(_selectedDateOfBirth!),
          );
    } on ApiException catch (error) {
      setState(() => _error = error.code);
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  Future<void> _selectDateOfBirth() async {
    final now = DateUtils.dateOnly(DateTime.now());
    final selected = await showDatePicker(
      context: context,
      initialDate:
          _selectedDateOfBirth ?? DateTime(now.year - 18, now.month, now.day),
      firstDate: DateTime(1900),
      lastDate: now,
      helpText: AppLocalizations.of(context).fieldDateOfBirth,
    );
    if (selected == null || !mounted) {
      return;
    }
    final locale = Localizations.localeOf(context).toLanguageTag();
    setState(() {
      _selectedDateOfBirth = DateUtils.dateOnly(selected);
      _dob.text = DateFormat.yMMMd(locale).format(_selectedDateOfBirth!);
      _error = null;
    });
  }

  String _errorMessage(AppLocalizations l10n) {
    return switch (_error) {
      'DATE_OF_BIRTH_REQUIRED' => l10n.registerDateOfBirthRequired,
      'AGE_INELIGIBLE' => l10n.registerAgeIneligible,
      'RATE_LIMITED' => l10n.registerRateLimited,
      'EMAIL_UNAVAILABLE' => l10n.registerEmailUnavailable,
      'USERNAME_UNAVAILABLE' => l10n.registerUsernameUnavailable,
      'PASSWORD_TOO_SHORT' => l10n.registerPasswordTooShort,
      'PASSWORD_CATEGORY_MISSING' => l10n.registerPasswordRequirements,
      'LEGAL_VERSION_STALE' => l10n.registerLegalVersionStale,
      'VALIDATION_FAILED' => l10n.registerInvalidDetails,
      _ => l10n.registerFailed,
    };
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.registerHeadline)),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          TextField(
            controller: _email,
            decoration: InputDecoration(labelText: l10n.fieldEmail),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _password,
            obscureText: true,
            decoration: InputDecoration(labelText: l10n.fieldPassword),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _username,
            decoration: InputDecoration(labelText: l10n.fieldUsername),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _displayName,
            decoration: InputDecoration(labelText: l10n.fieldDisplayName),
          ),
          const SizedBox(height: 12),
          TextField(
            key: const Key('register-date-of-birth'),
            controller: _dob,
            readOnly: true,
            showCursor: false,
            onTap: _selectDateOfBirth,
            decoration: InputDecoration(
              labelText: l10n.fieldDateOfBirth,
              suffixIcon: IconButton(
                tooltip: l10n.fieldDateOfBirth,
                onPressed: _selectDateOfBirth,
                icon: const Icon(Icons.calendar_today_outlined),
              ),
            ),
          ),
          CheckboxListTile(
            contentPadding: EdgeInsets.zero,
            value: _accepted,
            onChanged: (value) => setState(() => _accepted = value ?? false),
            title: Text(l10n.legalConsent),
            controlAffinity: ListTileControlAffinity.leading,
          ),
          if (_error != null)
            Text(
              _errorMessage(l10n),
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          FilledButton(
            onPressed: _busy || !_accepted ? null : _submit,
            child: Text(l10n.actionRegister),
          ),
          TextButton(
            onPressed: () => context.go('/login'),
            child: Text(l10n.actionLogin),
          ),
        ],
      ),
    );
  }
}
