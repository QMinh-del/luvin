import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:luvin/core/theme/luvin_theme.dart';
import 'package:luvin/core/widgets/app_button.dart';
import 'package:luvin/core/widgets/app_text_field.dart';
import 'package:luvin/core/widgets/permission_panel.dart';
import 'package:luvin/core/widgets/status_badge.dart';

Widget preview(Brightness brightness) {
  return MaterialApp(
    debugShowCheckedModeBanner: false,
    theme: luvinTheme(brightness: brightness),
    home: const _FoundationPreview(),
  );
}

class _FoundationPreview extends StatelessWidget {
  const _FoundationPreview();

  @override
  Widget build(BuildContext context) {
    final tokens = Theme.of(context).extension<LuvinTokens>()!;
    return Scaffold(
      appBar: AppBar(title: const Text('Không gian riêng tư')),
      body: SafeArea(
        child: ListView(
          padding: EdgeInsets.all(tokens.space4),
          children: [
            Text(
              'Trạng thái kết nối',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            SizedBox(height: tokens.space3),
            const Align(
              alignment: Alignment.centerLeft,
              child: StatusBadge(
                label: 'Đã kết nối',
                tone: AppStatusTone.success,
              ),
            ),
            SizedBox(height: tokens.space6),
            const AppTextField(label: 'Tên người dùng'),
            SizedBox(height: tokens.space4),
            AppButton(label: 'Tiếp tục', onPressed: () {}, expand: true),
            SizedBox(height: tokens.space6),
            PermissionPanel(
              title: 'Quyền vị trí',
              body: 'Bạn luôn kiểm soát thời điểm chia sẻ vị trí.',
              actionLabel: 'Xem quyền',
              onAction: () {},
            ),
          ],
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: 0,
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.map_outlined),
            label: 'Bản đồ',
          ),
          NavigationDestination(
            icon: Icon(Icons.chat_bubble_outline),
            label: 'Trò chuyện',
          ),
          NavigationDestination(
            icon: Icon(Icons.groups_outlined),
            label: 'Nhóm',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            label: 'Tài khoản',
          ),
        ],
      ),
    );
  }
}

void main() {
  setUpAll(() async {
    final loader = FontLoader('Inter')
      ..addFont(rootBundle.load('assets/fonts/Inter-Variable.ttf'));
    await loader.load();
    final iconLoader = FontLoader('MaterialIcons')
      ..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'));
    await iconLoader.load();
  });

  const sizes = {'360x800': Size(360, 800), '412x915': Size(412, 915)};
  for (final brightness in Brightness.values) {
    for (final entry in sizes.entries) {
      testWidgets('${brightness.name} foundation at ${entry.key}', (
        tester,
      ) async {
        await tester.binding.setSurfaceSize(entry.value);
        addTearDown(() => tester.binding.setSurfaceSize(null));
        await tester.pumpWidget(preview(brightness));
        await tester.pump();

        expect(tester.takeException(), isNull);
        await expectLater(
          find.byType(_FoundationPreview),
          matchesGoldenFile(
            'goldens/foundation_${brightness.name}_${entry.key}.png',
          ),
        );
      });
    }
  }
}
