# Dokumentasi Backend KasirPro v4.0

> Dokumen ini ditujukan untuk agen AI selanjutnya yang akan mengerjakan bagian **Frontend (UI/UX)** menggunakan React + TypeScript + Tauri v2. Seluruh backend Rust sudah selesai 100% dan teruji kompilasinya (`cargo check` passed). Anda hanya perlu fokus pada integrasi menggunakan `invoke()`.

---

## 1. Arsitektur Backend

Backend dibangun dengan **Tauri v2** dan **Rust**. Menggunakan **SQLite** (`sqlx`) untuk database, `bcrypt` untuk hash password, dan in-memory `HashMap` untuk manajemen sesi login.

### Struktur File Backend (`src-tauri/src/`)

```
src-tauri/src/
├── lib.rs                  # Entry point, AppState, wire semua module & commands
├── main.rs                 # Binary entry (memanggil lib::run())
├── errors.rs               # Custom AppError enum
├── database/
│   ├── mod.rs
│   ├── connection.rs       # init_db() → SQLitePool (WAL, FK enabled)
│   └── migrations.rs       # CREATE TABLE IF NOT EXISTS + seed settings
├── auth/
│   ├── mod.rs
│   ├── session.rs          # SessionStore: HashMap<token, SessionData>
│   └── guard.rs            # validate_session(), validate_admin()
├── models/
│   ├── mod.rs
│   ├── user.rs             # DbUser, User, LoginResult, AuthUserData, payloads
│   ├── product.rs          # Product, ProductWithCategory, Category, payloads
│   ├── transaction.rs      # Transaction, TransactionDetail, payloads, Paginated
│   ├── discount.rs         # Discount, Create/Update payloads
│   └── settings.rs         # AppSettings, CompanyProfile, ReceiptSettings, TaxSettings, Report structs
└── commands/
    ├── mod.rs
    ├── auth_cmd.rs          # 5 commands (check_first_run, create_admin, login, logout, check_session)
    ├── user_cmd.rs          # 5 commands (get_all_users, create_user, update_user, toggle_user_status, reset_user_password)
    ├── product_cmd.rs       # 10 commands (+save_product_image, +generate_barcode)
    ├── discount_cmd.rs      # 4 commands
    ├── transaction_cmd.rs   # 4 commands (create_transaction: auto tax + per-item discount)
    ├── report_cmd.rs        # 4 commands
    └── settings_cmd.rs      # 5 commands
```

### AppState

```rust
pub struct AppState {
    pub db: sqlx::SqlitePool,
    pub sessions: Mutex<SessionStore>,
}
```

Database diinisialisasi saat `setup()` hook Tauri, disimpan di `AppData/kasirpro.db`.

---

## 2. Sistem Autentikasi

### Session Token

- Setelah `login()` berhasil, backend return `LoginResult` yang berisi `session_token` (UUID v4).
- Frontend WAJIB menyimpan token ini di **Zustand store** (`authStore`).
- Token **wajib** dikirim sebagai parameter `session_token` pada setiap `invoke()` (kecuali public commands).
- Session otomatis **expired setelah 8 jam**.
- Session **tidak persisten** — user harus login ulang setiap buka aplikasi.

### 2 Tipe Guard

1. **`validate_session()`** — Memastikan token valid & belum expired. Untuk semua role.
2. **`validate_admin()`** — Memastikan token valid DAN role = `"ADMIN"`. Kasir otomatis ditolak.

### Error Messages (Indonesian)

- Token tidak valid: `"Sesi tidak valid, silakan login ulang"`
- Token expired: `"Sesi expired, silakan login ulang"`
- Bukan admin: `"Akses ditolak: hanya Admin yang bisa melakukan ini"`

---

## 3. Database Schema

### Tabel `users`

| Kolom         | Tipe                 | Keterangan               |
| ------------- | -------------------- | ------------------------ |
| id            | INTEGER PK           | Auto increment           |
| name          | TEXT NOT NULL        | Nama lengkap             |
| username      | TEXT UNIQUE NOT NULL | Username login           |
| password_hash | TEXT NOT NULL        | bcrypt hash (cost 12)    |
| role          | TEXT NOT NULL        | `'ADMIN'` atau `'KASIR'` |
| is_active     | INTEGER DEFAULT 1    | 1 = aktif, 0 = nonaktif  |
| created_at    | DATETIME             | Auto                     |
| created_by    | INTEGER FK           | Siapa yang membuat       |
| last_login_at | DATETIME             | Update saat login        |

