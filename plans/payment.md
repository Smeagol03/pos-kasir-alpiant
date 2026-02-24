Tentu, ini adalah **Product Requirements Document (PRD)** yang dirancang khusus untuk integrasi sistem pembayaran pada aplikasi **POS Kasir Alpiant** yang berbasis **Tauri**.

---

# PRD: Integrasi QRIS Dinamis (Payment Gateway)

**Proyek:** POS Kasir Alpiant

**Stack:** Tauri (Rust), React, Vite, Tailwind CSS

**Versi:** 1.0

---

## 1. Ringkasan Eksekutif

Tujuan dari fitur ini adalah untuk mendigitalisasi proses pembayaran di kasir dengan menyediakan **QRIS Dinamis**. Sistem akan secara otomatis menghasilkan kode QR unik untuk setiap transaksi, memverifikasi pembayaran secara *real-time*, dan mencetak struk tanpa intervensi manual dari kasir.

## 2. User Stories

| Sebagai | Saya Ingin | Sehingga |
| --- | --- | --- |
| **Kasir** | Menghasilkan kode QR dengan nominal otomatis | Saya tidak perlu memasukkan angka manual di mesin EDC atau stiker QR. |
| **Pelanggan** | Membayar menggunakan e-wallet (GoPay/OVO/Dana) | Proses transaksi menjadi lebih cepat dan higienis. |
| **Pemilik Toko** | Sistem otomatis menandai pesanan sebagai "Lunas" | Tidak ada kecurangan (fraud) dari bukti transfer palsu. |

---

## 3. Alur Kerja (Functional Requirements)

### A. Inisiasi Pembayaran

* Sistem menghitung total belanja di frontend React.
* Kasir memilih metode pembayaran **"QRIS / Digital Payment"**.
* Tauri (Rust) mengirimkan *request* ke API Payment Gateway (misal: Midtrans/Xendit).

### B. Tampilan QR Code

* Aplikasi menampilkan modal berisi **QR Code** yang dihasilkan oleh API.
* Menampilkan **Timer Countdown** (biasanya 5-15 menit) sebelum QR kadaluarsa.

### C. Verifikasi Pembayaran (Status Check)

* **Mekanisme Polling:** Karena aplikasi Tauri berjalan di lokal (PC), sistem akan melakukan pengecekan status ke API setiap 3-5 detik.
* **Status Terdeteksi:** Jika API mengembalikan status `settlement` atau `success`, modal QR akan tertutup otomatis.

### D. Finalisasi Transaksi

* Sistem mengubah status transaksi di database lokal menjadi "Paid".
* Tauri memicu perintah ke **Printer Thermal** untuk mencetak struk secara otomatis.

---

## 4. Spesifikasi Teknis (Tauri Architecture)

### Backend (Rust `src-tauri`)

* **Library:** `reqwest` (untuk API calls), `serde` (untuk JSON).
* **Security:** API Key harus disimpan di file `.env` dan hanya diakses oleh sisi Rust. Jangan pernah mengirim API Key ke sisi React (Frontend).
* **Command:** Membuat fungsi `generate_payment_qr` dan `check_payment_status`.

### Frontend (React + Tailwind)

* **Component:** Modal pembayaran yang responsif.
* **State Management:** Menangani status *pending*, *success*, dan *expired*.
* **Feedback:** Animasi centang hijau saat pembayaran berhasil untuk memberikan kepuasan visual ke kasir.

---

## 5. UI/UX Requirements

* **Clear Visibility:** QR Code harus cukup besar agar mudah di-scan oleh kamera ponsel pelanggan dari jarak standar kasir.
* **Error Handling:** Jika koneksi internet terputus, tampilkan pesan "Koneksi Bermasalah" dan berikan tombol "Coba Lagi".
* **Auto-Close:** Modal harus otomatis tertutup dalam 2 detik setelah sukses untuk mempercepat antrean.

---

## 6. Keamanan & Kepatuhan

* **PCI-DSS:** Kita tidak menyimpan data kartu, semua proses dilakukan di server Payment Gateway.
* **Validasi:** Pastikan nominal yang dikirim ke API sama persis dengan total di keranjang belanja.

---

## 7. Tabel Rencana Implementasi (MVP)

| Fase | Fitur | Prioritas |
| --- | --- | --- |
| **Fase 1** | Integrasi API Sandbox (Testing) & Tampilan QR | Tinggi |
| **Fase 2** | Logika Polling Status Pembayaran | Tinggi |
| **Fase 3** | Auto-print Struk setelah Lunas | Menengah |
| **Fase 4** | Dashboard Laporan Penjualan Digital | Rendah |

---