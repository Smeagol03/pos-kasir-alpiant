# Rencana Implementasi: Integrasi Pembayaran QRIS

**Dokumen:** Rencana Teknis Implementasi  
**Proyek:** POS Kasir Alpiant  
**Stack:** Tauri v2, React, TypeScript, Rust, SQLite  
**Versi:** 1.0  
**Tanggal:** 23 Februari 2026

---

## 1. Ringkasan Eksekutif

Dokumen ini merinci rencana implementasi integrasi pembayaran QRIS untuk aplikasi POS Kasir Alpiant berdasarkan PRD di `payment.md`. Implementasi menggunakan arsitektur Tauri dengan komunikasi IPC antara frontend (React) dan backend (Rust).

---

## 2. Analisis Status Saat Ini

### 2.1 Yang Sudah Tersedia ✅

| Komponen | Status | Lokasi |
|----------|--------|--------|
| Payment method enum | ✅ Sudah ada | `src/types/index.ts`, `src-tauri/src/models/transaction.rs` |
| UI tombol QRIS | ✅ Sudah ada | `src/features/pos/PaymentModal.tsx` |
| Database schema | ✅ Sudah ada | `src-tauri/src/database/migrations.rs` |
| Command `create_transaction` | ✅ Sudah ada | `src-tauri/src/commands/transaction_cmd.rs` |
| Command `print_receipt` | ✅ Sudah ada | `src-tauri/src/commands/settings_cmd.rs` |
| Session authentication | ✅ Sudah ada | `src-tauri/src/auth/` |

### 2.2 Yang Perlu Dibangun ❌

| Komponen | Prioritas | Estimasi |
|----------|-----------|----------|
| Backend: Payment Gateway API integration | Tinggi | 4 jam |
| Backend: QRIS status polling command | Tinggi | 2 jam |
| Frontend: QRIS Modal component | Tinggi | 3 jam |
| Frontend: Payment polling hook | Tinggi | 2 jam |
| Database: QRIS reference field | Menengah | 30 menit |
| Settings: Payment gateway config | Menengah | 2 jam |
| Testing & edge cases | Menengah | 4 jam |

---

## 3. Arsitektur Sistem

### 3.1 Diagram Alur Pembayaran QRIS

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (React + TypeScript)                │
│                                                                 │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐ │
│  │ PaymentModal │ ───► │  QRISModal   │ ───► │ useQrisPoll  │ │
│  │              │      │              │      │    Hook      │ │
│  └──────────────┘      └──────────────┘      └──────────────┘ │
│         │                     │                     │          │
│         │ invoke()            │ invoke()            │ poll()   │
│         ▼                     ▼                     ▼          │
└─────────────────────────────────────────────────────────────────┘
                            │ IPC (Tauri)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (Rust)                               │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  payment_cmd.rs                                          │  │
│  │  ├── generate_qris_payment()     → Create QR via API     │  │
│  │  ├── check_qris_status()         → Poll status           │  │
│  │  └── cancel_qris_payment()       → Cancel payment        │  │
│  └──────────────────────────────────────────────────────────┘  │
│         │                     │                                 │
│         ▼                     ▼                                 │
│  ┌──────────────┐      ┌──────────────┐                        │
│  │ transaction  │      │   Payment    │                        │
│  │   table      │      │   Gateway    │                        │
│  │  (SQLite)    │      │  (Midtrans/  │                        │
│  │              │      │   Xendit)    │                        │
│  └──────────────┘      └──────────────┘                        │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 State Machine Transaksi QRIS

```
[INIT] ──► [PENDING] ──► [COMPLETED]
              │              │
              │              │ (auto-print receipt)
              ▼              ▼
         [EXPIRED]      [DONE]
              │
              │ (user cancels)
              ▼
         [CANCELLED]
```

---

## 4. Rencana Implementasi Detail

### 4.1 Fase 1: Backend Foundation (Rust)

#### 4.1.1 Tambah Dependensi

**File:** `src-tauri/Cargo.toml`

