# PRD & Implementation Plan: Integrasi Pembayaran QRIS

> **Dokumen ini adalah panduan lengkap untuk implementasi fitur pembayaran QRIS pada aplikasi POS Kasir Alpiant.**
> Dirancang agar dapat dipahami dan dieksekusi oleh AI coding assistant manapun.

ini adalah:
Client Key = [REMOVED_SECRET]
Server Key = [REMOVED_SECRET]
dalam environment sandbox saya

---

## Meta Informasi

| Key                  | Value                                                               |
| -------------------- | ------------------------------------------------------------------- |
| **Proyek**           | POS Kasir Alpiant                                                   |
| **Stack**            | Tauri v2, React 18, TypeScript, Rust (backend), SQLite (database)   |
| **Package Manager**  | npm                                                                 |
| **Root directory**   | `/home/alpiant/Documents/apps/pos-kasir-alpiant`                    |
| **Frontend source**  | `src/`                                                              |
| **Backend source**   | `src-tauri/src/`                                                    |
| **UI Library**       | shadcn/ui (Radix UI + Tailwind CSS)                                 |
| **State Management** | Zustand                                                             |
| **IPC**              | Tauri `invoke()` — frontend memanggil Rust backend via IPC commands |
| **Tanggal dibuat**   | 24 Februari 2026                                                    |
| **Status**           | Dalam pengerjaan (90%)                                              |

---

## 1. Product Requirements Document (PRD)

### 1.1 Ringkasan Produk

Menambahkan fitur pembayaran QRIS (Quick Response Code Indonesian Standard) pada aplikasi POS Kasir Alpiant, memungkinkan pelanggan membayar menggunakan e-wallet (GoPay, OVO, Dana, ShopeePay, dll) melalui scan QR code. Integrasi menggunakan **Midtrans** sebagai payment gateway utama.

### 1.2 Latar Belakang & Status Saat Ini

**Yang sudah tersedia ✅:**

| Komponen            | File                                        | Detail                                                                                          |
| ------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Tombol QRIS di UI   | `src/features/pos/PaymentModal.tsx`         | Tombol sudah ada, tapi hanya visual. Klik QRIS langsung set method saja, tidak ada flow khusus. |
| PaymentMethod enum  | `src/types/index.ts` baris 2                | `export type PaymentMethod = "CASH" \| "DEBIT" \| "QRIS";`                                      |
| Backend transaction | `src-tauri/src/commands/transaction_cmd.rs` | `create_transaction()` sudah menerima `"QRIS"` sebagai `payment_method`                         |
| Transaction model   | `src-tauri/src/models/transaction.rs`       | Struct `Transaction` dengan field `payment_method: String`                                      |
| Database schema     | `src-tauri/src/database/migrations.rs`      | Tabel `transactions` sudah ada                                                                  |
| Authentication      | `src-tauri/src/auth/`                       | Session-based auth, semua command butuh `session_token`                                         |
| Settings page       | `src/pages/SettingsPage.tsx`                | Tab-based settings UI (Company, Receipt, Printer, Discount)                                     |
| Invoke wrapper      | `src/lib/tauri.ts`                          | Helper `invoke()` yang wraps Tauri `invoke`                                                     |

**Yang perlu dibangun ❌:**

- Koneksi ke Midtrans Payment Gateway API
- QR code generation & display component
- Status polling mechanism (cek apakah sudah dibayar)
- Database tracking untuk QRIS payments
- Settings UI untuk konfigurasi payment gateway

### 1.3 User Flow

```
1. Kasir menambahkan produk ke cart
2. Kasir klik "Bayar" → PaymentModal terbuka
3. Kasir pilih metode "QRIS" → klik "Konfirmasi"
4. System buka QRISModal → panggil backend generate_qris_payment(amount)
5. Backend call Midtrans API → dapat QR string
6. QRISModal tampilkan QR code + countdown timer (15 menit)
7. System polling check_qris_status() setiap 3 detik
8a. JIKA pembayaran berhasil (settlement) →
    - Auto-create transaction via create_transaction()
    - Tampilkan success state
    - Print receipt
    - Tutup modal
8b. JIKA expired →
    - Tampilkan status expired
    - Opsi generate QR baru
8c. JIKA user cancel →
    - Call cancel_qris_payment()
    - Tutup modal, kembali ke PaymentModal
```

### 1.4 Functional Requirements

