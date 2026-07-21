import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/analytics.dart';
import 'core_providers.dart';

/// Backs the Dashboard screen. Available to every authenticated role.
final myActivityProvider = FutureProvider.autoDispose<MyActivitySummary>((ref) {
  return ref.read(analyticsRepositoryProvider).myActivity();
});

/// Backs a future Team Activity view. Only call this behind a
/// `Permission.teamAnalyticsRead` check — the backend will 403 otherwise.
final teamActivityProvider = FutureProvider.autoDispose<TeamActivitySummary>((ref) {
  return ref.read(analyticsRepositoryProvider).teamActivity();
});
