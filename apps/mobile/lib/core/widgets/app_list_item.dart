import 'package:flutter/material.dart';
import 'package:luvin/core/theme/luvin_theme.dart';

class AppListItem extends StatelessWidget {
  const AppListItem({
    super.key,
    required this.title,
    this.subtitle,
    this.leading,
    this.trailing,
    this.onTap,
    this.enabled = true,
  });

  final String title;
  final String? subtitle;
  final Widget? leading;
  final Widget? trailing;
  final VoidCallback? onTap;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final tokens = Theme.of(context).extension<LuvinTokens>()!;
    return Semantics(
      button: onTap != null,
      enabled: enabled,
      label: [title, if (subtitle != null) subtitle].join('. '),
      excludeSemantics: true,
      child: ConstrainedBox(
        constraints: BoxConstraints(minHeight: tokens.minTap),
        child: ListTile(
          enabled: enabled,
          contentPadding: EdgeInsets.symmetric(horizontal: tokens.space4),
          title: Text(title),
          subtitle: subtitle == null ? null : Text(subtitle!),
          leading: leading,
          trailing: trailing,
          onTap: enabled ? onTap : null,
        ),
      ),
    );
  }
}