| ID    | Requirement                                                             | Prioritas |
| ----- | ----------------------------------------------------------------------- | --------- |
| FR-01 | Kasir bisa memilih QRIS dan generate QR code                            | Tinggi    |
| FR-02 | QR code tampil di modal dengan countdown timer (15 menit)               | Tinggi    |
| FR-03 | Sistem auto-polling status pembayaran setiap 3 detik                    | Tinggi    |
| FR-04 | Jika berhasil (settlement) → buat transaksi + cetak struk otomatis      | Tinggi    |
| FR-05 | Jika expired → tampilkan opsi generate QR baru                          | Tinggi    |
| FR-06 | Kasir bisa batalkan pembayaran QRIS kapan saja                          | Tinggi    |
| FR-07 | Admin bisa konfigurasi payment gateway credentials di Settings          | Menengah  |
| FR-08 | QRIS button disabled / warning jika tidak ada koneksi internet          | Menengah  |
| FR-09 | Tracking referensi QRIS (order_id) di database tabel qris_payments      | Menengah  |
| FR-10 | Laporan existing sudah mendukung QRIS (field qris_total ada di reports) | Rendah    |

### 1.5 Non-Functional Requirements

| Aspek           | Requirement                                                                            |
| --------------- | -------------------------------------------------------------------------------------- |
| **Keamanan**    | API keys tersimpan di backend Rust saja, tidak pernah terexpose ke frontend JavaScript |
| **Reliability** | Polling error tidak crash app; retry max 3x, tampilkan warning jika gagal terus        |
| **Offline**     | Pembayaran CASH & DEBIT tetap berfungsi tanpa internet. QRIS disabled jika offline     |
| **Performance** | Polling interval 3 detik, auto-stop saat status final                                  |
| **Compliance**  | Tidak menyimpan data finansial sensitif, mengikuti standar integrasi Midtrans          |

---

## 2. Arsitektur Sistem

### 2.1 Diagram Alur

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (React + TypeScript)                │
│                                                                 │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐ │
│  │ PaymentModal │ ───► │  QRISModal   │ ───► │ useQrisPoll  │ │
│  │  (existing)  │      │   (NEW)      │      │  Hook (NEW)  │ │
│  └──────────────┘      └──────────────┘      └──────────────┘ │
│         │                     │                     │          │
│         │ invoke()            │ invoke()            │ poll()   │
│         ▼                     ▼                     ▼          │
└─────────────────────────────────────────────────────────────────┘
                            │ IPC (Tauri invoke)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (Rust)                               │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  payment_cmd.rs (NEW)                                    │  │
│  │  ├── generate_qris_payment()     → Create QR via API     │  │
│  │  ├── check_qris_status()         → Poll payment status   │  │
│  │  └── cancel_qris_payment()       → Cancel payment        │  │
│  └──────────────────────────────────────────────────────────┘  │
│         │                     │                                 │
│         ▼                     ▼                                 │
│  ┌──────────────┐      ┌──────────────┐                        │
│  │ qris_payments│      │   Midtrans   │                        │
│  │   table      │      │     API      │                        │
│  │  (SQLite)    │      │  (External)  │                        │
│  └──────────────┘      └──────────────┘                        │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 State Machine QRISModal

```
[INIT] ──► [LOADING] ──► [PENDING] ──► [SUCCESS] ──► [DONE]
                │             │
                │             ├──► [EXPIRED] ──► [LOADING] (regenerate)
                │             │
                │             └──► [CANCELLED] ──► [CLOSED]
                │
                └──► [ERROR] ──► [CLOSED]
```

---

## 3. Detail Implementasi (Proposed Changes)

> **PENTING**: Implementasi harus dilakukan secara berurutan per fase. Fase 2 bergantung pada Fase 1.

### Fase 1: Backend Foundation (Rust)

#### 3.1 [MODIFY] `src-tauri/Cargo.toml`

Tambah dependency HTTP client dan security:

```toml
# Tambahkan di bawah dependencies existing:
reqwest = { version = "0.11", features = ["json", "rustls-tls"] }
aes-gcm = "0.10"        # Enkripsi API keys
rand = "0.8"            # Random nonce generation
lazy_static = "1.4"     # Rate limiter statics
```

> Note: `rustls-tls` dipilih agar tidak bergantung pada OpenSSL system library. Dependency `base64`, `serde_json`, `uuid`, `chrono` sudah ada di Cargo.toml.

---

#### 3.2 [MODIFY] `src-tauri/src/database/migrations.rs`

Tambahkan di dalam fungsi `run_migrations()`, setelah migration existing:

```rust
// === Migration: QRIS Payment Tracking ===

// Tambah kolom ke transactions table
safe_add_column(pool, "transactions", "qris_reference", "TEXT").await?;
safe_add_column(pool, "transactions", "payment_status", "TEXT DEFAULT 'COMPLETED'").await?;

// Tabel baru: tracking QRIS payments
sqlx::query(
    "CREATE TABLE IF NOT EXISTS qris_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id TEXT NOT NULL UNIQUE,
        amount REAL NOT NULL,
        qr_string TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING'
            CHECK(status IN ('PENDING', 'SETTLED', 'EXPIRED', 'CANCELLED')),
        transaction_id TEXT,
        expires_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        settled_at DATETIME,
        FOREIGN KEY (transaction_id) REFERENCES transactions(id)
    )"
)
.execute(pool)
.await?;
```