```toml
[dependencies]
# ... existing dependencies ...
reqwest = { version = "0.11", features = ["json"] }
dotenv = "0.15"
base64 = "0.21"  # Untuk encoding jika diperlukan
```

#### 4.1.2 Buat File Environment

**File:** `.env` (ditambahkan ke `.gitignore`)

```env
# Payment Gateway - Sandbox (Development)
MIDTRANS_SERVER_KEY=SB-Mid-server-xxx
MIDTRANS_CLIENT_KEY=SB-Mid-client-xxx
MIDTRANS_BASE_URL=https://api.sandbox.midtrans.com

# Payment Gateway - Production (akan diisi nanti)
# MIDTRANS_SERVER_KEY=Mid-server-xxx
# MIDTRANS_BASE_URL=https://api.midtrans.com

# Atau Xendit (alternatif)
# XENDIT_SECRET_KEY=xnd_development_xxx
# XENDIT_BASE_URL=https://api.xendit.co
```

#### 4.1.3 Update Database Schema

**File:** `src-tauri/src/database/migrations.rs`

Tambahkan kolom baru ke tabel `transactions`:

```sql
-- Tambah kolom untuk QRIS reference
ALTER TABLE transactions ADD COLUMN qris_reference TEXT;
ALTER TABLE transactions ADD COLUMN qris_expires_at DATETIME;
ALTER TABLE transactions ADD COLUMN payment_status TEXT DEFAULT 'COMPLETED' 
  CHECK(payment_status IN ('PENDING', 'COMPLETED', 'FAILED', 'EXPIRED', 'CANCELLED'));
```

**File:** `src-tauri/src/models/transaction.rs`

```rust
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Transaction {
    pub id: String,
    pub cashier_id: i64,
    pub timestamp: Option<String>,
    pub total_amount: f64,
    pub discount_id: Option<i64>,
    pub discount_amount: f64,
    pub tax_amount: f64,
    pub payment_method: String,  // "CASH" | "DEBIT" | "QRIS"
    pub amount_paid: f64,
    pub change_given: f64,
    pub status: String,          // "COMPLETED" | "VOID"
    pub payment_status: String,  // "PENDING" | "COMPLETED" | "FAILED" | "EXPIRED" | "CANCELLED"
    pub qris_reference: Option<String>,
    pub qris_expires_at: Option<String>,
    pub voided_by: Option<i64>,
    pub voided_at: Option<String>,
    pub notes: Option<String>,
}
```

#### 4.1.4 Buat Command Payment

**File:** `src-tauri/src/commands/payment_cmd.rs`

