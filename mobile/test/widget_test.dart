import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kavach_mobile/app.dart';

void main() {
  testWidgets('KavachApp boots to the splash screen', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: KavachApp()));

    // The splash screen renders immediately; session restoration (which
    // hits the network) happens after the first frame, so this only
    // verifies the app shell mounts without throwing.
    expect(find.text('KAVACH'), findsOneWidget);
  });
}