### Tabel `categories`

| Kolom | Tipe                 |
| ----- | -------------------- |
| id    | INTEGER PK           |
| name  | TEXT UNIQUE NOT NULL |

### Tabel `products`

| Kolom       | Tipe                    | Keterangan |
| ----------- | ----------------------- | ---------- |
| id          | INTEGER PK              |            |
| category_id | INTEGER FK → categories | nullable   |
| sku         | TEXT UNIQUE             | nullable   |
| name        | TEXT NOT NULL           |            |
| price       | REAL NOT NULL           | >= 0       |
| stock       | INTEGER NOT NULL        | >= 0       |
| barcode     | TEXT UNIQUE             | nullable   |
| is_active   | INTEGER DEFAULT 1       |            |
| created_at  | DATETIME                |            |
| updated_at  | DATETIME                |            |

### Tabel `discounts`

| Kolom        | Tipe              | Keterangan                   |
| ------------ | ----------------- | ---------------------------- |
| id           | INTEGER PK        |                              |
| name         | TEXT NOT NULL     |                              |
| type         | TEXT NOT NULL     | `'NOMINAL'` atau `'PERCENT'` |
| value        | REAL NOT NULL     | > 0                          |
| min_purchase | REAL DEFAULT 0    |                              |
| is_active    | INTEGER DEFAULT 1 |                              |
| created_at   | DATETIME          |                              |

### Tabel `transactions`

| Kolom           | Tipe                       | Keterangan                    |
| --------------- | -------------------------- | ----------------------------- |
| id              | TEXT PK                    | UUID v4                       |
| cashier_id      | INTEGER FK → users         |                               |
| timestamp       | DATETIME                   | Auto                          |
| total_amount    | REAL NOT NULL              | >= 0                          |
| discount_id     | INTEGER FK → discounts     | nullable                      |
| discount_amount | REAL DEFAULT 0             |                               |
| tax_amount      | REAL DEFAULT 0             |                               |
| payment_method  | TEXT NOT NULL              | `'CASH'`, `'DEBIT'`, `'QRIS'` |
| amount_paid     | REAL NOT NULL              |                               |
| change_given    | REAL DEFAULT 0             |                               |
| status          | TEXT DEFAULT `'COMPLETED'` | `'COMPLETED'` atau `'VOID'`   |
| voided_by       | INTEGER FK → users         | nullable                      |
| voided_at       | DATETIME                   | nullable                      |
| notes           | TEXT                       | nullable                      |

### Tabel `transaction_items`

| Kolom          | Tipe                             |
| -------------- | -------------------------------- |
| id             | INTEGER PK                       |
| transaction_id | TEXT FK → transactions (CASCADE) |
| product_id     | INTEGER FK → products            |
| quantity       | INTEGER NOT NULL (> 0)           |
| price_at_time  | REAL NOT NULL                    |
| subtotal       | REAL NOT NULL                    |

### Tabel `settings` (Key-Value)

| Kolom | Tipe          |
| ----- | ------------- |
| key   | TEXT PK       |
| value | TEXT NOT NULL |

Default seed keys: `company.*`, `receipt.*`, `tax.*`, `app.*` (lihat `migrations.rs`).

---

## 4. Semua Data Struct (Return Types)

Berikut adalah detail field dari setiap struct yang dikembalikan oleh backend ke frontend. **Gunakan ini untuk membuat TypeScript interfaces di `src/types/index.ts`.**

### `LoginResult`

```typescript
{
  user: {
    id: number;
    name: string;
    username: string;
    role: "ADMIN" | "KASIR";
  }
  session_token: string;
  login_at: string; // RFC3339 datetime
}
```

### `AuthUserData`

```typescript
{
  id: number;
  name: string;
  username: string;
  role: "ADMIN" | "KASIR";
}
```

### `User`

```typescript
{
  id: number;
  name: string;
  username: string;
  role: "ADMIN" | "KASIR";
  is_active: boolean;
  created_at: string | null;
  last_login_at: string | null;
}
```

### `ProductWithCategory`

```typescript
{
  id: number;
  category_id: number | null;
  category_name: string | null;
  sku: string | null;
  name: string;
  price: number;
  stock: number;
  barcode: string | null;
  image_path: string | null; // path gambar di AppData
  is_active: boolean;
}
```

### `Product`

```typescript
{
  id: number;
  category_id: number | null;
  sku: string | null;
  name: string;
  price: number;
  stock: number;
  barcode: string | null;
  image_path: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}
```