```rust
use crate::AppState;
use crate::models::transaction::Transaction;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::env;

/// Response dari Payment Gateway
#[derive(Debug, Serialize, Deserialize)]
struct QrisPaymentResponse {
    qr_string: String,
    order_id: String,
    expires_at: String,
}

/// Status pembayaran dari Payment Gateway
#[derive(Debug, Serialize, Deserialize)]
pub struct PaymentStatus {
    pub status: String,        // "pending", "settlement", "expire", "cancel"
    pub transaction_status: String,
    pub order_id: String,
}

/// Generate QRIS payment code
#[tauri::command]
pub async fn generate_qris_payment(
    state: tauri::State<'_, AppState>,
    session_token: String,
    amount: f64,
) -> Result<QrisPaymentResponse, String> {
    // 1. Validasi session
    let session = crate::auth::guard::validate_session(&state, &session_token)?;
    
    // 2. Validasi amount
    if amount <= 0.0 {
        return Err("Amount harus lebih dari 0".into());
    }
    
    // 3. Generate order_id unik
    let order_id = format!("QRIS-{}-{}", 
        chrono::Utc::now().format("%Y%m%d%H%M%S"),
        uuid::Uuid::new_v4().to_string()[..8].to_string()
    );
    
    // 4. Call Payment Gateway API (contoh: Midtrans)
    let server_key = env::var("MIDTRANS_SERVER_KEY")
        .map_err(|_| "MIDTRANS_SERVER_KEY tidak ditemukan di .env")?;
    let base_url = env::var("MIDTRANS_BASE_URL")
        .unwrap_or_else(|_| "https://api.sandbox.midtrans.com".to_string());
    
    let client = Client::new();
    
    // Prepare payload untuk Midtrans QRIS
    let payload = serde_json::json!({
        "payment_type": "qris",
        "transaction_details": {
            "order_id": order_id,
            "gross_amount": amount.round() as i64
        },
        "qris": {
            "acquirer": "gopay"  // Bisa diubah sesuai kebutuhan
        }
    });
    
    // 5. Request ke Payment Gateway
    let response = client
        .post(&format!("{}/v2/qris/create", base_url))
        .basic_auth(&server_key, Some(""))
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Gagal request ke Payment Gateway: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("Payment Gateway error: {:?}", response.status()));
    }
    
    let qr_response: QrisPaymentResponse = response.json()
        .await
        .map_err(|e| format!("Gagal parse response: {}", e))?;
    
    // 6. Simpan reference ke database (optional, untuk tracking)
    sqlx::query(
        "INSERT INTO qris_payments (order_id, transaction_id, amount, status, expires_at) 
         VALUES (?, ?, ?, 'PENDING', ?)"
    )
    .bind(&qr_response.order_id)
    .bind(&order_id)
    .bind(amount)
    .bind(&qr_response.expires_at)
    .execute(&state.db)
    .await
    .map_err(|e| e.to_string())?;
    
    Ok(qr_response)
}

/// Check payment status dari Payment Gateway
#[tauri::command]
pub async fn check_qris_status(
    state: tauri::State<'_, AppState>,
    session_token: String,
    order_id: String,
) -> Result<PaymentStatus, String> {
    crate::auth::guard::validate_session(&state, &session_token)?;
    
    let server_key = env::var("MIDTRANS_SERVER_KEY")
        .map_err(|_| "MIDTRANS_SERVER_KEY tidak ditemukan di .env")?;
    let base_url = env::var("MIDTRANS_BASE_URL")
        .unwrap_or_else(|_| "https://api.sandbox.midtrans.com".to_string());
    
    let client = Client::new();
    
    // Request status ke Payment Gateway
    let response = client
        .get(&format!("{}/v2/{}/status", base_url, order_id))
        .basic_auth(&server_key, Some(""))
        .send()
        .await
        .map_err(|e| format!("Gagal check status: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("Payment Gateway error: {:?}", response.status()));
    }
    
    let status: PaymentStatus = response.json()
        .await
        .map_err(|e| format!("Gagal parse status: {}", e))?;
    
    // Update status di database jika sudah settled
    if status.transaction_status == "settlement" {
        sqlx::query(
            "UPDATE transactions SET payment_status = 'COMPLETED' WHERE id = ?"
        )
        .bind(&order_id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    }
    
    Ok(status)
}

/// Cancel QRIS payment
#[tauri::command]
pub async fn cancel_qris_payment(
    state: tauri::State<'_, AppState>,
    session_token: String,
    order_id: String,
) -> Result<(), String> {
    crate::auth::guard::validate_session(&state, &session_token)?;
    
    let server_key = env::var("MIDTRANS_SERVER_KEY")
        .map_err(|_| "MIDTRANS_SERVER_KEY tidak ditemukan di .env")?;
    let base_url = env::var("MIDTRANS_BASE_URL")
        .unwrap_or_else(|_| "https://api.sandbox.midtrans.com".to_string());
    
    let client = Client::new();
    
    // Cancel via Payment Gateway
    let response = client
        .post(&format!("{}/v2/{}/cancel", base_url, order_id))
        .basic_auth(&server_key, Some(""))
        .send()
        .await
        .map_err(|e| format!("Gagal cancel payment: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("Payment Gateway error: {:?}", response.status()));
    }
    
    // Update status di database
    sqlx::query(
        "UPDATE transactions SET payment_status = 'CANCELLED' WHERE id = ?"
    )
    .bind(&order_id)
    .execute(&state.db)
    .await
    .map_err(|e| e.to_string())?;
    
    Ok(())
}
```

