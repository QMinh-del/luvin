import 'package:flutter/material.dart';
import 'package:luvin/core/theme/luvin_theme.dart';
import 'package:luvin/core/widgets/app_button.dart';

class AppEmptyState extends StatelessWidget {
  const AppEmptyState({
    super.key,
    required this.title,
    this.body,
    this.icon = Icons.inbox_outlined,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final String? body;
  final IconData icon;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final tokens = Theme.of(context).extension<LuvinTokens>()!;
    return Semantics(
      label: [title, if (body != null) body].join('. '),
      child: Center(
        child: Padding(
          padding: EdgeInsets.all(tokens.space6),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ExcludeSemantics(
                child: Icon(icon, size: 32, color: tokens.ghost),
              ),
              SizedBox(height: tokens.space3),
              Text(title, style: Theme.of(context).textTheme.titleMedium),
              if (body != null) ...[
                SizedBox(height: tokens.space2),
                Text(body!, textAlign: TextAlign.center),
              ],
              if (actionLabel != null && onAction != null) ...[
                SizedBox(height: tokens.space4),
                AppButton(
                  label: actionLabel!,
                  onPressed: onAction,
                  variant: AppButtonVariant.secondary,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