### `Category`

```typescript
{
  id: number;
  name: string;
}
```

### `CategoryWithCount`

```typescript
{
  id: number;
  name: string;
  product_count: number;
}
```

### `Discount`

```typescript
{
  id: number;
  name: string;
  type: "NOMINAL" | "PERCENT";
  value: number;
  min_purchase: number;
  is_active: boolean;
  created_at: string | null;
}
```

### `Transaction`

```typescript
{
  id: string;
  cashier_id: number;
  timestamp: string | null;
  total_amount: number;
  discount_id: number | null;
  discount_amount: number;
  tax_amount: number;
  payment_method: "CASH" | "DEBIT" | "QRIS";
  amount_paid: number;
  change_given: number;
  status: "COMPLETED" | "VOID";
  voided_by: number | null;
  voided_at: string | null;
  notes: string | null;
}
```

### `TransactionWithCashier`

Sama seperti `Transaction` ditambah:

```typescript
{ ...Transaction, cashier_name: string }
```

### `TransactionItemWithProduct`

```typescript
{
  id: number;
  transaction_id: string;
  product_id: number;
  product_name: string;
  quantity: number;
  price_at_time: number;
  subtotal: number;
  discount_amount: number; // diskon per item (0 jika tidak ada)
}
```

### `TransactionDetail`

```typescript
{ transaction: TransactionWithCashier; items: TransactionItemWithProduct[] }
```

### `PaginatedTransactions`

```typescript
{ data: TransactionWithCashier[]; total: number; page: number; per_page: number }
```

> `per_page` selalu 20.

### `DailyReport`

```typescript
{
  date: string;
  total_revenue: number;
  transaction_count: number;
  average_transaction: number;
  total_items_sold: number;
  cash_total: number;
  debit_total: number;
  qris_total: number;
  void_count: number;
}
```

### `ChartPoint`

```typescript
{
  date: string;
  revenue: number;
  count: number;
}
```

### `ProductStat`

```typescript
{
  product_id: number;
  name: string;
  total_sold: number;
  total_revenue: number;
}
```

### `ShiftSummary`

```typescript
{
  cashier_name: string;
  login_at: string;
  transaction_count: number;
  total_revenue: number;
}
```

### `AppSettings`

```typescript
{
  company: {
    store_name: string;
    address: string;
    phone: string;
    email: string;
    website: string;
    logo_path: string;
    tax_number: string;
  }
  receipt: {
    show_logo: boolean;
    header_text: string;
    footer_text: string;
    show_cashier_name: boolean;
    show_tax_detail: boolean;
    show_discount_detail: boolean;
    paper_width: "58mm" | "80mm";
    copies: number;
  }
  tax: {
    is_enabled: boolean;
    rate: number;
    label: string;
    is_included: boolean;
  }
  low_stock_threshold: number;
  printer_port: string;
  timezone: string;
}
```

---

## 5. Daftar Lengkap Endpoint (37 Tauri Commands)

### A. Auth Commands (5)

| Command           | Parameter                      | Auth   | Return         |
| ----------------- | ------------------------------ | ------ | -------------- |
| `check_first_run` | _(none)_                       | Public | `boolean`      |
| `create_admin`    | `name`, `username`, `password` | Public | `()`           |
| `login`           | `username`, `password`         | Public | `LoginResult`  |
| `logout`          | `session_token`                | Semua  | `()`           |
| `check_session`   | `session_token`                | Semua  | `AuthUserData` |

### B. User Management (5)

| Command               | Parameter                                                | Auth      | Return    |
| --------------------- | -------------------------------------------------------- | --------- | --------- |
| `get_all_users`       | `session_token`                                          | **ADMIN** | `User[]`  |
| `create_user`         | `session_token`, `payload: { name, username, password }` | **ADMIN** | `User`    |
| `update_user`         | `session_token`, `id`, `payload: { name, username }`     | **ADMIN** | `User`    |
| `toggle_user_status`  | `session_token`, `user_id`                               | **ADMIN** | `boolean` |
| `reset_user_password` | `session_token`, `user_id`, `new_password`               | **ADMIN** | `()`      |

> **Catatan:** `create_user` selalu membuat role KASIR. Admin tidak bisa membuat admin kedua dari UI. Admin tidak bisa menonaktifkan diri sendiri.

### C. Inventori & Produk (10)