> Note: Fungsi `safe_add_column()` sudah ada di `migrations.rs` (baris 300-313). Ini aman dipanggil berulang — akan skip jika kolom sudah ada.

---

#### 3.3 [NEW] `src-tauri/src/models/payment.rs`

```rust
use serde::{Deserialize, Serialize};

/// Response dari Midtrans setelah generate QRIS
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QrisPaymentResponse {
    pub qr_string: String,
    pub order_id: String,
    pub expires_at: String,
}

/// Status pembayaran dari Midtrans
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QrisStatusResponse {
    pub status: String,            // "pending", "settlement", "expire", "cancel"
    pub transaction_status: String,
    pub order_id: String,
}

/// Record di tabel qris_payments
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct QrisPayment {
    pub id: i64,
    pub order_id: String,
    pub amount: f64,
    pub qr_string: Option<String>,
    pub status: String,
    pub transaction_id: Option<String>,
    pub expires_at: Option<String>,
    pub created_at: Option<String>,
    pub settled_at: Option<String>,
}

/// Midtrans Charge API response (raw)
#[derive(Debug, Deserialize)]
pub struct MidtransChargeResponse {
    pub status_code: String,
    pub status_message: String,
    pub transaction_id: Option<String>,
    pub order_id: String,
    pub gross_amount: Option<String>,
    pub payment_type: Option<String>,
    pub transaction_time: Option<String>,
    pub transaction_status: Option<String>,
    pub actions: Option<Vec<MidtransAction>>,
    pub expiry_time: Option<String>,
    // QRIS specific
    pub qr_string: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct MidtransAction {
    pub name: String,
    pub method: String,
    pub url: String,
}

/// Midtrans Status API response (raw)
#[derive(Debug, Deserialize)]
pub struct MidtransStatusResponse {
    pub status_code: String,
    pub transaction_status: String,
    pub order_id: String,
    pub gross_amount: Option<String>,
    pub payment_type: Option<String>,
    pub settlement_time: Option<String>,
}
```

Jangan lupa register module ini:

**`src-tauri/src/models/mod.rs`** — tambahkan:

```rust
pub mod payment;
```

---

#### 3.4 [MODIFY] `src-tauri/src/models/transaction.rs`

Tambah 2 field baru ke struct `Transaction` (baris 4-19):

```rust
// Tambah di akhir struct Transaction, sebelum closing brace:
pub qris_reference: Option<String>,
pub payment_status: Option<String>,
```

Tambah juga ke struct `TransactionWithCashier` (baris 23-39):

```rust
// Tambah di akhir struct TransactionWithCashier, sebelum closing brace:
pub qris_reference: Option<String>,
pub payment_status: Option<String>,
```

> **PERHATIAN**: Semua query SELECT di `transaction_cmd.rs` yang mengambil `Transaction` atau `TransactionWithCashier` mungkin perlu di-update agar include kolom baru ini. Periksa query di `create_transaction`, `get_transactions`, `get_transaction_detail`, `void_transaction`.

---

#### 3.5 [NEW] `src-tauri/src/commands/payment_cmd.rs`

