import 'package:flutter/material.dart';
import 'package:luvin/core/widgets/async_state_view.dart';

class FeaturePlaceholderPage extends StatelessWidget {
  const FeaturePlaceholderPage({
    super.key,
    required this.title,
    required this.body,
  });

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: AsyncStateView(
        state: AsyncViewState.ready,
        child: Padding(padding: const EdgeInsets.all(24), child: Text(body)),
      ),
    );
  }
}