#### 4.1.5 Register Commands

**File:** `src-tauri/src/lib.rs`

Tambahkan ke `invoke_handler`:

```rust
// Payment QRIS
commands::payment_cmd::generate_qris_payment,
commands::payment_cmd::check_qris_status,
commands::payment_cmd::cancel_qris_payment,
```

**File:** `src-tauri/src/commands/mod.rs`

```rust
pub mod payment_cmd;
```

---

### 4.2 Fase 2: Frontend Components (React)

#### 4.2.1 Buat QRIS Modal Component

**File:** `src/features/pos/QRISModal.tsx`

```tsx
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { formatRupiah } from "../../lib/currency";
import { invoke } from "../../lib/tauri";
import { useAuthStore } from "../../store/authStore";
import { useToast } from "../../hooks/use-toast";
import { QrCode, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import QRCode from "qrcode.react";

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
  const [qrData, setQrData] = useState<{
    qrString: string;
    orderId: string;
    expiresAt: string;
  } | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(900); // 15 menit
  const [paymentStatus, setPaymentStatus] = useState<"pending" | "success" | "expired" | "failed">("pending");

  const sessionToken = useAuthStore((s) => s.sessionToken);
  const { toast } = useToast();

  // Generate QR saat modal dibuka
  useEffect(() => {
    if (open) {
      generateQR();
    }
  }, [open]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) {
      setPaymentStatus("expired");
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  // Polling status setiap 3 detik
  useEffect(() => {
    if (!qrData || paymentStatus !== "pending") return;

    const pollInterval = setInterval(async () => {
      try {
        const status = await invoke<PaymentStatus>("check_qris_status", {
          sessionToken,
          orderId: qrData.orderId,
        });

        if (status.status === "settlement" || status.transaction_status === "settlement") {
          setPaymentStatus("success");
          onSuccess(qrData.orderId);
          toast({
            title: "Pembayaran Berhasil!",
            description: "Transaksi telah dibayar.",
          });
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [qrData, paymentStatus, sessionToken, onSuccess, toast]);

  const generateQR = async () => {
    setLoading(true);
    try {
      const response = await invoke<{
        qr_string: string;
        order_id: string;
        expires_at: string;
      }>("generate_qris_payment", {
        sessionToken,
        amount,
      });

      setQrData({
        qrString: response.qr_string,
        orderId: response.order_id,
        expiresAt: response.expires_at,
      });

      // Hitung waktu dari expires_at
      const expires = new Date(response.expires_at).getTime();
      const now = Date.now();
      setTimeLeft(Math.floor((expires - now) / 1000));
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Gagal Generate QR",
        description: String(error),
      });
      onOpenChange(false);
      onCancel();
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleCancel = async () => {
    if (qrData?.orderId) {
      try {
        await invoke("cancel_qris_payment", {
          sessionToken,
          orderId: qrData.orderId,
        });
      } catch (error) {
        console.error("Cancel error:", error);
      }
    }
    onOpenChange(false);
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">
            Scan QRIS untuk Pembayaran
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Amount Display */}
          <div className="text-center">
            <div className="text-sm text-muted-foreground">Total Pembayaran</div>
            <div className="text-3xl font-bold text-primary">
              {formatRupiah(amount)}
            </div>
          </div>

          {/* QR Code */}
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
            </div>
          ) : paymentStatus === "success" ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <CheckCircle2 className="h-24 w-24 text-green-500" />
              <div className="text-xl font-semibold text-green-500">
                Pembayaran Berhasil!
              </div>
            </div>
          ) : paymentStatus === "expired" ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <AlertCircle className="h-24 w-24 text-orange-500" />
              <div className="text-xl font-semibold text-orange-500">
                QR Code Kadaluarsa
              </div>
              <Button onClick={generateQR}>Generate QR Baru</Button>
            </div>
          ) : qrData ? (
            <div className="flex flex-col items-center space-y-4">
              <QRCode
                value={qrData.qrString}
                size={256}
                level="H"
                includeMargin={true}
              />
              <div className="text-sm text-muted-foreground">
                Gunakan aplikasi e-wallet untuk scan
              </div>
            </div>
          ) : null}

          {/* Timer */}
          {paymentStatus === "pending" && qrData && (
            <div className="flex items-center justify-center space-x-2 text-sm">
              <Clock className="h-4 w-4" />
              <span className={timeLeft < 60 ? "text-red-500" : ""}>
                Waktu tersisa: {formatTime(timeLeft)}
              </span>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
            <div className="font-semibold">Cara Pembayaran:</div>
            <ol className="list-decimal list-inside space-y-1">
              <li>Buka aplikasi e-wallet (GoPay/OVO/Dana/dll)</li>
              <li>Pilih fitur Scan QR</li>
              <li>Arahkan kamera ke QR Code di atas</li>
              <li>Ikuti instruksi pembayaran di aplikasi</li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        {paymentStatus === "pending" && (
          <div className="flex justify-between">
            <Button variant="outline" onClick={handleCancel}>
              Batal
            </Button>
            <Button variant="ghost" onClick={generateQR}>
              Refresh QR
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

#### 4.2.2 Buat Polling Hook (Optional - bisa di-integrate ke modal)

**File:** `src/hooks/useQrisPayment.ts`

```tsx
import { useState, useEffect, useCallback } from "react";
import { invoke } from "../lib/tauri";
import { useAuthStore } from "../store/authStore";
import { useToast } from "./use-toast";

