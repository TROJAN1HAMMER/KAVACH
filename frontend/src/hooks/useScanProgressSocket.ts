import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL, tokenStorage } from "../lib/api/client";
import { queryKeys } from "../lib/queryClient";
import type { ScanJobStatusResponse, ScanProgressEvent } from "../types/api";

export const TERMINAL_SCAN_STATUSES = new Set(["completed", "failed", "cancelled"]);

function wsUrlFor(scanJobId: string): string {
  const httpUrl = new URL(API_BASE_URL, window.location.href);
  const wsProtocol = httpUrl.protocol === "https:" ? "wss:" : "ws:";
  const token = tokenStorage.getAccessToken() ?? "";
  return `${wsProtocol}//${httpUrl.host}${httpUrl.pathname}/scan/${scanJobId}/ws?token=${encodeURIComponent(token)}`;
}

function isFullSnapshot(event: ScanProgressEvent): event is ScanJobStatusResponse {
  return !("type" in event);
}

/**
 * Subscribes to real-time progress for one scan job (see
 * backend/app/api/v1/endpoints/scan.py's scan_progress_ws) and writes every
 * update straight into the React Query cache entry the rest of the app
 * already reads via useScanJob — no separate "live" state to reconcile.
 *
 * Auto-reconnects (capped backoff) on an unexpected drop, and stops for
 * good once the job reaches a terminal state or the caller passes
 * `enabled: false` (e.g. the job was already terminal on mount, so there's
 * nothing left to stream).
 */
export function useScanProgressSocket(scanJobId: string | undefined, enabled = true) {
  const queryClient = useQueryClient();
  const reconnectAttempt = useRef(0);

  useEffect(() => {
    if (!scanJobId || !enabled) return;

    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let closedByCleanup = false;

    const connect = () => {
      socket = new WebSocket(wsUrlFor(scanJobId));

      socket.onopen = () => {
        reconnectAttempt.current = 0;
      };

      socket.onmessage = (event) => {
        const payload: ScanProgressEvent = JSON.parse(event.data);

        if (isFullSnapshot(payload)) {
          queryClient.setQueryData(queryKeys.scanJob(scanJobId), payload);
          return;
        }
        if (payload.type === "ping") return;

        queryClient.setQueryData<ScanJobStatusResponse | undefined>(queryKeys.scanJob(scanJobId), (current) => {
          if (!current) return current;
          if (payload.type === "job_status") {
            return { ...current, status: payload.status, progress_percent: payload.progress_percent, current_stage: payload.current_stage };
          }
          // worker_status
          return {
            ...current,
            worker_status: {
              ...current.worker_status,
              [payload.scanner]: {
                status: payload.status,
                updated_at: payload.updated_at,
                task_id: payload.task_id,
                error: payload.error,
                findings_count: payload.findings_count,
              },
            },
          };
        });
      };

      socket.onclose = (event) => {
        if (closedByCleanup) return;
        // Server closes with 1000 once the job hits a terminal state and
        // has sent its final snapshot, or if the token was rejected
        // (4401) — neither is worth reconnecting for.
        if (event.code === 1000 || event.code === 4401 || event.code === 4404) return;

        const delay = Math.min(1000 * 2 ** reconnectAttempt.current, 15_000);
        reconnectAttempt.current += 1;
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      closedByCleanup = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [scanJobId, enabled, queryClient]);
}