```rust
use crate::models::payment::{
    MidtransChargeResponse, MidtransStatusResponse, QrisPaymentResponse, QrisStatusResponse,
};
use crate::AppState;
use reqwest::Client;
use std::env;

/// Generate QRIS payment QR code via Midtrans
#[tauri::command]
pub async fn generate_qris_payment(
    state: tauri::State<'_, AppState>,
    session_token: String,
    amount: f64,
) -> Result<QrisPaymentResponse, String> {
    // 1. Validasi session
    crate::auth::guard::validate_session(&state, &session_token)?;

    // 2. Validasi amount
    if amount <= 0.0 {
        return Err("Amount harus lebih dari 0".into());
    }

    // 3. Generate unique order_id
    let order_id = format!(
        "QRIS-{}-{}",
        chrono::Utc::now().format("%Y%m%d%H%M%S"),
        &uuid::Uuid::new_v4().to_string()[..8]
    );

    // 4. Ambil credentials dari environment
    let server_key = env::var("MIDTRANS_SERVER_KEY")
        .map_err(|_| "MIDTRANS_SERVER_KEY tidak ditemukan. Konfigurasi di Settings → Pembayaran.".to_string())?;
    let base_url = env::var("MIDTRANS_BASE_URL")
        .unwrap_or_else(|_| "https://api.sandbox.midtrans.com".to_string());

    // 5. Prepare payload Midtrans Charge API (QRIS)
    let payload = serde_json::json!({
        "payment_type": "qris",
        "transaction_details": {
            "order_id": order_id,
            "gross_amount": amount.round() as i64
        }
    });

    // 6. Call Midtrans API
    let client = Client::new();
    let response = client
        .post(&format!("{}/v2/charge", base_url))
        .basic_auth(&server_key, Some(""))
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Gagal koneksi ke Payment Gateway: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Payment Gateway error ({}): {}", status, body));
    }

    let midtrans_resp: MidtransChargeResponse = response
        .json()
        .await
        .map_err(|e| format!("Gagal parse response dari Payment Gateway: {}", e))?;

    // 7. Extract QR string
    let qr_string = midtrans_resp
        .qr_string
        .or_else(|| {
            // Fallback: cari di actions array
            midtrans_resp.actions.as_ref().and_then(|actions| {
                actions
                    .iter()
                    .find(|a| a.name == "generate-qr-code")
                    .map(|a| a.url.clone())
            })
        })
        .ok_or("QR string tidak ditemukan di response Payment Gateway")?;

    let expires_at = midtrans_resp
        .expiry_time
        .unwrap_or_else(|| {
            // Default 15 menit dari sekarang
            (chrono::Utc::now() + chrono::Duration::minutes(15))
                .format("%Y-%m-%d %H:%M:%S")
                .to_string()
        });

    // 8. Simpan ke database
    sqlx::query(
        "INSERT INTO qris_payments (order_id, amount, qr_string, status, expires_at)
         VALUES (?, ?, ?, 'PENDING', ?)"
    )
    .bind(&order_id)
    .bind(amount)
    .bind(&qr_string)
    .bind(&expires_at)
    .execute(&state.db)
    .await
    .map_err(|e| format!("Gagal simpan QRIS payment: {}", e))?;

    Ok(QrisPaymentResponse {
        qr_string,
        order_id,
        expires_at,
    })
}

/// Check QRIS payment status dari Midtrans
#[tauri::command]
pub async fn check_qris_status(
    state: tauri::State<'_, AppState>,
    session_token: String,
    order_id: String,
) -> Result<QrisStatusResponse, String> {
    crate::auth::guard::validate_session(&state, &session_token)?;

    let server_key = env::var("MIDTRANS_SERVER_KEY")
        .map_err(|_| "MIDTRANS_SERVER_KEY tidak ditemukan".to_string())?;
    let base_url = env::var("MIDTRANS_BASE_URL")
        .unwrap_or_else(|_| "https://api.sandbox.midtrans.com".to_string());

    let client = Client::new();
    let response = client
        .get(&format!("{}/v2/{}/status", base_url, order_id))
        .basic_auth(&server_key, Some(""))
        .send()
        .await
        .map_err(|e| format!("Gagal check status: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Payment Gateway error: {:?}", response.status()));
    }

    let midtrans_status: MidtransStatusResponse = response
        .json()
        .await
        .map_err(|e| format!("Gagal parse status: {}", e))?;

    // Map Midtrans status ke internal status
    let status = match midtrans_status.transaction_status.as_str() {
        "settlement" | "capture" => "settlement",
        "pending" => "pending",
        "expire" => "expire",
        "cancel" | "deny" => "cancel",
        other => other,
    };

    // Update DB jika settled
    if status == "settlement" {
        sqlx::query("UPDATE qris_payments SET status = 'SETTLED', settled_at = CURRENT_TIMESTAMP WHERE order_id = ?")
            .bind(&order_id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    } else if status == "expire" {
        sqlx::query("UPDATE qris_payments SET status = 'EXPIRED' WHERE order_id = ?")
            .bind(&order_id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    }

    Ok(QrisStatusResponse {
        status: status.to_string(),
        transaction_status: midtrans_status.transaction_status,
        order_id: midtrans_status.order_id,
    })
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
        .map_err(|_| "MIDTRANS_SERVER_KEY tidak ditemukan".to_string())?;
    let base_url = env::var("MIDTRANS_BASE_URL")
        .unwrap_or_else(|_| "https://api.sandbox.midtrans.com".to_string());

    let client = Client::new();
    // Cancel via Midtrans — ignore error jika sudah expired
    let _ = client
        .post(&format!("{}/v2/{}/cancel", base_url, order_id))
        .basic_auth(&server_key, Some(""))
        .send()
        .await;

    // Update status di database
    sqlx::query("UPDATE qris_payments SET status = 'CANCELLED' WHERE order_id = ?")
        .bind(&order_id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}
```

---

#### 3.6 [MODIFY] `src-tauri/src/commands/mod.rs`

**Isi saat ini** (baris 1-6):

```rust
pub mod activity_cmd;
pub mod auth_cmd;
pub mod discount_cmd;
pub mod product_cmd;
pub mod report_cmd;
pub mod settings_cmd;
pub mod transaction_cmd;
pub mod user_cmd;
```

**Tambahkan:**

```rust
pub mod payment_cmd;
```

---

#### 3.7 [MODIFY] `src-tauri/src/lib.rs`

Tambahkan module declarations di atas:

```rust
pub mod encryption;
pub mod audit;
pub mod rate_limiter;
```

Di dalam `invoke_handler(tauri::generate_handler![...])`, tambahkan setelah blok `// Transactions`:

```rust
// Payment QRIS
commands::payment_cmd::generate_qris_payment,
commands::payment_cmd::check_qris_status,
commands::payment_cmd::cancel_qris_payment,
commands::payment_cmd::save_payment_config,
commands::payment_cmd::get_payment_config,
commands::payment_cmd::test_payment_connection,
```

---

### Fase 2: Frontend Components (React/TypeScript)

#### 3.8 NPM Dependency

```bash
npm install qrcode.react
```

Library ini digunakan untuk render QR code dari string di QRISModal.

---

#### 3.9 [MODIFY] `src/types/index.ts`

Tambahkan type baru di akhir file:

```typescript
// === QRIS Payment Types ===

export type QrisPaymentStatus =
  | "PENDING"
  | "COMPLETED"
  | "FAILED"
  | "EXPIRED"
  | "CANCELLED";

export interface QrisPaymentResponse {
  qr_string: string;
  order_id: string;
  expires_at: string;
}

export interface QrisStatusResponse {
  status: string; // "pending" | "settlement" | "expire" | "cancel"
  transaction_status: string;
  order_id: string;
}
```

---

#### 3.10 [NEW] `src/hooks/useQrisPayment.ts`

Custom hook untuk QRIS polling logic. Cara kerja:

- Terima `orderId` dan `enabled` flag
- Poll `check_qris_status` via Tauri invoke setiap 3 detik
- Return status: `"pending"` | `"success"` | `"expired"` | `"failed"`
- Auto-stop polling jika status bukan pending
- Cleanup interval on unmount
- Error counter: setelah 3 error berturut-turut, tampilkan warning

```typescript
import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "../lib/tauri";
import { useAuthStore } from "../store/authStore";
import { QrisStatusResponse } from "../types";

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
  const [errorCount, setErrorCount] = useState(0);
  const sessionToken = useAuthStore((s) => s.sessionToken);
  const onSuccessRef = useRef(onSuccess);
  const onExpiredRef = useRef(onExpired);

  // Keep refs updated
  onSuccessRef.current = onSuccess;
  onExpiredRef.current = onExpired;

  const checkStatus = useCallback(async () => {
    if (!orderId || !enabled || !sessionToken) return;

    try {
      const result = await invoke<QrisStatusResponse>("check_qris_status", {
        sessionToken,
        orderId,
      });

      setErrorCount(0); // Reset error counter on success

      if (
        result.status === "settlement" ||
        result.transaction_status === "settlement"
      ) {
        setStatus("success");
        onSuccessRef.current?.();
      } else if (result.status === "expire") {
        setStatus("expired");
        onExpiredRef.current?.();
      } else if (result.status === "cancel" || result.status === "deny") {
        setStatus("failed");
      }
    } catch (error) {
      setErrorCount((prev) => prev + 1);
      console.error("QRIS polling error:", error);
    }
  }, [orderId, enabled, sessionToken]);

  useEffect(() => {
    if (!enabled || !orderId) return;

    const interval = setInterval(checkStatus, 3000);
    checkStatus(); // Check immediately on mount

    return () => clearInterval(interval);
  }, [enabled, orderId, checkStatus]);

  return { status, errorCount, refreshStatus: checkStatus };
}
```

---

#### 3.11 [NEW] `src/features/pos/QRISModal.tsx`

Modal yang menampilkan QR code dan handle payment flow. Key features:

- Render QR code menggunakan `qrcode.react`
- Countdown timer dari `expires_at`
- Status states: loading, pending, success, expired, error
- Instruksi pembayaran untuk user
- Tombol Batal dan Refresh QR

Komponen ini menerima props:

```typescript
interface QRISModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number; // Total yang harus dibayar
  onSuccess: (orderId: string) => void; // Callback saat pembayaran berhasil
  onCancel: () => void; // Callback saat dibatalkan
}
```

Behavior:

1. Saat `open` menjadi `true`, panggil `generate_qris_payment` via invoke
2. Render QR code dari `qr_string` response
3. Start countdown dari `expires_at`
4. Start polling via `useQrisPayment` hook
5. Saat settlement → panggil `onSuccess(orderId)`
6. Saat expired → tampilkan opsi regenerate
7. Saat cancel → panggil `cancel_qris_payment` lalu `onCancel()`

UI Layout:

- Header: "Scan QRIS untuk Pembayaran"
- Total amount display: `formatRupiah(amount)` (import dari `src/lib/currency.ts`)
- QR Code: 256x256px, level "H"
- Timer: "Waktu tersisa: MM:SS" (merah jika < 60 detik)
- Instructions box: langkah scan dengan e-wallet
- Footer: tombol Batal (variant outline) + Refresh QR (variant ghost)
- Success state: CheckCircle2 icon hijau + "Pembayaran Berhasil!"
- Expired state: AlertCircle icon orange + "QR Code Kadaluarsa" + tombol generate baru

Gunakan komponen UI dari:

- `src/components/ui/dialog.tsx` — Dialog, DialogContent, DialogHeader, DialogTitle
- `src/components/ui/button.tsx` — Button
- Icons dari `lucide-react` — QrCode, Clock, CheckCircle2, AlertCircle