| Command                  | Parameter                                                                                               | Auth      | Return                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------- | --------- | ------------------------- |
| `get_categories`         | `session_token`                                                                                         | Semua     | `CategoryWithCount[]`     |
| `create_category`        | `session_token`, `name`                                                                                 | **ADMIN** | `Category`                |
| `get_products`           | `session_token`, `search?`, `category_id?`, `show_inactive?`                                            | Semua     | `ProductWithCategory[]`   |
| `get_product_by_barcode` | `session_token`, `barcode`                                                                              | Semua     | `ProductWithCategory`     |
| `create_product`         | `session_token`, `payload: { name, sku?, barcode?, category_id?, price, stock, image_path? }`           | **ADMIN** | `Product`                 |
| `update_product`         | `session_token`, `id`, `payload: { name, sku?, barcode?, category_id?, price, is_active, image_path? }` | **ADMIN** | `Product`                 |
| `adjust_stock`           | `session_token`, `product_id`, `delta`                                                                  | **ADMIN** | `number` (new stock)      |
| `delete_product`         | `session_token`, `product_id`                                                                           | **ADMIN** | `()` (soft delete)        |
| `save_product_image`     | `session_token`, `product_id`, `file_path`                                                              | **ADMIN** | `string` (saved path)     |
| `generate_barcode`       | `session_token`, `product_id`                                                                           | **ADMIN** | `string` (EAN-13 barcode) |

> **Catatan `save_product_image`:** Validasi PNG/JPG/WEBP, max 5MB. File disimpan di AppData/products/{id}.{ext}.
>
> **Catatan `generate_barcode`:** Auto-generate EAN-13 valid (13 digit numeric) dengan prefix "200" (in-store). Bisa di-scan oleh barcode scanner standar.
>
> **Catatan:** Kasir hanya melihat produk aktif. Admin bisa melihat semua.

### D. Diskon (4)

| Command           | Parameter                                                                        | Auth      | Return                 |
| ----------------- | -------------------------------------------------------------------------------- | --------- | ---------------------- |
| `get_discounts`   | `session_token`                                                                  | Semua     | `Discount[]`           |
| `create_discount` | `session_token`, `payload: { name, type, value, min_purchase }`                  | **ADMIN** | `Discount`             |
| `update_discount` | `session_token`, `id`, `payload: { name, type, value, min_purchase, is_active }` | **ADMIN** | `Discount`             |
| `toggle_discount` | `session_token`, `id`                                                            | **ADMIN** | `boolean` (new status) |

> **Catatan:** Kasir hanya melihat diskon aktif. Admin melihat semua.

### E. Transaksi (4)

| Command                  | Parameter                                     | Auth      | Return                  |
| ------------------------ | --------------------------------------------- | --------- | ----------------------- |
| `create_transaction`     | `session_token`, `payload` (lihat bawah)      | Semua     | `Transaction`           |
| `void_transaction`       | `session_token`, `transaction_id`             | **ADMIN** | `()`                    |
| `get_transactions`       | `session_token`, `date?` (YYYY-MM-DD), `page` | Semua\*   | `PaginatedTransactions` |
| `get_transaction_detail` | `session_token`, `transaction_id`             | Semua     | `TransactionDetail`     |

**CreateTransactionPayload (UPDATED v4.0 — Breaking Change):**

```typescript
{
  items: Array<{
    product_id: number;
    quantity: number;
    price_at_time: number;
    discount_amount: number;  // diskon per item (0 jika tidak ada)
  }>
  discount_id: number | null     // diskon transaksi-level
  discount_amount: number         // nilai diskon transaksi-level
  payment_method: "CASH" | "DEBIT" | "QRIS"
  amount_paid: number
  notes?: string
}
```

> ⚠️ **BREAKING CHANGE:** `total_amount` dan `tax_amount` **TIDAK lagi dikirim** dari frontend. Backend menghitung keduanya otomatis.
>
> **Alur kalkulasi backend:**
>
> 1. Hitung subtotal setiap item: `(price_at_time × quantity) - discount_amount`
> 2. Kurangi diskon transaksi-level
> 3. Baca `tax.*` settings → hitung pajak otomatis
> 4. Jika `tax.is_included = false` → total = subtotal + pajak
> 5. Jika `tax.is_included = true` → total = subtotal (pajak sudah di dalam harga)
>
> **Catatan `get_transactions`:** Kasir hanya melihat transaksinya sendiri. Admin melihat semua.
>
> **Catatan `void_transaction`:** Otomatis mengembalikan stok produk.

### F. Laporan (4)

