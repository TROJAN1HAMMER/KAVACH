import 'package:freezed_annotation/freezed_annotation.dart';

part 'local_notification.freezed.dart';

/// The backend has no notifications API — `backend/app/services/notifications/`
/// is an outbound-only side channel (email/Slack/webhook triggered from the
/// scan pipeline), not something a client can list, mark-read, or register a
/// push token against. The web app's only equivalent is a purely local toast
/// system (`frontend/src/contexts/ToastContext.tsx`). This model is that same
/// pattern ported to Dart: in-app, ephemeral, generated locally (e.g. on scan
/// completion, on an admin action) — **never fetched from a backend
/// endpoint**. Do not add a `NotificationRepository` that calls a
/// `/notifications` route; it does not exist. See the milestone report's
/// backend-gaps list.
enum NotificationTone { success, error, info }

@freezed
class AppNotification with _$AppNotification {
  const factory AppNotification({
    required String id,
    required NotificationTone tone,
    required String title,
    String? description,
    required DateTime createdAt,
    @Default(false) bool read,
  }) = _AppNotification;

  const AppNotification._();
}