export type QrisStatus = "pending" | "success" | "expired" | "failed";

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
  const [status, setStatus] = useState<QrisStatus>("pending");
  const sessionToken = useAuthStore((s) => s.sessionToken);
  const { toast } = useToast();

  const checkStatus = useCallback(async () => {
    if (!orderId || !enabled) return;

    try {
      const result = await invoke<{
        status: string;
        transaction_status: string;
      }>("check_qris_status", {
        sessionToken,
        orderId,
      });

      if (
        result.status === "settlement" ||
        result.transaction_status === "settlement"
      ) {
        setStatus("success");
        onSuccess?.();
        toast({
          title: "Pembayaran Berhasil",
          description: "Transaksi telah dibayar.",
        });
      } else if (result.status === "expire") {
        setStatus("expired");
        onExpired?.();
      } else if (result.status === "cancel" || result.status === "failed") {
        setStatus("failed");
      }
    } catch (error) {
      console.error("Polling error:", error);
    }
  }, [orderId, enabled, sessionToken, onSuccess, onExpired, toast]);

  useEffect(() => {
    if (!enabled || !orderId) return;

    // Poll setiap 3 detik
    const interval = setInterval(checkStatus, 3000);
    checkStatus(); // Check immediately

    return () => clearInterval(interval);
  }, [enabled, orderId, checkStatus]);

  return { status, refreshStatus: checkStatus };
}
```

#### 4.2.3 Update PaymentModal

**File:** `src/features/pos/PaymentModal.tsx`

Tambahkan import dan logic untuk QRIS:

```tsx
import { QRISModal } from "./QRISModal";
// ... existing imports

