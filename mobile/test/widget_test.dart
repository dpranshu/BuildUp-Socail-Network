import 'package:buildup_mobile/main.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('shows safe setup guidance when Supabase config is absent', (
    tester,
  ) async {
    await tester.pumpWidget(const BuildupApp());

    expect(find.textContaining('--dart-define'), findsOneWidget);
    expect(find.textContaining('service-role key'), findsOneWidget);
  });
}
