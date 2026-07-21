import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/scan_job.dart';
import 'core_providers.dart';

/// Backs the Scan Queue screen.
final scanJobListProvider = FutureProvider.autoDispose<ScanJobList>((ref) {
  return ref.read(scanRepositoryProvider).list();
});

/// Backs the Scan Details screen. Re-fetches whenever `scanJobId` changes;
/// screens that need live progress should prefer the WebSocket once it's
/// wrapped in a provider (see the milestone report's "next milestone" list)
/// — this is a point-in-time snapshot only.
final scanJobDetailProvider =
    FutureProvider.autoDispose.family<ScanJob, String>((ref, scanJobId) {
  return ref.read(scanRepositoryProvider).detail(scanJobId);
});