export function PaymentModal({ open, onOpenChange, onSuccess }: ...) {
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [amountPaid, setAmountPaid] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showQrisModal, setShowQrisModal] = useState(false);
  const [qrisOrderId, setQrisOrderId] = useState<string | null>(null);

  // ... existing state and logic

  const handlePay = async () => {
    // ... existing validation

    // Special handling for QRIS
    if (method === "QRIS") {
      setShowQrisModal(true);
      return;
    }

    // ... existing payment logic for CASH/DEBIT
  };

  const handleQrisSuccess = async (orderId: string) => {
    setQrisOrderId(orderId);
    setShowQrisModal(false);
    
    // Create transaction with QRIS payment
    try {
      const payload: CreateTransactionPayload = {
        items: items.map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
          price_at_time: i.price,
          discount_amount: i.discount_amount || 0,
        })),
        discount_id,
        discount_amount: getDiscountAmount(),
        payment_method: "QRIS",
        amount_paid: total,
        notes: `QRIS Order ID: ${orderId}`,
      };

      const transaction = await invoke<Transaction>("create_transaction", {
        sessionToken,
        payload,
      });

      clearCart();
      onSuccess(transaction);
      onOpenChange(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Transaksi Gagal",
        description: String(error),
      });
    }
  };

  return (
    <>
      {/* ... existing PaymentModal JSX ... */}
      
      <QRISModal
        open={showQrisModal}
        onOpenChange={setShowQrisModal}
        amount={total}
        onSuccess={handleQrisSuccess}
        onCancel={() => {
          setShowQrisModal(false);
          setMethod("CASH");
        }}
      />
    </>
  );
}
```

#### 4.2.4 Install QR Code Library

```bash
npm install qrcode.react
```

---

### 4.3 Fase 3: Settings & Configuration

#### 4.3.1 Payment Gateway Settings UI

**File:** `src/features/settings/PaymentSettings.tsx` (baru)

```tsx
import { useForm } from "react-hook-form";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Switch } from "../../components/ui/switch";
import { useToast } from "../../hooks/use-toast";
import { invoke } from "../../lib/tauri";
import { useAuthStore } from "../../store/authStore";

interface PaymentSettingsForm {
  qrisEnabled: boolean;
  provider: "midtrans" | "xendit";
  serverKey: string;
  baseUrl: string;
}

