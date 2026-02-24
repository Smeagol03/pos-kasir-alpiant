import { useEffect, useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { invoke } from "../../lib/tauri";
import { useAuthStore } from "../../store/authStore";
import { useToast } from "../../hooks/use-toast";
import { formatRupiah } from "../../lib/currency";
import { QrisPaymentResponse } from "../../types";
import { useQrisPayment } from "../../hooks/useQrisPayment";
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface QRISModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number;
  onSuccess: (orderId: string) => void;
  onCancel: () => void;
}

export function QRISModal({
  open,
  onOpenChange,
  amount,
  onSuccess,
  onCancel,
}: QRISModalProps) {
  const [loading, setLoading] = useState(false);
  const [qrData, setQrData] = useState<QrisPaymentResponse | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  const { toast } = useToast();
  const sessionToken = useAuthStore((s) => s.sessionToken);
  // Track whether we already called onSuccess for this session
  const successHandledRef = useRef(false);

  const handleGenerateQR = async () => {
    if (!sessionToken || amount <= 0) return;

    setLoading(true);
    try {
      const result = await invoke<QrisPaymentResponse>(
        "generate_qris_payment",
        {
          sessionToken,
          amount,
        },
      );
      setQrData(result);

      // Parse expires_at (Midtrans returns UTC+7)
      const expiresStr = result.expires_at.replace(" ", "T");
      const expiresAt = new Date(expiresStr + "+07:00").getTime();
      const now = Date.now();
      setTimeLeft(Math.max(0, expiresAt - now));
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Gagal Generate QR",
        description: String(error),
      });
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = () => {
    // Prevent duplicate success handling
    if (successHandledRef.current) return;
    successHandledRef.current = true;

    toast({
      title: "Pembayaran Berhasil!",
      description: "Transaksi Anda telah dikonfirmasi.",
    });
    onSuccess(qrData?.order_id || "");
  };

  const handleExpired = () => {
    toast({
      title: "QR Code Kadaluarsa",
      description: "Silakan generate QR code baru.",
      variant: "destructive",
    });
  };

  // Polling — only starts when qrData has an orderId
  const { status, errorCount } = useQrisPayment({
    orderId: qrData?.order_id || null,
    onSuccess: handleSuccess,
    onExpired: handleExpired,
    enabled: open && qrData !== null,
  });

  const handleCancel = async () => {
    if (qrData?.order_id && sessionToken) {
      try {
        await invoke("cancel_qris_payment", {
          sessionToken,
          orderId: qrData.order_id,
        });
      } catch (error) {
        console.error("Failed to cancel QRIS payment:", error);
      }
    }
    resetAndClose();
  };

  const resetAndClose = () => {
    setQrData(null);
    setTimeLeft(0);
    successHandledRef.current = false;
    onCancel();
  };

  const handleRegenerate = async () => {
    // Cancel old payment
    if (qrData?.order_id && sessionToken) {
      try {
        await invoke("cancel_qris_payment", {
          sessionToken,
          orderId: qrData.order_id,
        });
      } catch {
        // Ignore cancel errors
      }
    }

    // Reset state for fresh QR
    setQrData(null);
    setTimeLeft(0);
    successHandledRef.current = false;
    await handleGenerateQR();
  };

  // Countdown timer
  useEffect(() => {
    if (!open || timeLeft <= 0) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1000) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [open, timeLeft > 0]);

  // Generate QR when modal opens
  useEffect(() => {
    if (open && !qrData && !loading) {
      successHandledRef.current = false;
      handleGenerateQR();
    }
    // Full cleanup when modal closes
    if (!open) {
      setQrData(null);
      setTimeLeft(0);
      successHandledRef.current = false;
    }
  }, [open]);

  const formatTimeLeft = () => {
    const totalSeconds = Math.floor(timeLeft / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  // Only show status displays for FINAL states (not idle/pending)
  const getStatusDisplay = () => {
    switch (status) {
      case "success":
        return (
          <div className="text-center py-8">
            <CheckCircle2 className="h-20 w-20 text-green-500 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-green-600 mb-2">
              Pembayaran Berhasil!
            </h3>
            <p className="text-muted-foreground">
              Transaksi Anda telah dikonfirmasi. Struk akan dicetak otomatis.
            </p>
          </div>
        );
      case "expired":
        return (
          <div className="text-center py-8">
            <AlertCircle className="h-20 w-20 text-orange-500 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-orange-600 mb-2">
              QR Code Kadaluarsa
            </h3>
            <p className="text-muted-foreground mb-4">
              QR code ini telah melewati batas waktu pembayaran.
            </p>
            <Button onClick={handleRegenerate} disabled={loading}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Generate QR Baru
            </Button>
          </div>
        );
      case "failed":
        return (
          <div className="text-center py-8">
            <XCircle className="h-20 w-20 text-red-500 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-red-600 mb-2">
              Pembayaran Dibatalkan
            </h3>
            <p className="text-muted-foreground">
              Pembayaran QRIS telah dibatalkan atau ditolak.
            </p>
          </div>
        );
      default:
        // "idle" and "pending" don't show status overlay
        return null;
    }
  };

  // Determine what to show in the QR area
  const showQR = status === "idle" || status === "pending";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">
            Scan QRIS untuk Pembayaran
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Amount */}
          <div className="bg-primary/10 p-4 rounded-lg border border-primary/20 text-center">
            <div className="text-sm font-medium text-muted-foreground mb-1">
              Total Pembayaran
            </div>
            <div className="text-3xl font-black text-primary">
              {formatRupiah(amount)}
            </div>
          </div>

          {/* Status Display (only for final states) */}
          {getStatusDisplay()}

          {/* QR Code (only when idle/pending) */}
          {showQR && (
            <>
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4" />
                  <p className="text-muted-foreground">Generating QR Code...</p>
                </div>
              ) : qrData ? (
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-lg border flex items-center justify-center">
                    <QRCodeSVG
                      value={qrData.qr_string}
                      size={256}
                      level="H"
                      includeMargin={true}
                    />
                  </div>

                  {/* Timer */}
                  {timeLeft > 0 && (
                    <div className="flex items-center justify-center gap-2 text-lg">
                      <Clock
                        className={`h-5 w-5 ${timeLeft < 60000 ? "text-red-500 animate-pulse" : ""}`}
                      />
                      <span
                        className={`font-bold ${timeLeft < 60000 ? "text-red-500" : ""}`}
                      >
                        Waktu tersisa: {formatTimeLeft()}
                      </span>
                    </div>
                  )}

                  {/* Error Warning */}
                  {errorCount >= 3 && (
                    <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-lg flex items-center gap-2 text-sm text-yellow-600">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      <span>
                        Gagal mengecek status pembayaran. Pastikan koneksi
                        internet stabil.
                      </span>
                    </div>
                  )}
                </div>
              ) : null}
            </>
          )}
        </div>

        {/* Footer */}
        {status !== "success" && (
          <div className="flex gap-3 border-t pt-4">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={loading}
              className="flex-1"
            >
              Batal
            </Button>
            {(status === "expired" ||
              (status === "pending" && timeLeft <= 0 && qrData)) && (
              <Button
                onClick={handleRegenerate}
                disabled={loading}
                className="flex-1"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Generate Baru
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