---

#### 3.12 [MODIFY] `src/features/pos/PaymentModal.tsx`

Perubahan yang dibutuhkan:

**1. Tambah import:**

```typescript
import { QRISModal } from "./QRISModal";
```

**2. Tambah state:**

```typescript
const [showQrisModal, setShowQrisModal] = useState(false);
```

**3. Modifikasi `handlePay()`:**
Tambahkan di awal fungsi, sebelum logic existing:

```typescript
// Intercept QRIS payment → buka modal khusus
if (method === "QRIS") {
  setShowQrisModal(true);
  return;
}
```

**4. Tambah handler QRIS success:**

```typescript
const handleQrisSuccess = async (orderId: string) => {
  setShowQrisModal(false);
  setLoading(true);
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
      amount_paid: Math.round(total),
      notes: `QRIS Order: ${orderId}`,
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
  } finally {
    setLoading(false);
  }
};
```

**5. Tambah QRISModal di return JSX:**
Setelah closing `</Dialog>`, tambahkan:

```tsx
<QRISModal
  open={showQrisModal}
  onOpenChange={setShowQrisModal}
  amount={Math.round(total)}
  onSuccess={handleQrisSuccess}
  onCancel={() => {
    setShowQrisModal(false);
    setMethod("CASH");
  }}
/>
```

> Note: Wrap return dalam fragment `<>...</>` karena sekarang ada 2 root elements.

---

### Fase 3: Settings & Configuration

#### 3.13 [NEW] `src/features/settings/PaymentSettings.tsx`

Form untuk konfigurasi payment gateway:

- Toggle: QRIS enabled/disabled (Switch component)
- Select: Provider (Midtrans / Xendit)
- Input: Server Key (type password, masked)
- Input: Base URL (dengan placeholder sandbox URL)
- Tombol: "Simpan Pengaturan"

Data disimpan via invoke ke backend settings command (bisa gunakan existing `save_settings` atau buat command baru `save_payment_settings`).

---

#### 3.14 [MODIFY] `src/pages/SettingsPage.tsx`

Tambahkan tab baru "Pembayaran" yang merender `PaymentSettings` component. Tab existing: Profil Toko, Struk & Nota, Printer, Diskon.

---

### Fase 5: Security & Hardening

Modul tambahan untuk keamanan dan stabilitas payment integration.

#### 3.17 [NEW] `src-tauri/src/encryption.rs`

Modul enkripsi AES-256-GCM untuk menyimpan API keys secara aman di database.

**Fungsi utama:**

| Fungsi                    | Deskripsi                                                           |
| ------------------------- | ------------------------------------------------------------------- |
| `encrypt(plaintext)`      | Enkripsi string menggunakan AES-256-GCM, return base64              |
| `decrypt(ciphertext_b64)` | Dekripsi base64 kembali ke plaintext                                |
| `get_encryption_key()`    | Derive encryption key dari env var `ENCRYPTION_KEY` atau machine-id |
| `get_machine_id()`        | Ambil machine-specific ID dari `/etc/machine-id` atau hostname      |

**Cara kerja:**

1. Key derivation: coba env var `ENCRYPTION_KEY` dulu, fallback ke `/etc/machine-id`
2. Setiap encrypt menghasilkan random 12-byte nonce (via `OsRng`)
3. Output = base64(nonce + ciphertext) — nonce disimpan bersama ciphertext
4. Decrypt: split nonce (12 bytes pertama) dan ciphertext, lalu decrypt

**Dependencies:** `aes-gcm = "0.10"`, `rand = "0.8"`, `base64` (sudah ada)

**Digunakan oleh:** `payment_cmd.rs` → `save_payment_config()` untuk encrypt server key sebelum simpan ke DB

```rust
use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose, Engine as _};
use rand::RngCore;

pub fn encrypt(plaintext: &str) -> Result<String, String> { /* ... */ }
pub fn decrypt(ciphertext_b64: &str) -> Result<String, String> { /* ... */ }
```

---

#### 3.18 [NEW] `src-tauri/src/audit.rs`

Audit logging untuk semua aksi payment — memanfaatkan tabel `activity_logs` yang sudah ada.

**Komponen:**

| Item                       | Deskripsi                                                                      |
| -------------------------- | ------------------------------------------------------------------------------ |
| `PaymentAuditAction` enum  | `SaveConfig`, `GenerateQR`, `CheckStatus`, `CancelPayment`, `TestConnection`   |
| `log_payment_action()`     | Insert ke `activity_logs` dengan action, description, metadata (JSON)          |
| `get_user_id_from_token()` | Helper extract user_id dari session token                                      |
| `sanitize_error()`         | Sanitize error messages — hide internal details, return user-friendly messages |

**Error sanitization:** Fungsi `sanitize_error()` mengenali pattern error dan mengembalikan pesan user-friendly:

- `"server key" / "credential"` → "Periksa konfigurasi Server Key di Settings."
- `"connection" / "network"` → "Gagal koneksi ke server pembayaran."
- `"database" / "sql"` → "Terjadi kesalahan internal."
- Default → "Terjadi kesalahan. Silakan coba lagi."

```rust
use crate::AppState;
use sqlx::SqlitePool;

pub enum PaymentAuditAction {
    SaveConfig, GenerateQR, CheckStatus, CancelPayment, TestConnection,
}

pub async fn log_payment_action(
    db: &SqlitePool, user_id: Option<i64>,
    action: PaymentAuditAction, description: &str,
    metadata: Option<&serde_json::Value>,
) { /* INSERT INTO activity_logs */ }

pub fn sanitize_error(error: &str, context: &str) -> String { /* ... */ }
```

---

#### 3.19 [NEW] `src-tauri/src/rate_limiter.rs`

Rate limiting dengan sliding window untuk mencegah abuse pada API calls.

**Struktur:**

| Item                   | Deskripsi                                                      |
| ---------------------- | -------------------------------------------------------------- |
| `RateLimiter` struct   | Map: `user_id → (action → RateLimitEntry)`, sliding window     |
| `RateLimiter::check()` | Check apakah request diizinkan, return `Err` jika rate limited |

**Default rate limits (lazy_static):**

| Static                  | Limit       | Window                                |
| ----------------------- | ----------- | ------------------------------------- |
| `GENERATE_QR_LIMIT`     | 10 requests | per 60 detik                          |
| `CHECK_STATUS_LIMIT`    | 30 requests | per 60 detik (karena polling 3 detik) |
| `CANCEL_PAYMENT_LIMIT`  | 5 requests  | per 60 detik                          |
| `TEST_CONNECTION_LIMIT` | 3 requests  | per 60 detik                          |

**Dependencies:** `lazy_static = "1.4"`, `chrono` (sudah ada)

**Digunakan oleh:** Setiap command di `payment_cmd.rs` memanggil `LIMIT.check(user_id, action)` sebelum proses.

```rust
use std::collections::HashMap;
use std::sync::Mutex;
use chrono::{DateTime, Utc, Duration};

pub struct RateLimiter {
    entries: Mutex<HashMap<i64, HashMap<String, RateLimitEntry>>>,
    max_requests: u32,
    window_seconds: i64,
}

lazy_static::lazy_static! {
    pub static ref GENERATE_QR_LIMIT: RateLimiter = RateLimiter::new(10, 60);
    pub static ref CHECK_STATUS_LIMIT: RateLimiter = RateLimiter::new(30, 60);
    pub static ref CANCEL_PAYMENT_LIMIT: RateLimiter = RateLimiter::new(5, 60);
    pub static ref TEST_CONNECTION_LIMIT: RateLimiter = RateLimiter::new(3, 60);
}
```

---

#### 3.20 3 Command Tambahan di `payment_cmd.rs`

Selain 3 command inti (generate, check, cancel), tambahkan 3 command untuk manajemen konfigurasi:

| Command                                                                               | Deskripsi                                                                                                            |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `save_payment_config(qris_enabled, provider, midtrans_server_key, midtrans_base_url)` | Simpan config ke DB. Server Key di-encrypt via `encryption::encrypt()`. Audit log via `audit::log_payment_action()`. |
| `get_payment_config()`                                                                | Ambil config dari DB. Server Key **TIDAK** dikembalikan ke frontend (hanya masked hint).                             |
| `test_payment_connection(server_key, base_url)`                                       | Test koneksi ke Midtrans API. Rate limited via `TEST_CONNECTION_LIMIT`. Return pesan sukses/gagal.                   |

### Fase 4: Environment Configuration

#### 3.15 [NEW] `.env.example`

```env
# Payment Gateway - Midtrans
# Dapatkan Server Key dari https://dashboard.sandbox.midtrans.com
MIDTRANS_SERVER_KEY=SB-Mid-server-xxxxxxxxxxxxx
MIDTRANS_BASE_URL=https://api.sandbox.midtrans.com

# Production (ganti saat deploy):
# MIDTRANS_SERVER_KEY=Mid-server-xxxxxxxxxxxxx
# MIDTRANS_BASE_URL=https://api.midtrans.com
```

#### 3.16 [MODIFY] `.gitignore`

Pastikan `.env` ada di gitignore (untuk keamanan API keys):

```
.env
```

---

## 4. Daftar File yang Diubah (Ringkasan)

### File Modified (9 files):