export function PaymentSettings() {
  const { register, handleSubmit, formState: { errors } } = useForm<PaymentSettingsForm>();
  const { toast } = useToast();
  const sessionToken = useAuthStore((s) => s.sessionToken);

  const onSubmit = async (data: PaymentSettingsForm) => {
    try {
      await invoke("save_payment_settings", {
        sessionToken,
        settings: data,
      });
      toast({
        title: "Settings Disimpan",
        description: "Konfigurasi pembayaran berhasil disimpan.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Gagal Menyimpan",
        description: String(error),
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Pengaturan Pembayaran QRIS</h3>
        <p className="text-sm text-muted-foreground">
          Konfigurasi Payment Gateway untuk pembayaran QRIS
        </p>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="qris-enabled"
          {...register("qrisEnabled")}
        />
        <Label htmlFor="qris-enabled">Aktifkan Pembayaran QRIS</Label>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="provider">Payment Gateway Provider</Label>
          <select
            id="provider"
            {...register("provider")}
            className="w-full p-2 border rounded"
          >
            <option value="midtrans">Midtrans</option>
            <option value="xendit">Xendit</option>
          </select>
        </div>

        <div>
          <Label htmlFor="serverKey">Server Key</Label>
          <Input
            id="serverKey"
            type="password"
            {...register("serverKey", { required: "Server Key wajib diisi" })}
          />
          {errors.serverKey && (
            <p className="text-sm text-red-500">{errors.serverKey.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="baseUrl">Base URL API</Label>
          <Input
            id="baseUrl"
            {...register("baseUrl")}
            placeholder="https://api.sandbox.midtrans.com"
          />
        </div>
      </div>

      <Button type="submit">Simpan Pengaturan</Button>
    </form>
  );
}
```

---

### 4.4 Fase 4: Testing & Edge Cases

#### 4.4.1 Test Scenarios

| Skenario | Expected Result | Status |
|----------|-----------------|--------|
| Generate QR dengan amount valid | QR code tampil, timer mulai | ⬜ |
| Generate QR dengan amount 0 | Error message tampil | ⬜ |
| Payment berhasil (sandbox) | Modal auto-close, struk print | ⬜ |
| Payment expired (timeout) | Status expired, opsi generate baru | ⬜ |
| User cancel payment | Transaksi batal, kembali ke POS | ⬜ |
| Network error saat polling | Error message, retry button | ⬜ |
| Network error saat generate QR | Error message, kembali ke payment method | ⬜ |

#### 4.4.2 Edge Cases Handling

```tsx
// Di QRISModal.tsx

// Handle network error saat polling
useEffect(() => {
  // ... existing polling logic
  }, 3000);

  return () => clearInterval(interval);
}, [qrData, paymentStatus, sessionToken, onSuccess, toast]);

// Handle visibility change (tab switch)
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      // Resume polling jika tab aktif kembali
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
}, []);
```

---

## 5. Checklist Implementasi

### Backend (Rust)

- [ ] Tambah dependensi `reqwest`, `dotenv` ke `Cargo.toml`
- [ ] Buat file `.env` dengan API credentials
- [ ] Update database schema dengan migration
- [ ] Update model `Transaction` dengan field baru
- [ ] Buat `src-tauri/src/commands/payment_cmd.rs`
- [ ] Register commands di `lib.rs`
- [ ] Test API integration dengan sandbox

### Frontend (React)

- [ ] Install `qrcode.react`
- [ ] Buat `src/features/pos/QRISModal.tsx`
- [ ] Buat `src/hooks/useQrisPayment.ts`
- [ ] Update `PaymentModal.tsx` dengan logic QRIS
- [ ] Buat `src/features/settings/PaymentSettings.tsx`
- [ ] Integrate settings ke Settings page
- [ ] Test UI flow lengkap

### Testing & Deployment

- [ ] Test dengan Midtrans/Xendit sandbox
- [ ] Test edge cases (timeout, network error, dll)
- [ ] Update dokumentasi
- [ ] Build dan test aplikasi production

---

## 6. Timeline Estimasi

| Fase | Durasi | Dependencies |
|------|--------|--------------|
| Fase 1: Backend | 1 hari | - |
| Fase 2: Frontend | 1.5 hari | Fase 1 selesai |
| Fase 3: Settings | 0.5 hari | Fase 2 selesai |
| Fase 4: Testing | 1 hari | Semua fitur selesai |
| **Total** | **4 hari** | - |

---

## 7. Referensi API

### Midtrans QRIS API

**Create QRIS:**
```
POST https://api.sandbox.midtrans.com/v2/qris/create
Authorization: Basic BASE64(SERVER_KEY:)
```

**Check Status:**
```
GET https://api.sandbox.midtrans.com/v2/{ORDER_ID}/status
```

**Cancel Payment:**
```
POST https://api.sandbox.midtrans.com/v2/{ORDER_ID}/cancel
```

### Xendit QRIS API (Alternatif)

**Create QRIS:**
```
POST https://api.xendit.co/v2/qris
Authorization: Basic BASE64(SECRET_KEY:)
```

---

## 8. Catatan Penting

1. **Keamanan:**
   - API keys HARUS disimpan di `.env` (backend Rust)
   - Jangan pernah expose API keys ke frontend
   - Gunakan HTTPS untuk semua API calls

2. **Offline Handling:**
   - Aplikasi tetap bisa berfungsi tanpa internet untuk pembayaran tunai
   - QRIS hanya tersedia jika ada koneksi internet
   - Tampilkan warning jika internet terputus saat proses QRIS

3. **Sandbox vs Production:**
   - Selalu test di sandbox environment terlebih dahulu
   - Gunakan credentials production hanya saat ready to deploy
   - Simpan credentials production di secure location

4. **Compliance:**
   - Pastikan PCI-DSS compliance (tidak simpan data kartu)
   - Follow Payment Gateway provider's best practices
   - Log semua transaksi untuk audit trail

---

## 9. Kesimpulan

Implementasi QRIS payment integration memerlukan:
- **4 hari** development time estimasi
- **Payment Gateway account** (Midtrans/Xendit sandbox untuk testing)
- **Testing menyeluruh** untuk edge cases

Arsitektur Tauri memungkinkan pemisahan yang jelas antara frontend (UI) dan backend (API integration), dengan keamanan API keys terjaga di sisi Rust.
