# BLUEPRINT APLIKASI POS KASIR
> **KasirPro** — Point of Sale Desktop Application  
> Tech Stack: **Tauri v2 · Rust · React 18 · TypeScript · SQLite**  
> Versi: `3.0` | Status: `Siap Dieksekusi`

---

## DAFTAR ISI
1. [Project Overview](#1-project-overview)
2. [Sistem Role & Autentikasi](#2-sistem-role--autentikasi)
3. [Arsitektur Sistem](#3-arsitektur-sistem)
4. [Frontend Architecture](#4-frontend-architecture-react--typescript)
5. [Backend Architecture](#5-backend-architecture-rust)
6. [Database Schema](#6-database-schema-sqlite)
7. [Spesifikasi Halaman UI — Lengkap](#7-spesifikasi-halaman-ui--lengkap)
8. [Alur Kerja Detail](#8-alur-kerja-detail-user-flow)
9. [Rencana Eksekusi & Milestone](#9-rencana-eksekusi--milestone)
10. [Panduan untuk Agen AI](#10-panduan-untuk-agen-ai-ai-agent-guidelines)
11. [Checklist Kesiapan Produksi](#11-checklist-kesiapan-produksi)

---

## 1. PROJECT OVERVIEW

### 1.1 Identitas Proyek

| Field | Detail |
|-------|--------|
| **Nama Aplikasi** | KasirPro — Aplikasi POS Desktop |
| **Target Platform** | Windows 10/11, macOS 12+, Linux (Ubuntu 22+) |
| **Paradigma Arsitektur** | Desktop Native via Tauri v2 (Rust + WebView) |
| **Versi Blueprint** | 3.0 — Multi-Role + Settings Lengkap |
| **Database** | SQLite (embedded, tidak perlu server eksternal) |
| **Autentikasi** | Session berbasis token (bcrypt hash + UUID session di memory) |
| **Metode IPC** | Tauri `invoke()` — Frontend ↔ Backend |

### 1.2 Tujuan Aplikasi

- Mengelola transaksi penjualan harian dengan antarmuka kasir yang cepat
- Sistem multi-user dengan **2 role**: **Admin (Pemilik Toko)** dan **Kasir**
- Admin mengontrol penuh: user, produk, laporan, diskon, dan semua pengaturan
- Kasir hanya dapat mengakses fungsi transaksi POS
- Mendukung cetak struk thermal, QRIS, Debit, dan Tunai
- Bekerja **OFFLINE penuh** — tidak bergantung internet

### 1.3 Stack Teknologi Final

| Layer | Teknologi | Keterangan |
|-------|-----------|------------|
| UI Framework | React 18 + TypeScript | SPA di dalam WebView Tauri |
| Styling | Tailwind CSS v3 | Utility-first |
| Komponen UI | shadcn/ui | Radix UI primitives + Tailwind |
| State Global | Zustand v4 | Cart state + Auth session state |
| Routing | TanStack Router v1 | Type-safe, dengan route guard per role |
| IPC Cache | TanStack Query v5 | Cache hasil `invoke()` dari Rust |
| Chart / Grafik | Recharts v2 | Laporan penjualan |
| Ikon | Lucide React | Selaras dengan shadcn/ui |
| Backend Runtime | Rust (stable) | Binary native |
| Framework Desktop | Tauri v2 | Jembatan WebView ↔ Rust |
| Database | SQLite via `sqlx` | Async + compile-time check |
| Password Hashing | `bcrypt` crate | Hash password sebelum disimpan |
| Session Token | `uuid` v4 | Token sesi disimpan di memory Tauri |
| Serialisasi | `serde` + `serde_json` | Struct Rust ↔ JSON |

---

## 2. SISTEM ROLE & AUTENTIKASI

### 2.1 Dua Role Pengguna

| Aspek | ADMIN (Pemilik Toko) | KASIR |
|-------|---------------------|-------|
| **Jumlah akun** | Hanya **1** di seluruh sistem | Tidak terbatas (dibuat oleh Admin) |
| **Dibuat oleh** | Diri sendiri (First-time setup) | Admin via halaman Manage User |
| **Halaman POS** | ✅ Akses penuh | ✅ Akses penuh |
| **Halaman Inventori** | ✅ Tambah/edit/hapus produk | ❌ Tidak ada akses |
| **Halaman Laporan** | ✅ Semua laporan | ❌ Tidak ada akses |
| **Halaman Manage User** | ✅ Buat, edit, nonaktifkan kasir | ❌ Tidak ada akses |
| **Halaman Settings** | ✅ Semua pengaturan | ❌ Tidak ada akses |
| **Void Transaksi** | ✅ | ❌ (harus minta Admin) |
| **Ringkasan Shift** | ✅ | ✅ Hanya ringkasan shift sendiri |

### 2.2 Logika First-Time Setup

```
[Aplikasi Dibuka Pertama Kali]
        │
        ▼
  Cek tabel users → ada role ADMIN?
        │
        ├─ TIDAK (belum ada admin)
        │       │
        │       ▼
        │  LoginPage: tampilkan tombol [Buat Akun Admin]
        │       │ Klik
        │       ▼
        │  FirstSetupPage → isi form → create_admin()
        │       │ Sukses
        │       ▼
        │  Redirect ke LoginPage (tombol [Buat Akun] HILANG SELAMANYA)
        │
        └─ YA (admin sudah ada)
                │
                ▼
          LoginPage Normal — tidak ada tombol buat akun
```

### 2.3 Mekanisme Sesi Login

- Setelah login berhasil, Rust membuat **session token** (UUID v4) dan menyimpannya di `SessionStore` di memory `AppState` (bukan database)
- Token dikirim ke Frontend dan disimpan di `authStore` Zustand
- Setiap `invoke()` sensitif **wajib** menyertakan `session_token`
- Rust memvalidasi token + role sebelum menjalankan logic apapun
- Sesi **tidak persisten** — kasir harus login ulang setiap buka aplikasi
- **Auto-expire:** sesi habis otomatis setelah **8 jam**

### 2.4 Route Guard — Akses per Role

```typescript
// src/router.ts

// Public routes (tidak perlu login)
loginRoute          → /login
firstSetupRoute     → /first-setup  (redirect ke /login jika admin sudah ada)

// Protected — semua role (redirect ke /login jika belum login)
posRoute            → /pos

// Protected — Admin only (redirect ke /pos jika role KASIR)
inventoryRoute      → /inventory
reportsRoute        → /reports
manageUsersRoute    → /users
settingsRoute       → /settings
```

---

## 3. ARSITEKTUR SISTEM

### 3.1 Pola Komunikasi IPC

Seluruh komunikasi Frontend → Backend **WAJIB** via `invoke()`. Frontend **TIDAK BOLEH** langsung akses database atau filesystem.

```
[React Component]
      │
      │  invoke('nama_command', { session_token, ...payload })
      ▼
[Tauri Bridge]
      │
[Rust Command]
      │
      ├─ 1. Validasi session_token (ada & belum expired?)
      ├─ 2. Validasi role (punya izin untuk command ini?)
      ├─ 3. Validasi input payload
      ├─ 4. Eksekusi logika bisnis + query SQLite
      └─ 5. Return Result<T, String>
             │
             ▼
      [React] — terima data JSON atau string error
```

### 3.2 Aturan Wajib Arsitektur

| Aturan | Detail |
|--------|--------|
| **Auth di setiap command** | Setiap command sensitif terima `session_token` dan validasi di baris pertama |
| **Kalkulasi UI** | Hitung subtotal, total, kembalian di Frontend (Zustand) untuk responsivitas |
| **Validasi Backend** | Re-validasi semua angka di Rust sebelum `INSERT` |
| **Error Handling** | Setiap `#[tauri::command]` WAJIB return `Result<T, String>` |
| **No Direct DB** | Frontend dilarang mengakses SQLite langsung |
| **Async First** | Semua Rust command `async fn` |
| **Password** | TIDAK PERNAH simpan plaintext — selalu hash dengan bcrypt cost 12 |

---

## 4. FRONTEND ARCHITECTURE (React + TypeScript)

### 4.1 Struktur Folder Lengkap

```
src/
├── assets/
├── components/
│   ├── ui/                         # Auto-generated shadcn/ui
│   ├── DataTable.tsx
│   ├── ConfirmDialog.tsx
│   ├── CurrencyDisplay.tsx
│   └── RoleBadge.tsx               # Badge ADMIN / KASIR
│
├── features/
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   ├── FirstSetupForm.tsx
│   │   └── ChangePasswordForm.tsx
│   ├── pos/
│   │   ├── ProductGrid.tsx
│   │   ├── CartPanel.tsx
│   │   ├── PaymentModal.tsx
│   │   ├── NumpadInput.tsx
│   │   └── DiscountModal.tsx       # Pilih diskon dari DB atau input manual
│   ├── inventory/
│   │   ├── ProductForm.tsx
│   │   ├── StockAdjust.tsx
│   │   └── CategoryManager.tsx
│   ├── users/
│   │   ├── UserTable.tsx
│   │   ├── UserForm.tsx
│   │   └── UserStatusToggle.tsx
│   ├── reports/
│   │   ├── SalesChart.tsx
│   │   ├── TopProducts.tsx
│   │   └── ShiftSummary.tsx
│   └── settings/
│       ├── CompanyProfileForm.tsx
│       ├── ReceiptSettings.tsx
│       ├── DiscountSettings.tsx
│       ├── TaxSettings.tsx
│       └── PrinterSettings.tsx
│
├── hooks/
│   ├── useInvokeQuery.ts
│   ├── useBarcodeScanner.ts
│   └── useSession.ts
│
├── lib/
│   ├── currency.ts                 # formatRupiah(), parseCurrency()
│   ├── tauri.ts                    # Typed invoke wrapper (semua sertakan sessionToken)
│   └── utils.ts
│
├── pages/
│   ├── LoginPage.tsx               # Conditional tombol buat akun
│   ├── FirstSetupPage.tsx
│   ├── POSPage.tsx
│   ├── InventoryPage.tsx           # Admin only
│   ├── ReportsPage.tsx             # Admin only
│   ├── ManageUsersPage.tsx         # Admin only
│   └── SettingsPage.tsx            # Admin only
│
├── store/
│   ├── authStore.ts                # Session user login
│   ├── cartStore.ts
│   └── settingsStore.ts            # Cache settings toko
│
├── types/
│   └── index.ts
│
├── router.ts
└── App.tsx
```

### 4.2 Auth Store

**File:** `src/store/authStore.ts`

```typescript
export type Role = 'ADMIN' | 'KASIR';

export interface AuthUser {
  id: number;
  name: string;
  username: string;
  role: Role;
  sessionToken: string;
  loginAt: string;
}

interface AuthStore {
  user: AuthUser | null;
  isAuthenticated: boolean;
  setUser: (user: AuthUser) => void;
  logout: () => void;
  isAdmin: () => boolean;
  getToken: () => string | null;
}

// Implementasi Zustand:
// isAdmin: () => get().user?.role === 'ADMIN'
// getToken: () => get().user?.sessionToken ?? null
// logout: () => { set({ user: null, isAuthenticated: false }); invoke('logout', {sessionToken}) }
```

### 4.3 TypeScript Types Lengkap

**File:** `src/types/index.ts`

```typescript
// ── Auth & User ───────────────────────────────
export type Role = 'ADMIN' | 'KASIR';

export interface User {
  id: number;
  name: string;
  username: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface LoginResult {
  user: Pick<User, 'id' | 'name' | 'username' | 'role'>;
  sessionToken: string;
  loginAt: string;
}

export interface CreateUserPayload {
  name: string;
  username: string;
  password: string;
  role: Role; // Admin tidak bisa buat Admin baru via UI — selalu KASIR
}

// ── Product ───────────────────────────────────
export interface Product {
  id: number;
  categoryId: number | null;
  categoryName: string | null;
  sku: string | null;
  name: string;
  price: number;
  stock: number;
  barcode: string | null;
  isActive: boolean;
}

export interface Category {
  id: number;
  name: string;
  productCount: number;
}

// ── Discount ──────────────────────────────────
export type DiscountType = 'NOMINAL' | 'PERCENT';

export interface Discount {
  id: number;
  name: string;
  type: DiscountType;
  value: number;        // Rp atau %
  minPurchase: number;
  isActive: boolean;
}

// ── Transaction ───────────────────────────────
export interface Transaction {
  id: string;           // UUID v4
  cashierId: number;
  cashierName: string;
  timestamp: string;
  totalAmount: number;
  discountId: number | null;
  discountName: string | null;
  discountAmount: number;
  taxAmount: number;
  paymentMethod: 'CASH' | 'DEBIT' | 'QRIS';
  amountPaid: number;
  changeGiven: number;
  status: 'COMPLETED' | 'VOID';
  voidedByName: string | null;
  voidedAt: string | null;
  notes: string | null;
}

export interface CreateTransactionPayload {
  items: { productId: number; quantity: number; priceAtTime: number }[];
  totalAmount: number;
  discountId: number | null;
  discountAmount: number;
  taxAmount: number;
  paymentMethod: 'CASH' | 'DEBIT' | 'QRIS';
  amountPaid: number;
  notes?: string;
}

// ── Settings ──────────────────────────────────
export interface CompanyProfile {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  storeEmail: string;
  storeWebsite: string;
  logoPath: string | null;
  taxNumber: string;        // NPWP
}

export interface ReceiptSettings {
  showLogo: boolean;
  headerText: string;       // Teks kustom di atas struk
  footerText: string;       // Teks kustom di bawah struk
  showCashierName: boolean;
  showTaxDetail: boolean;
  showDiscountDetail: boolean;
  paperWidth: '58mm' | '80mm';
  copies: 1 | 2;
}

export interface TaxSettings {
  isEnabled: boolean;
  rate: number;             // Persen, contoh: 11
  label: string;            // "PPN", "Pajak Layanan"
  isIncluded: boolean;      // true = inclusive (harga sudah termasuk pajak)
}

export interface AppSettings {
  company: CompanyProfile;
  receipt: ReceiptSettings;
  tax: TaxSettings;
  lowStockThreshold: number;
  printerPort: string;
  timezone: string;
}

// ── Reports ───────────────────────────────────
export interface DailyReport {
  date: string;
  totalRevenue: number;
  transactionCount: number;
  averageTransaction: number;
  totalItemsSold: number;
  cashTotal: number;
  debitTotal: number;
  qrisTotal: number;
  voidCount: number;
}

export interface ProductStat {
  productId: number;
  name: string;
  totalSold: number;
  totalRevenue: number;
}

export interface ShiftSummary {
  cashierName: string;
  loginAt: string;
  transactionCount: number;
  totalRevenue: number;
}
```

---

## 5. BACKEND ARCHITECTURE (Rust)

### 5.1 `Cargo.toml` — Dependensi Wajib

```toml
[dependencies]
tauri         = { version = "2", features = [] }
sqlx          = { version = "0.7", features = ["sqlite", "runtime-tokio", "chrono", "uuid"] }
serde         = { version = "1", features = ["derive"] }
serde_json    = "1"
tokio         = { version = "1", features = ["full"] }
uuid          = { version = "1", features = ["v4"] }
chrono        = { version = "0.4", features = ["serde"] }
bcrypt        = "0.15"
thiserror     = "1"
```

### 5.2 Struktur Folder Backend

```
src-tauri/src/
├── database/
│   ├── mod.rs
│   ├── connection.rs
│   └── migrations.rs
├── models/
│   ├── mod.rs
│   ├── user.rs
│   ├── product.rs
│   ├── transaction.rs
│   ├── discount.rs
│   └── settings.rs
├── commands/
│   ├── mod.rs
│   ├── auth_cmd.rs          # check_first_run, create_admin, login, logout
│   ├── user_cmd.rs          # CRUD user (Admin only)
│   ├── product_cmd.rs       # CRUD produk + kategori
│   ├── discount_cmd.rs      # CRUD diskon (Admin only)
│   ├── transaction_cmd.rs   # Buat & void transaksi
│   ├── report_cmd.rs        # Laporan & statistik
│   └── settings_cmd.rs      # Get/save settings, print
├── auth/
│   ├── mod.rs
│   ├── session.rs           # SessionStore — HashMap di memory
│   └── guard.rs             # validate_session(), validate_admin()
├── errors.rs
└── main.rs
```

### 5.3 Session Store (Rust — In Memory)

```rust
// src-tauri/src/auth/session.rs

use std::collections::HashMap;
use chrono::{DateTime, Utc, Duration};

#[derive(Clone, Debug)]
pub struct SessionData {
    pub user_id: i64,
    pub username: String,
    pub role: String,              // "ADMIN" | "KASIR"
    pub expires_at: DateTime<Utc>,
}

pub struct SessionStore {
    sessions: HashMap<String, SessionData>,
}

impl SessionStore {
    pub fn new() -> Self { Self { sessions: HashMap::new() } }

    pub fn create(&mut self, user_id: i64, username: String, role: String) -> String {
        let token = uuid::Uuid::new_v4().to_string();
        self.sessions.insert(token.clone(), SessionData {
            user_id, username, role,
            expires_at: Utc::now() + Duration::hours(8),
        });
        token
    }

    pub fn validate(&self, token: &str) -> Result<&SessionData, String> {
        match self.sessions.get(token) {
            None    => Err("Sesi tidak valid, silakan login ulang".into()),
            Some(s) if Utc::now() > s.expires_at => Err("Sesi expired, silakan login ulang".into()),
            Some(s) => Ok(s),
        }
    }

    pub fn validate_admin(&self, token: &str) -> Result<&SessionData, String> {
        let s = self.validate(token)?;
        if s.role != "ADMIN" {
            return Err("Akses ditolak: hanya Admin yang bisa melakukan ini".into());
        }
        Ok(s)
    }

    pub fn destroy(&mut self, token: &str) { self.sessions.remove(token); }
}
```

### 5.4 AppState & main.rs

```rust
// src-tauri/src/main.rs

pub struct AppState {
    pub db: sqlx::SqlitePool,
    pub sessions: std::sync::Mutex<SessionStore>,
}

#[tokio::main]
async fn main() {
    let pool = database::connection::init_db().await.expect("DB init gagal");

    tauri::Builder::default()
        .manage(AppState {
            db: pool,
            sessions: std::sync::Mutex::new(SessionStore::new()),
        })
        .invoke_handler(tauri::generate_handler![
            // Auth
            commands::auth_cmd::check_first_run,
            commands::auth_cmd::create_admin,
            commands::auth_cmd::login,
            commands::auth_cmd::logout,
            commands::auth_cmd::check_session,
            // User Management
            commands::user_cmd::get_all_users,
            commands::user_cmd::create_user,
            commands::user_cmd::update_user,
            commands::user_cmd::toggle_user_status,
            commands::user_cmd::reset_user_password,
            // Products
            commands::product_cmd::get_products,
            commands::product_cmd::get_product_by_barcode,
            commands::product_cmd::create_product,
            commands::product_cmd::update_product,
            commands::product_cmd::delete_product,
            commands::product_cmd::adjust_stock,
            commands::product_cmd::get_categories,
            commands::product_cmd::create_category,
            // Discounts
            commands::discount_cmd::get_discounts,
            commands::discount_cmd::create_discount,
            commands::discount_cmd::update_discount,
            commands::discount_cmd::toggle_discount,
            // Transactions
            commands::transaction_cmd::create_transaction,
            commands::transaction_cmd::void_transaction,
            commands::transaction_cmd::get_transactions,
            commands::transaction_cmd::get_transaction_detail,
            // Reports
            commands::report_cmd::get_daily_report,
            commands::report_cmd::get_sales_chart,
            commands::report_cmd::get_top_products,
            commands::report_cmd::get_shift_summary,
            // Settings
            commands::settings_cmd::get_settings,
            commands::settings_cmd::save_settings,
            commands::settings_cmd::save_logo,
            commands::settings_cmd::print_receipt,
            commands::settings_cmd::test_print,
        ])
        .run(tauri::generate_context!())
        .expect("Gagal menjalankan aplikasi");
}
```

### 5.5 Daftar Tauri Commands — Kontrak API Lengkap

| Command Name | Token? | Role | Parameter | Return |
|---|---|---|---|---|
| `check_first_run` | ❌ | — | *(none)* | `Result<bool, String>` |
| `create_admin` | ❌ | — | `name, username, password` | `Result<(), String>` |
| `login` | ❌ | — | `username, password` | `Result<LoginResult, String>` |
| `logout` | ✅ | Semua | `session_token` | `Result<(), String>` |
| `check_session` | ✅ | Semua | `session_token` | `Result<AuthUser, String>` |
| `get_all_users` | ✅ | Admin | `session_token` | `Result<Vec<User>, String>` |
| `create_user` | ✅ | Admin | `session_token, payload` | `Result<User, String>` |
| `update_user` | ✅ | Admin | `session_token, id, payload` | `Result<User, String>` |
| `toggle_user_status` | ✅ | Admin | `session_token, user_id` | `Result<bool, String>` |
| `reset_user_password` | ✅ | Admin | `session_token, user_id, new_password` | `Result<(), String>` |
| `get_products` | ✅ | Semua | `session_token, query?, category_id?` | `Result<Vec<Product>, String>` |
| `get_product_by_barcode` | ✅ | Semua | `session_token, barcode` | `Result<Product, String>` |
| `create_product` | ✅ | Admin | `session_token, payload` | `Result<Product, String>` |
| `update_product` | ✅ | Admin | `session_token, id, payload` | `Result<Product, String>` |
| `delete_product` | ✅ | Admin | `session_token, id` | `Result<(), String>` |
| `adjust_stock` | ✅ | Admin | `session_token, product_id, delta` | `Result<i64, String>` |
| `get_categories` | ✅ | Semua | `session_token` | `Result<Vec<Category>, String>` |
| `create_category` | ✅ | Admin | `session_token, name` | `Result<Category, String>` |
| `get_discounts` | ✅ | Semua | `session_token` | `Result<Vec<Discount>, String>` |
| `create_discount` | ✅ | Admin | `session_token, payload` | `Result<Discount, String>` |
| `update_discount` | ✅ | Admin | `session_token, id, payload` | `Result<Discount, String>` |
| `toggle_discount` | ✅ | Admin | `session_token, id` | `Result<bool, String>` |
| `create_transaction` | ✅ | Semua | `session_token, payload` | `Result<Transaction, String>` |
| `void_transaction` | ✅ | **Admin** | `session_token, transaction_id` | `Result<(), String>` |
| `get_transactions` | ✅ | Semua* | `session_token, date?, page` | `Result<Paginated<Transaction>, String>` |
| `get_transaction_detail` | ✅ | Semua | `session_token, transaction_id` | `Result<TransactionDetail, String>` |
| `get_daily_report` | ✅ | Admin | `session_token, date` | `Result<DailyReport, String>` |
| `get_sales_chart` | ✅ | Admin | `session_token, start, end` | `Result<Vec<ChartPoint>, String>` |
| `get_top_products` | ✅ | Admin | `session_token, start, end, limit` | `Result<Vec<ProductStat>, String>` |
| `get_shift_summary` | ✅ | Semua | `session_token` | `Result<ShiftSummary, String>` |
| `get_settings` | ✅ | Admin | `session_token` | `Result<AppSettings, String>` |
| `save_settings` | ✅ | Admin | `session_token, payload` | `Result<(), String>` |
| `save_logo` | ✅ | Admin | `session_token, file_path` | `Result<String, String>` |
| `print_receipt` | ✅ | Semua | `session_token, transaction_id` | `Result<(), String>` |
| `test_print` | ✅ | Admin | `session_token` | `Result<(), String>` |

> *Kasir hanya bisa lihat transaksi milik shift-nya sendiri. Admin lihat semua.

### 5.6 Contoh Implementasi Auth Command

```rust
// src-tauri/src/commands/auth_cmd.rs

#[tauri::command]
pub async fn check_first_run(state: tauri::State<'_, AppState>) -> Result<bool, String> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users WHERE role = 'ADMIN'")
        .fetch_one(&state.db).await.map_err(|e| e.to_string())?;
    Ok(count == 0)
}

#[tauri::command]
pub async fn create_admin(
    state: tauri::State<'_, AppState>,
    name: String, username: String, password: String,
) -> Result<(), String> {
    // Pastikan admin belum ada (prevent exploit)
    let exists: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users WHERE role = 'ADMIN'")
        .fetch_one(&state.db).await.map_err(|e| e.to_string())?;
    if exists > 0 { return Err("Admin sudah ada".into()); }

    let hashed = bcrypt::hash(&password, 12).map_err(|e| e.to_string())?;
    sqlx::query("INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, 'ADMIN')")
        .bind(&name).bind(&username).bind(&hashed)
        .execute(&state.db).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn login(
    state: tauri::State<'_, AppState>,
    username: String, password: String,
) -> Result<LoginResult, String> {
    let user = sqlx::query_as::<_, DbUser>(
        "SELECT * FROM users WHERE username = ? AND is_active = 1"
    )
    .bind(&username).fetch_optional(&state.db).await
    .map_err(|e| e.to_string())?
    .ok_or("Username tidak ditemukan atau akun tidak aktif")?;

    let valid = bcrypt::verify(&password, &user.password_hash)
        .map_err(|_| "Gagal verifikasi")?;
    if !valid { return Err("Password salah".into()); }

    // Catat last login
    sqlx::query("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(user.id).execute(&state.db).await.ok();

    let token = state.sessions.lock().unwrap()
        .create(user.id, user.username.clone(), user.role.clone());

    Ok(LoginResult {
        user: AuthUserData { id: user.id, name: user.name, username: user.username, role: user.role },
        session_token: token,
        login_at: chrono::Utc::now().to_rfc3339(),
    })
}
```

---

## 6. DATABASE SCHEMA (SQLite)

### 6.1 Schema Lengkap

```sql
-- ═══════════════════════════════════════
-- TABLE: users
-- ═══════════════════════════════════════
CREATE TABLE IF NOT EXISTS users (
    id              INTEGER  PRIMARY KEY AUTOINCREMENT,
    name            TEXT     NOT NULL,
    username        TEXT     NOT NULL UNIQUE,
    password_hash   TEXT     NOT NULL,
    role            TEXT     NOT NULL CHECK(role IN ('ADMIN', 'KASIR')),
    is_active       INTEGER  NOT NULL DEFAULT 1,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by      INTEGER  REFERENCES users(id) ON DELETE SET NULL,
    last_login_at   DATETIME
);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- ═══════════════════════════════════════
-- TABLE: categories
-- ═══════════════════════════════════════
CREATE TABLE IF NOT EXISTS categories (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT    NOT NULL UNIQUE
);

-- ═══════════════════════════════════════
-- TABLE: products
-- ═══════════════════════════════════════
CREATE TABLE IF NOT EXISTS products (
    id          INTEGER  PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER  REFERENCES categories(id) ON DELETE SET NULL,
    sku         TEXT     UNIQUE,
    name        TEXT     NOT NULL,
    price       REAL     NOT NULL CHECK(price >= 0),
    stock       INTEGER  NOT NULL DEFAULT 0 CHECK(stock >= 0),
    barcode     TEXT     UNIQUE,
    is_active   INTEGER  NOT NULL DEFAULT 1,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_name    ON products(name);

-- ═══════════════════════════════════════
-- TABLE: discounts
-- ═══════════════════════════════════════
CREATE TABLE IF NOT EXISTS discounts (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT    NOT NULL,
    type         TEXT    NOT NULL CHECK(type IN ('NOMINAL', 'PERCENT')),
    value        REAL    NOT NULL CHECK(value > 0),
    min_purchase REAL    NOT NULL DEFAULT 0,
    is_active    INTEGER NOT NULL DEFAULT 1,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ═══════════════════════════════════════
-- TABLE: transactions
-- ═══════════════════════════════════════
CREATE TABLE IF NOT EXISTS transactions (
    id               TEXT    PRIMARY KEY,   -- UUID v4
    cashier_id       INTEGER NOT NULL REFERENCES users(id),
    timestamp        DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_amount     REAL    NOT NULL CHECK(total_amount >= 0),
    discount_id      INTEGER REFERENCES discounts(id) ON DELETE SET NULL,
    discount_amount  REAL    NOT NULL DEFAULT 0,
    tax_amount       REAL    NOT NULL DEFAULT 0,
    payment_method   TEXT    NOT NULL CHECK(payment_method IN ('CASH', 'DEBIT', 'QRIS')),
    amount_paid      REAL    NOT NULL,
    change_given     REAL    NOT NULL DEFAULT 0,
    status           TEXT    NOT NULL DEFAULT 'COMPLETED'
                     CHECK(status IN ('COMPLETED', 'VOID')),
    voided_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,
    voided_at        DATETIME,
    notes            TEXT
);
CREATE INDEX IF NOT EXISTS idx_transactions_cashier   ON transactions(cashier_id);
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp);
CREATE INDEX IF NOT EXISTS idx_transactions_status    ON transactions(status);

-- ═══════════════════════════════════════
-- TABLE: transaction_items
-- ═══════════════════════════════════════
CREATE TABLE IF NOT EXISTS transaction_items (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id TEXT    NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    product_id     INTEGER NOT NULL REFERENCES products(id),
    quantity       INTEGER NOT NULL CHECK(quantity > 0),
    price_at_time  REAL    NOT NULL,  -- Snapshot harga saat transaksi
    subtotal       REAL    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tx_items_transaction ON transaction_items(transaction_id);

-- ═══════════════════════════════════════
-- TABLE: settings (key-value store)
-- ═══════════════════════════════════════
CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Seed default (OR IGNORE = tidak timpa jika sudah ada)
-- Company Profile
INSERT OR IGNORE INTO settings VALUES ('company.store_name',    'Toko Saya');
INSERT OR IGNORE INTO settings VALUES ('company.address',       '');
INSERT OR IGNORE INTO settings VALUES ('company.phone',         '');
INSERT OR IGNORE INTO settings VALUES ('company.email',         '');
INSERT OR IGNORE INTO settings VALUES ('company.website',       '');
INSERT OR IGNORE INTO settings VALUES ('company.logo_path',     '');
INSERT OR IGNORE INTO settings VALUES ('company.tax_number',    '');
-- Receipt
INSERT OR IGNORE INTO settings VALUES ('receipt.show_logo',           '1');
INSERT OR IGNORE INTO settings VALUES ('receipt.header_text',         '');
INSERT OR IGNORE INTO settings VALUES ('receipt.footer_text',         'Terima kasih telah berbelanja!');
INSERT OR IGNORE INTO settings VALUES ('receipt.show_cashier_name',   '1');
INSERT OR IGNORE INTO settings VALUES ('receipt.show_tax_detail',     '1');
INSERT OR IGNORE INTO settings VALUES ('receipt.show_discount_detail','1');
INSERT OR IGNORE INTO settings VALUES ('receipt.paper_width',         '80mm');
INSERT OR IGNORE INTO settings VALUES ('receipt.copies',              '1');
-- Tax
INSERT OR IGNORE INTO settings VALUES ('tax.is_enabled',  '0');
INSERT OR IGNORE INTO settings VALUES ('tax.rate',        '11');
INSERT OR IGNORE INTO settings VALUES ('tax.label',       'PPN');
INSERT OR IGNORE INTO settings VALUES ('tax.is_included', '0');
-- App
INSERT OR IGNORE INTO settings VALUES ('app.low_stock_threshold', '5');
INSERT OR IGNORE INTO settings VALUES ('app.printer_port',        '');
INSERT OR IGNORE INTO settings VALUES ('app.timezone',            'Asia/Jakarta');
```

---

## 7. SPESIFIKASI HALAMAN UI — LENGKAP

### 7.1 `LoginPage.tsx`

**Logika kondisional saat mount:**
```
invoke('check_first_run')
  ├─ true  → tampilkan tombol [Buat Akun Admin] → navigasi ke /first-setup
  └─ false → tombol TIDAK DITAMPILKAN sama sekali
```

| Elemen | Spesifikasi |
|--------|-------------|
| **Header** | Logo aplikasi + nama toko (dari settings jika ada) |
| **Form** | Input `Username` + Input `Password` + tombol **[Masuk]** |
| **Tombol Buat Akun** | Hanya render jika `isFirstRun === true` |
| **Error State** | Pesan di bawah form: "Password salah" / "Akun tidak aktif" |
| **Loading** | Tombol [Masuk] → spinner saat proses |
| **Footer** | "KasirPro v3.0" |

### 7.2 `FirstSetupPage.tsx`

> Guard: redirect ke `/login` jika `check_first_run === false`

| Elemen | Spesifikasi |
|--------|-------------|
| **Judul** | "Selamat Datang! Buat Akun Admin Pertama" |
| **Deskripsi** | "Akun ini akan menjadi pemilik toko dengan akses penuh." |
| **Form** | Nama Lengkap · Username (min 4 char, alphanumeric) · Password (min 8 char) · Konfirmasi Password |
| **Validasi** | Password match, username unik, tidak ada spasi |
| **Submit** | [Buat Akun & Mulai] → `create_admin()` → redirect `/login` |

### 7.3 `ManageUsersPage.tsx` *(Admin Only)*

| Elemen | Spesifikasi |
|--------|-------------|
| **Header** | "Kelola Pengguna" + tombol **[+ Tambah Kasir]** |
| **Filter** | Dropdown: Semua / Aktif / Nonaktif |
| **Tabel** | Kolom: Nama · Username · Role (badge) · Status · Login Terakhir · Aksi |
| **Aksi per baris** | [Edit] · [Reset Password] · [Nonaktifkan / Aktifkan] |
| **UserForm** | Modal: Nama, Username, Password (hanya saat buat baru). Role = KASIR (fixed) |
| **Reset Password** | Modal: input password baru + konfirmasi. Tidak perlu password lama |
| **Toggle Status** | ConfirmDialog: "Kasir tidak bisa login sampai diaktifkan kembali" |
| **Proteksi** | Akun Admin sendiri tidak tampil tombol edit/nonaktifkan |

### 7.4 `POSPage.tsx` *(Semua Role)*

| Elemen | Spesifikasi |
|--------|-------------|
| **Navbar** | Nama toko · Nama + role kasir · Ringkasan shift · [Logout] |
| **Layout** | Kiri: `ProductGrid` 60% · Kanan: `CartPanel` 40% |
| **ProductGrid** | Grid 3–4 col, search bar, filter kategori (tab horizontal) |
| **CartPanel** | Daftar item + `+`/`-` qty · hapus item · tombol **[Diskon]** |
| **DiscountModal** | List diskon aktif dari DB + opsi input manual nominal/persen |
| **Footer Cart** | Subtotal · Diskon · Pajak · **Total** · tombol **[BAYAR]** (disabled jika cart kosong) |
| **PaymentModal** | Pilih CASH/DEBIT/QRIS · Input nominal · Display kembalian real-time · [Proses] |
| **Barcode Input** | `<input>` tersembunyi selalu fokus — tangkap USB HID scanner |

### 7.5 `InventoryPage.tsx` *(Admin Only)*

| Elemen | Spesifikasi |
|--------|-------------|
| **Toolbar** | Search · Filter Kategori · Filter Status · [+ Produk] · [Kelola Kategori] |
| **DataTable** | Kolom: Nama · SKU · Kategori · Harga · Stok (merah jika low) · Status · Aksi |
| **ProductForm** | Sheet kanan: Nama* · SKU · Barcode · Kategori · Harga* · Stok Awal · Toggle Aktif |
| **StockAdjust** | Modal: Tambah (+) / Kurangi (-) · Jumlah · Keterangan |
| **CategoryManager** | Modal: daftar kategori + tambah / hapus (hapus disabled jika ada produk) |
| **Nonaktifkan** | Toggle `is_active` — produk tidak muncul di POS, histori tetap ada |
| **Low Stock Alert** | Badge merah di navbar jika ada produk stok < threshold |

### 7.6 `ReportsPage.tsx` *(Admin Only)*

| Elemen | Spesifikasi |
|--------|-------------|
| **Date Picker** | Cepat: Hari ini · 7 hari · 30 hari · Bulan ini · Custom range |
| **Summary Cards** | Total Pendapatan · Jumlah Transaksi · Rata-rata per Transaksi · Item Terjual · Total Void · Breakdown CASH/DEBIT/QRIS |
| **SalesChart** | Bar Chart pendapatan per hari |
| **PaymentChart** | Pie Chart proporsi metode bayar |
| **TopProducts** | Bar Chart horizontal + tabel: 10 produk terlaris |
| **Transaction List** | Tabel: ID · Kasir · Waktu · Total · Metode · Status (badge VOID merah) |
| **Detail** | Sheet/Modal: rincian item · info kasir · [Cetak Ulang] · (Admin: [VOID]) |

### 7.7 `SettingsPage.tsx` *(Admin Only)*

Navigasi menggunakan tab vertikal (sidebar kiri) atau tab horizontal.

#### Tab 1: Profil Perusahaan

| Field | Keterangan |
|-------|-----------|
| **Logo Toko** | Upload PNG/JPG (max 2MB) + preview — tampil di struk |
| **Nama Toko*** | Tampil di LoginPage, struk, dan navbar |
| **Alamat** | Textarea — tampil di struk |
| **No. Telepon** | Input tel |
| **Email** | Input email |
| **Website** | Input URL |
| **NPWP** | Tampil di struk jika diisi |
| **[Simpan Profil]** | Tombol submit |

#### Tab 2: Pengaturan Struk

| Field | Keterangan |
|-------|-----------|
| **Tampilkan Logo** | Toggle |
| **Teks Header** | Textarea — teks di atas struk (promosi, slogan) |
| **Teks Footer** | Textarea — ucapan terima kasih, media sosial, dll |
| **Tampilkan Nama Kasir** | Toggle |
| **Tampilkan Rincian Pajak** | Toggle |
| **Tampilkan Rincian Diskon** | Toggle |
| **Lebar Kertas** | Radio: `58mm` / `80mm` |
| **Jumlah Salinan** | Dropdown: 1 / 2 |
| **[Preview Struk]** | Tampilkan preview modal sesuai pengaturan |
| **[Cetak Test]** | Kirim test print ke printer |

#### Tab 3: Diskon

| Elemen | Keterangan |
|--------|-----------|
| **Tabel Diskon** | Nama · Tipe · Nilai · Min. Beli · Status (badge) · Aksi |
| **Form Tambah/Edit** | Nama* · Tipe (Nominal/Persen) · Nilai* · Minimum Pembelian · Toggle Aktif |
| **Hapus** | Disabled jika diskon pernah digunakan di transaksi (hanya bisa nonaktifkan) |

#### Tab 4: Pajak

| Field | Keterangan |
|-------|-----------|
| **Aktifkan Pajak** | Toggle master |
| **Label** | "PPN", "Pajak Layanan", dll |
| **Tarif (%)** | Input number — contoh: `11` untuk PPN 11% |
| **Harga Sudah Termasuk Pajak** | Toggle: inclusive vs exclusive |
| **Preview Kalkulasi** | Teks otomatis: "Produk Rp 100.000 → Pajak Rp 11.000 → Total Rp 111.000" |

#### Tab 5: Printer

| Field | Keterangan |
|-------|-----------|
| **Port Printer** | Dropdown port tersedia (di-detect Rust) |
| **Status Koneksi** | Indikator ● Terhubung / ● Tidak Terhubung |
| **[Cetak Test]** | Validasi koneksi printer |

#### Tab 6: Aplikasi

| Field | Keterangan |
|-------|-----------|
| **Threshold Stok Rendah** | Input number — alert muncul jika stok < nilai ini |
| **Zona Waktu** | Dropdown: WIB / WITA / WIT |
| **Versi Aplikasi** | Read-only info |
| **[Ganti Password]** | Buka modal ganti password Admin sendiri |

---

## 8. ALUR KERJA DETAIL (User Flow)

### 8.1 First-Time Setup

```
[Buka Aplikasi]
      ▼
check_first_run() → true
      ▼
LoginPage → klik [Buat Akun Admin]
      ▼
FirstSetupPage → isi form → submit
      ▼
create_admin() sukses
      ▼
Redirect ke LoginPage (tombol buat akun TIDAK PERNAH muncul lagi)
      ▼
Login dengan akun admin yang baru dibuat → masuk ke /inventory
```

### 8.2 Login & Routing per Role

```
Submit LoginForm
      ▼
invoke('login', { username, password })
      ├── Error → tampil pesan di form
      └── Sukses → simpan user + token di authStore
                        ├── role ADMIN → redirect /inventory
                        └── role KASIR → redirect /pos
```

### 8.3 Transaksi dengan Diskon

```
1. Kasir tambah produk ke cart
2. Klik [Diskon] di CartPanel
3. DiscountModal:
   ├─ Pilih dari list diskon aktif (invoke('get_discounts'))
   └─ Atau input manual nominal/persen
4. Diskon diterapkan → cartStore.setDiscount()
5. Total update real-time → lanjut proses bayar
```

### 8.4 Alur Transaksi Penuh

```
1.  Kasir scan/klik produk → cartStore.addItem()
2.  Atur qty, terapkan diskon
3.  Klik [BAYAR] → PaymentModal
4.  Pilih metode, input nominal
5.  Klik [Proses] → validasi lokal
6.  invoke('create_transaction', { session_token, payload })
        ▼
7.  Rust: validate session → re-kalkulasi total
8.  Rust: cek stok setiap item
9.  Rust: BEGIN TRANSACTION
10. Rust: INSERT transactions (cashier_id dari session)
11. Rust: INSERT transaction_items (loop)
12. Rust: UPDATE products.stock (kurangi)
13. Rust: COMMIT → return Transaction
        ▼
14. Frontend: clearCart() + toast sukses
15. invoke('print_receipt', { session_token, id })
```

### 8.5 Void Transaksi (Admin Only)

```
1. Admin buka ReportsPage → detail transaksi
2. Klik [VOID] → ConfirmDialog
3. Konfirmasi → invoke('void_transaction', { session_token, id })
        ▼
4. Rust: validate_admin(session_token)
5. Rust: UPDATE transactions SET status='VOID', voided_by, voided_at
6. Rust: LOOP items → UPDATE products.stock += quantity
        ▼
7. Frontend: refresh → transaksi tampil badge VOID merah
```

### 8.6 Admin Buat Akun Kasir

```
1. Admin buka ManageUsersPage
2. Klik [+ Tambah Kasir] → UserForm modal
3. Isi: Nama, Username, Password
   (Role selalu KASIR — tidak bisa pilih ADMIN)
4. Submit → invoke('create_user', { session_token, payload })
5. Kasir baru muncul di tabel, status Aktif
6. Admin informasikan credentials ke kasir secara langsung
```

---

## 9. RENCANA EKSEKUSI & MILESTONE

### Sprint 0 — Setup & Auth (Hari 1–3)

- [ ] `pnpm create tauri-app@latest --template react-ts`
- [ ] Install: Tailwind CSS, shadcn/ui, Zustand, TanStack Router/Query, Recharts, Lucide
- [ ] Setup `Cargo.toml` (semua crate termasuk bcrypt)
- [ ] Buat full DB schema + seed settings
- [ ] Implementasi `SessionStore` + `auth_cmd.rs`
- [ ] `authStore.ts` + `LoginPage` + `FirstSetupPage`
- [ ] Route guard per role
- [ ] **Target:** Bisa login, redirect sesuai role

### Sprint 1 — Core POS (Hari 4–9)

- [ ] Backend: `get_products`, `get_discounts`, `create_transaction`
- [ ] Frontend: `ProductGrid`, `CartPanel`, `DiscountModal`, `PaymentModal`
- [ ] `cartStore.ts` dengan kalkulasi diskon + pajak
- [ ] Barcode scanner hook
- [ ] **Target:** Transaksi lengkap dengan diskon

### Sprint 2 — User Management (Hari 10–12)

- [ ] Backend: `user_cmd.rs` lengkap
- [ ] Frontend: `ManageUsersPage.tsx`
- [ ] Guard: Admin tidak bisa nonaktifkan diri sendiri
- [ ] **Target:** Admin bisa kelola kasir

### Sprint 3 — Inventori (Hari 13–17)

- [ ] Backend: CRUD products + categories
- [ ] Frontend: `InventoryPage.tsx` + `CategoryManager`
- [ ] Validasi dengan `react-hook-form` + `zod`
- [ ] **Target:** Admin bisa kelola produk penuh

### Sprint 4 — Laporan (Hari 18–21)

- [ ] Backend: `report_cmd.rs` dengan SQL aggregasi
- [ ] Frontend: `ReportsPage.tsx` + semua chart + shift summary
- [ ] **Target:** Admin bisa lihat laporan lengkap

### Sprint 5 — Settings Lengkap (Hari 22–27)

- [ ] Backend: `settings_cmd.rs` + `discount_cmd.rs`
- [ ] Frontend: `SettingsPage.tsx` dengan 6 tab
- [ ] Integrasi settings ke kalkulasi pajak di `cartStore`
- [ ] Integrasi settings ke output struk
- [ ] **Target:** Semua pengaturan end-to-end

### Sprint 6 — Printer & Polish (Hari 28–33)

- [ ] Integrasi `escpos-rs` dengan paper width dari settings
- [ ] Preview struk + test print
- [ ] Low stock alert di navbar
- [ ] UX polish, error handling menyeluruh
- [ ] `cargo tauri build` → installer
- [ ] **Target:** Produksi siap

---

## 10. PANDUAN UNTUK AGEN AI (AI Agent Guidelines)

### 10.1 Aturan Penulisan Kode — WAJIB

| Aturan | Implementasi |
|--------|-------------|
| **TypeScript Strict** | `strict: true`, `noImplicitAny: true`. Tidak ada `any` |
| **React Functional** | HANYA functional component + hooks |
| **Session di setiap call** | `sessionToken: authStore.getState().user?.sessionToken ?? ''` |
| **Rust Auth Guard** | Baris pertama semua command sensitif: `state.sessions.lock().unwrap().validate(&session_token)?` |
| **Rust Admin Guard** | Command admin-only: `state.sessions.lock().unwrap().validate_admin(&session_token)?` |
| **Password** | TIDAK PERNAH log plaintext. Selalu `bcrypt::hash(&password, 12)` |
| **Error Mapping** | `.map_err(\|e\| e.to_string())?` di setiap DB call |
| **Format Rupiah** | Selalu `formatRupiah()` dari `lib/currency.ts` |
| **Role Check UI** | `useAuthStore().user?.role === 'ADMIN'` untuk conditional render |

### 10.2 Contoh Conditional Render per Role

```typescript
import { useAuthStore } from '../store/authStore';

function AppNavbar() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  return (
    <nav>
      <NavLink to="/pos">Kasir</NavLink>
      {isAdmin && <NavLink to="/inventory">Inventori</NavLink>}
      {isAdmin && <NavLink to="/reports">Laporan</NavLink>}
      {isAdmin && <NavLink to="/users">Kelola User</NavLink>}
      {isAdmin && <NavLink to="/settings">Pengaturan</NavLink>}
    </nav>
  );
}
```

### 10.3 Urutan Implementasi yang Direkomendasikan

```
1.  migrations.rs                      ← Schema DB lengkap
2.  auth/session.rs                    ← SessionStore
3.  models/user.rs                     ← Struct User, LoginResult
4.  commands/auth_cmd.rs               ← check_first_run, create_admin, login, logout
5.  src/types/index.ts                 ← Semua TS interface
6.  src/store/authStore.ts             ← Zustand auth state
7.  src/pages/LoginPage.tsx            ← Conditional tombol buat akun
8.  src/pages/FirstSetupPage.tsx
9.  src/router.ts                      ← Route guard per role
10. src/store/cartStore.ts             ← Dengan diskon + pajak
11. src/lib/tauri.ts                   ← Typed invoke (semua sertakan token)
12. src/features/pos/                  ← Semua komponen POS
13. src/pages/POSPage.tsx
14. commands/user_cmd.rs               ← CRUD user
15. src/pages/ManageUsersPage.tsx
16. commands/product_cmd.rs            ← CRUD produk + kategori
17. src/pages/InventoryPage.tsx
18. commands/discount_cmd.rs           ← CRUD diskon
19. commands/transaction_cmd.rs        ← create + void
20. commands/report_cmd.rs             ← Laporan
21. src/pages/ReportsPage.tsx
22. commands/settings_cmd.rs           ← Get/save settings
23. src/pages/SettingsPage.tsx         ← 6 tab lengkap
```

### 10.4 Template Prompt

```
Buat [nama file/komponen] sesuai blueprint-pos-kasir.md versi 3.0.
Tech stack: Tauri v2, Rust, React 18, TypeScript strict, Zustand, shadcn/ui, Tailwind.
Auth: setiap invoke() sertakan sessionToken dari authStore.
Implementasikan [fungsi spesifik].
Ikuti aturan Section 10.1.
Kode lengkap siap pakai, tanpa penjelasan berlebihan.
```

---

## 11. CHECKLIST KESIAPAN PRODUKSI

### 11.1 Auth & Security

- [ ] Password selalu di-hash bcrypt, tidak pernah log plaintext
- [ ] `create_admin` tidak bisa dieksploitasi untuk buat admin kedua
- [ ] Session expired setelah 8 jam
- [ ] Setiap command sensitif validasi session di baris pertama
- [ ] Admin-only command validasi role sebelum eksekusi
- [ ] Route guard aktif client-side + server-side (Rust)

### 11.2 Backend

- [ ] Semua command ter-register di `main.rs`
- [ ] Migrations idempotent (`CREATE TABLE IF NOT EXISTS`)
- [ ] Stok tidak bisa negatif (constraint + validasi Rust)
- [ ] Void transaksi kembalikan stok dengan benar
- [ ] Transaksi DB menggunakan `BEGIN/COMMIT/ROLLBACK`
- [ ] Error message dalam Bahasa Indonesia

### 11.3 Frontend

- [ ] `npx tsc --noEmit` tanpa error
- [ ] Route guard: kasir tidak bisa akses URL admin
- [ ] Tombol buat akun hilang setelah admin dibuat
- [ ] Cart clear setelah transaksi sukses
- [ ] Format Rupiah konsisten di seluruh app
- [ ] Loading state di semua tombol invoke
- [ ] Error Rust tampil sebagai toast informatif

### 11.4 Settings & Features

- [ ] Logo muncul di struk jika toggle aktif
- [ ] Header + footer struk dari settings tersimpan dan terpakai
- [ ] Kalkulasi pajak inclusive/exclusive benar
- [ ] Diskon nominal dan persen dihitung benar di cart
- [ ] Paper width (58/80mm) mempengaruhi output cetak
- [ ] Low stock alert muncul di navbar

### 11.5 Build & Distribusi

- [ ] `cargo tauri build` sukses tanpa warning
- [ ] SQLite disimpan di `AppData` user
- [ ] Icon aplikasi dikonfigurasi
- [ ] Versi di `tauri.conf.json` dan `package.json`
- [ ] Ditest di VM bersih

---

> **Blueprint KasirPro v3.0** — Multi-Role · Auth · Settings Lengkap · Siap Produksi  
> Tauri v2 · Rust · React 18 · TypeScript · SQLite  
> *Single source of truth untuk seluruh pengembangan.*