| Command             | Parameter                                          | Auth      | Return          |
| ------------------- | -------------------------------------------------- | --------- | --------------- |
| `get_daily_report`  | `session_token`, `date` (YYYY-MM-DD)               | **ADMIN** | `DailyReport`   |
| `get_sales_chart`   | `session_token`, `start_date`, `end_date`          | **ADMIN** | `ChartPoint[]`  |
| `get_top_products`  | `session_token`, `start_date`, `end_date`, `limit` | **ADMIN** | `ProductStat[]` |
| `get_shift_summary` | `session_token`                                    | Semua     | `ShiftSummary`  |

> **Catatan `get_shift_summary`:** Menghitung transaksi kasir sejak sesi login dimulai.

### G. Pengaturan & Printer (5)

| Command         | Parameter                               | Auth      | Return                |
| --------------- | --------------------------------------- | --------- | --------------------- |
| `get_settings`  | `session_token`                         | Semua     | `AppSettings`         |
| `save_settings` | `session_token`, `payload: AppSettings` | **ADMIN** | `()`                  |
| `save_logo`     | `session_token`, `file_path`            | **ADMIN** | `string` (saved path) |
| `print_receipt` | `session_token`, `transaction_id`       | Semua     | `()` ⚠️ stub          |
| `test_print`    | `session_token`                         | **ADMIN** | `()` ⚠️ stub          |

> **Catatan `save_logo`:** Menerima path file lokal, validasi ekstensi (PNG/JPG) dan ukuran (max 2MB), copy ke AppData/assets/logo.{ext}, dan simpan path di settings.
>
> **Catatan `print_receipt` & `test_print`:** Saat ini masih stub/mock. Integrasi printer nyata dengan `escpos-rs` belum dilakukan.

---

## 6. Cara Frontend Memanggil Backend

```typescript
import { invoke } from "@tauri-apps/api/core";

// Contoh login
const result = await invoke<LoginResult>("login", {
  username: "admin",
  password: "password123",
});

// Contoh dengan session_token
const products = await invoke<ProductWithCategory[]>("get_products", {
  sessionToken: authStore.getState().user?.sessionToken ?? "",
  search: "kopi",
  categoryId: null,
  showInactive: false,
});
```

> **PENTING:** Tauri otomatis konversi `snake_case` Rust menjadi `camelCase` pada parameter! Misalnya parameter Rust `session_token` harus dikirim sebagai `sessionToken` dari frontend.

---

## 7. Alur Penting untuk Frontend

### First-Time Setup

1. Panggil `check_first_run()` → `true` artinya belum ada admin
2. Tampilkan tombol "Buat Akun Admin" di LoginPage
3. Navigasi ke FirstSetupPage → panggil `create_admin()`
4. Redirect ke LoginPage (tombol buat akun tidak pernah muncul lagi)

### Login & Redirect per Role

1. `login()` → simpan `session_token` + `user` di Zustand
2. Role ADMIN → redirect ke `/inventory`
3. Role KASIR → redirect ke `/pos`

### Transaksi POS

1. `get_products()` → tampilkan grid
2. User klik/scan → tambah ke cart (Zustand `cartStore`)
3. Kalkulasi subtotal, diskon, pajak di **frontend** (cartStore)
4. Klik Bayar → `create_transaction()` (backend re-validasi)
5. Sukses → `clearCart()` + optional `print_receipt()`

### Void Transaksi

1. Admin buka detail transaksi
2. Klik Void → `void_transaction()` (stok otomatis dikembalikan)

---

## 8. File Frontend yang Sudah Disiapkan (Kosong)

Semua file berikut sudah dibuat sebagai file kosong, siap diisi implementasi:

### Core

- `src/types/index.ts` — TypeScript interfaces (gunakan Section 4 di atas)
- `src/store/authStore.ts` — Zustand: user, sessionToken, isAdmin()
- `src/store/cartStore.ts` — Zustand: items, addItem, removeItem, setDiscount, clearCart
- `src/store/settingsStore.ts` — Zustand: cache AppSettings
- `src/lib/currency.ts` — formatRupiah(), parseCurrency()
- `src/lib/tauri.ts` — Typed invoke wrapper
- `src/router.ts` — TanStack Router v1 + route guards

### Hooks

- `src/hooks/useInvokeQuery.ts` — TanStack Query wrapper untuk invoke
- `src/hooks/useBarcodeScanner.ts` — Deteksi input barcode
- `src/hooks/useSession.ts` — Validasi session saat mount

### Pages (7)

