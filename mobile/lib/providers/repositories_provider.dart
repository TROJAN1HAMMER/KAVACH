import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/repository.dart';
import 'core_providers.dart';

/// Backs the Repositories screen. `ref.invalidate(repositoriesListProvider)`
/// after a mutation (e.g. toggling scheduled-scan) to refetch.
final repositoriesListProvider = FutureProvider<List<Repository>>((ref) {
  return ref.read(repositoriesRepositoryProvider).list();
});