| #   | File                                   | Perubahan                                                                           |
| --- | -------------------------------------- | ----------------------------------------------------------------------------------- |
| 1   | `src-tauri/Cargo.toml`                 | + dependency `reqwest`, `aes-gcm`, `rand`, `lazy_static`                            |
| 2   | `src-tauri/src/database/migrations.rs` | + kolom `qris_reference`, `payment_status` di transactions; + tabel `qris_payments` |
| 3   | `src-tauri/src/models/transaction.rs`  | + field `qris_reference`, `payment_status` di 2 structs                             |
| 4   | `src-tauri/src/commands/mod.rs`        | + `pub mod payment_cmd`                                                             |
| 5   | `src-tauri/src/lib.rs`                 | + 6 payment commands + 3 module declarations (encryption, audit, rate_limiter)      |
| 6   | `src-tauri/src/models/mod.rs`          | + `pub mod payment`                                                                 |
| 7   | `src/types/index.ts`                   | + 3 type baru (QrisPaymentStatus, QrisPaymentResponse, QrisStatusResponse)          |
| 8   | `src/features/pos/PaymentModal.tsx`    | + QRIS flow intercept, QRISModal integration                                        |
| 9   | `src/pages/SettingsPage.tsx`           | + tab Pembayaran                                                                    |

### File Baru (9 files):

| #   | File                                        | Deskripsi                                        |
| --- | ------------------------------------------- | ------------------------------------------------ |
| 1   | `src-tauri/src/commands/payment_cmd.rs`     | 6 Tauri commands QRIS + config (~528 lines)      |
| 2   | `src-tauri/src/models/payment.rs`           | Structs untuk QRIS data (~60 lines)              |
| 3   | `src-tauri/src/encryption.rs`               | Enkripsi AES-256-GCM untuk API keys (~138 lines) |
| 4   | `src-tauri/src/audit.rs`                    | Audit logging payment actions (~92 lines)        |
| 5   | `src-tauri/src/rate_limiter.rs`             | Rate limiting sliding window (~88 lines)         |
| 6   | `src/features/pos/QRISModal.tsx`            | Modal QR display + countdown (~327 lines)        |
| 7   | `src/hooks/useQrisPayment.ts`               | Polling hook (~70 lines)                         |
| 8   | `src/features/settings/PaymentSettings.tsx` | Settings form payment gateway (~300 lines)       |
| 9   | `.env.example`                              | Template credentials                             |

---

## 5. Keputusan yang Perlu Diambil

> Item berikut memerlukan keputusan dari pemilik proyek sebelum implementasi:

1. **Payment Gateway Provider**: Midtrans (default dalam rencana ini) vs Xendit vs lainnya?
2. **Penyimpanan API Keys**: File `.env` (sederhana, perlu edit manual) vs database settings (bisa konfigurasi dari UI)?
3. **Scope**: Apakah scope berikut sudah tepat?
   - ✅ Termasuk: QRIS payment, polling, cancel, settings UI
   - ❌ Tidak termasuk: Webhook server, refund API, multi-store

---

## 6. Verification Plan

### Build Checks

```bash
# 1. Rust build check
cd src-tauri && cargo check

# 2. Frontend build check
npm run build

# 3. Full dev run
npm run tauri dev
```

### Manual Test Scenarios

| #   | Skenario                                     | Expected Result                        |
| --- | -------------------------------------------- | -------------------------------------- |
| 1   | Generate QR tanpa server key                 | Error message jelas                    |
| 2   | Generate QR dengan sandbox key               | QR code tampil + timer                 |
| 3   | Pembayaran berhasil (via Midtrans simulator) | Auto-detect settlement, buat transaksi |
| 4   | QR expired (tunggu timeout)                  | Status expired, opsi generate ulang    |
| 5   | User cancel saat pending                     | Modal tutup, kembali ke PaymentModal   |
| 6   | Network error saat polling                   | Warning setelah 3x gagal, tidak crash  |
| 7   | Simpan settings payment gateway              | Settings tersimpan, bisa reload        |

---

## 7. Referensi API

### Midtrans QRIS API

**Charge (Create Transaction):**

```
POST https://api.sandbox.midtrans.com/v2/charge
Authorization: Basic BASE64(SERVER_KEY:)
Content-Type: application/json

{
  "payment_type": "qris",
  "transaction_details": {
    "order_id": "QRIS-20260224-abc12345",
    "gross_amount": 50000
  }
}
```

**Check Status:**

```
GET https://api.sandbox.midtrans.com/v2/{ORDER_ID}/status
Authorization: Basic BASE64(SERVER_KEY:)
```

**Cancel:**

```
POST https://api.sandbox.midtrans.com/v2/{ORDER_ID}/cancel
Authorization: Basic BASE64(SERVER_KEY:)
```

### Midtrans Sandbox Simulator

- URL: https://simulator.sandbox.midtrans.com
- Gunakan untuk simulasi pembayaran QRIS saat testing

---

## 8. Catatan Keamanan

1. **API keys TIDAK BOLEH** ada di frontend code atau di-commit ke git
2. Semua komunikasi ke Midtrans dilakukan dari **backend Rust** saja
3. Frontend hanya menerima QR string dan status — tidak pernah melihat server key
4. File `.env` harus ada di `.gitignore`
5. Untuk production, gunakan server key production (bukan sandbox)
