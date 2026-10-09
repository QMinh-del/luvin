import 'package:flutter/material.dart';
import 'package:luvin/core/theme/luvin_theme.dart';

class AppSkeleton extends StatefulWidget {
  const AppSkeleton({
    super.key,
    required this.width,
    required this.height,
    this.semanticLabel,
  });

  final double width;
  final double height;
  final String? semanticLabel;

  @override
  State<AppSkeleton> createState() => _AppSkeletonState();
}

class _AppSkeletonState extends State<AppSkeleton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
      lowerBound: 0.45,
      upperBound: 0.85,
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context)) {
      _controller
        ..stop()
        ..value = 0.65;
    } else if (!_controller.isAnimating) {
      _controller.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tokens = Theme.of(context).extension<LuvinTokens>()!;
    final reduceMotion = MediaQuery.disableAnimationsOf(context);
    final block = Align(
      alignment: AlignmentDirectional.centerStart,
      child: SizedBox(
        width: widget.width,
        height: widget.height,
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: tokens.border,
            borderRadius: BorderRadius.circular(tokens.radiusSmall),
          ),
        ),
      ),
    );
    return Semantics(
      label: widget.semanticLabel,
      excludeSemantics: true,
      child: reduceMotion
          ? Opacity(opacity: 0.65, child: block)
          : FadeTransition(opacity: _controller, child: block),
    );
  }
}
