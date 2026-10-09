import 'package:flutter/material.dart';
import 'package:luvin/core/theme/luvin_theme.dart';

enum AppStatusTone { neutral, info, success, warning, danger }

class StatusBadge extends StatelessWidget {
  const StatusBadge({
    super.key,
    required this.label,
    required this.tone,
    this.icon,
  });

  final String label;
  final AppStatusTone tone;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final tokens = Theme.of(context).extension<LuvinTokens>()!;
    final color = switch (tone) {
      AppStatusTone.neutral => tokens.ghost,
      AppStatusTone.info => tokens.info,
      AppStatusTone.success => tokens.success,
      AppStatusTone.warning => tokens.warning,
      AppStatusTone.danger => tokens.danger,
    };
    final statusIcon =
        icon ??
        switch (tone) {
          AppStatusTone.neutral => Icons.remove_circle_outline,
          AppStatusTone.info => Icons.info_outline,
          AppStatusTone.success => Icons.check_circle_outline,
          AppStatusTone.warning => Icons.warning_amber_outlined,
          AppStatusTone.danger => Icons.error_outline,
        };
    return Semantics(
      label: label,
      child: DecoratedBox(
        decoration: BoxDecoration(
          border: Border.all(color: color),
          borderRadius: BorderRadius.circular(tokens.radiusSmall),
        ),
        child: Padding(
          padding: EdgeInsets.symmetric(
            horizontal: tokens.space2,
            vertical: tokens.space1,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              ExcludeSemantics(child: Icon(statusIcon, size: 16, color: color)),
              SizedBox(width: tokens.space1),
              Text(label, maxLines: 1, overflow: TextOverflow.ellipsis),
            ],
          ),
        ),
      ),
    );
  }
}
