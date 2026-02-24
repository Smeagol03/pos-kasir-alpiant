import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "../lib/tauri";
import { useAuthStore } from "../store/authStore";
import { QrisStatusResponse } from "../types";

export type QrisStatus = "idle" | "pending" | "success" | "expired" | "failed";

interface UseQrisPaymentProps {
  orderId: string | null;
  onSuccess?: () => void;
  onExpired?: () => void;
  enabled: boolean;
}

export function useQrisPayment({
  orderId,
  onSuccess,
  onExpired,
  enabled,
}: UseQrisPaymentProps) {
  const [status, setStatus] = useState<QrisStatus>("idle");
  const [errorCount, setErrorCount] = useState(0);
  const sessionToken = useAuthStore((s) => s.sessionToken);
  const onSuccessRef = useRef(onSuccess);
  const onExpiredRef = useRef(onExpired);
  // Track the orderId that triggered success to prevent duplicate callbacks
  const successOrderRef = useRef<string | null>(null);

  // Keep refs updated
  onSuccessRef.current = onSuccess;
  onExpiredRef.current = onExpired;

  // Reset ALL state when orderId changes (including to null)
  useEffect(() => {
    if (orderId) {
      setStatus("pending");
      setErrorCount(0);
      successOrderRef.current = null; // New order = allow fresh success
    } else {
      // orderId is null → reset to idle (modal closed or no QR yet)
      setStatus("idle");
      setErrorCount(0);
    }
  }, [orderId]);

  const checkStatus = useCallback(async () => {
    if (!orderId || !enabled || !sessionToken) return;

    try {
      const result = await invoke<QrisStatusResponse>("check_qris_status", {
        sessionToken,
        orderId,
      });

      setErrorCount(0);

      if (
        result.status === "settlement" ||
        result.transaction_status === "settlement"
      ) {
        setStatus("success");
        // Only fire onSuccess ONCE per orderId
        if (successOrderRef.current !== orderId) {
          successOrderRef.current = orderId;
          onSuccessRef.current?.();
        }
      } else if (result.status === "expire") {
        setStatus("expired");
        onExpiredRef.current?.();
      } else if (result.status === "cancel" || result.status === "deny") {
        setStatus("failed");
      }
      // "pending" → don't change status (already set)
    } catch (error) {
      setErrorCount((prev) => prev + 1);
      console.error("QRIS polling error:", error);
    }
  }, [orderId, enabled, sessionToken]);

  useEffect(() => {
    if (!enabled || !orderId) return;

    // Don't poll if already in final state
    if (status === "success" || status === "expired" || status === "failed") return;

    const interval = setInterval(checkStatus, 3000);
    checkStatus(); // Check immediately

    return () => clearInterval(interval);
  }, [enabled, orderId, checkStatus, status]);

  return { status, errorCount, refreshStatus: checkStatus };
}