- `src/pages/LoginPage.tsx`
- `src/pages/FirstSetupPage.tsx`
- `src/pages/POSPage.tsx`
- `src/pages/InventoryPage.tsx` _(Admin)_
- `src/pages/ReportsPage.tsx` _(Admin)_
- `src/pages/ManageUsersPage.tsx` _(Admin)_
- `src/pages/SettingsPage.tsx` _(Admin)_

### Feature Components (22)

- `src/features/auth/` — LoginForm, FirstSetupForm, ChangePasswordForm
- `src/features/pos/` — ProductGrid, CartPanel, PaymentModal, NumpadInput, DiscountModal
- `src/features/inventory/` — ProductForm, StockAdjust, CategoryManager
- `src/features/users/` — UserTable, UserForm, UserStatusToggle
- `src/features/reports/` — SalesChart, TopProducts, ShiftSummary
- `src/features/settings/` — CompanyProfileForm, ReceiptSettings, DiscountSettings, TaxSettings, PrinterSettings

### Shared Components (4)

- `src/components/DataTable.tsx`
- `src/components/ConfirmDialog.tsx`
- `src/components/CurrencyDisplay.tsx`
- `src/components/RoleBadge.tsx`

### shadcn/ui Components (sudah terinstall, 19)

badge, button, card, checkbox, dialog, dropdown-menu, form, input, label, popover, scroll-area, select, separator, sheet, skeleton, table, tabs, toast, toaster

---

## 9. Dependencies yang Terinstall

### Frontend (package.json)

| Package                | Versi    | Fungsi                 |
| ---------------------- | -------- | ---------------------- |
| react                  | ^19.1.0  | UI Framework           |
| zustand                | ^5.0.11  | State management       |
| @tanstack/react-router | ^1.162.1 | Type-safe routing      |
| @tanstack/react-query  | ^5.90.21 | Caching invoke results |
| recharts               | ^3.7.0   | Charts untuk laporan   |
| lucide-react           | ^0.575.0 | Icons                  |
| react-hook-form        | ^7.71.2  | Form handling          |
| zod                    | ^4.3.6   | Validation             |
| tailwindcss            | 3.4      | Styling                |
| date-fns               | ^4.1.0   | Date formatting        |

### Backend (Cargo.toml)

| Crate            | Versi                       | Fungsi            |
| ---------------- | --------------------------- | ----------------- |
| tauri            | 2                           | Framework desktop |
| sqlx             | 0.7 (sqlite, runtime-tokio) | Database          |
| bcrypt           | 0.15                        | Password hashing  |
| uuid             | 1 (v4)                      | Session tokens    |
| chrono           | 0.4                         | DateTime handling |
| serde/serde_json | 1                           | Serialization     |
| thiserror        | 1                           | Error handling    |
| tokio            | 1 (full)                    | Async runtime     |

---

> **Total: 37 Tauri commands** terdaftar dan terimplementasi.
> **Status kompilasi: ✅ `cargo check` passed tanpa error.**
> **Tanggal dokumentasi: 22 Februari 2026 (v4.0)**

## 10. Catatan Penting untuk Frontend

### Input Pembayaran

Input jumlah uang bayar HARUS mendukung **keyboard (angka)** DAN **numpad on-screen**. Jangan hanya mengandalkan komponen NumpadInput — pastikan user juga bisa mengetik langsung dari keyboard fisik.

### Diskon Per-Item

Pada `PaymentModal` atau `CartPanel`, beri opsi untuk menerapkan diskon di **level item individual** (field `discount_amount` per item) maupun di **level transaksi keseluruhan** (field `discount_amount` di payload utama).

### Pajak Otomatis

Frontend **tidak perlu** menghitung pajak. Cukup kirim items + diskon + metode bayar + jumlah bayar. Backend akan menghitung pajak dari settings dan mengembalikan `total_amount` & `tax_amount` di response `Transaction`.

### Barcode Produk

Saat admin menambah produk baru, tampilkan tombol **"Generate Barcode"** yang memanggil `generate_barcode`. Barcode yang dihasilkan berformat EAN-13 (13 digit) dan compatible dengan barcode scanner fisik standar.

### Gambar Produk

Saat admin menambah/edit produk, tampilkan opsi upload gambar. Panggil `save_product_image` setelah produk dibuat/diupdate. Gambar akan di-copy ke AppData dan path-nya disimpan di `image_path`. Untuk menampilkan gambar, gunakan `convertFileSrc()` dari `@tauri-apps/api/core`.
