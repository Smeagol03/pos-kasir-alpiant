# POS Kasir Alpiant - Production Deployment Guide

Dokumentasi lengkap untuk deployment aplikasi POS Kasir Alpiant ke production environment.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Production Checklist](#production-checklist)
- [Configuration](#configuration)
- [Security Best Practices](#security-best-practices)
- [Deployment Steps](#deployment-steps)
- [Monitoring & Maintenance](#monitoring--maintenance)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

- **OS**: Linux (Zorin OS, Ubuntu) atau Windows 10/11
- **RAM**: Minimum 4GB (8GB recommended)
- **Storage**: 500MB untuk aplikasi + space untuk database
- **Network**: Koneksi internet untuk payment gateway

### Required Software

```bash
# Linux
sudo apt update
sudo apt install -y curl wget libwebkit2gtk-4.0-dev libappindicator3-dev librsvg2-dev

# Windows
# Pastikan Visual C++ Redistributable sudah terinstall
```

---

## Production Checklist

### ✅ Pre-Deployment

- [ ] Set `APP_ENV=production` di `.env`
- [ ] Generate strong `ENCRYPTION_KEY` (minimal 32 karakter)
- [ ] Update `MIDTRANS_SERVER_KEY` ke production key (bukan sandbox)
- [ ] Update `MIDTRANS_BASE_URL=https://api.midtrans.com`
- [ ] Set `RUST_LOG=warn` atau `error` untuk production
- [ ] Pastikan file `.env` TIDAK di-commit ke git
- [ ] Set proper file permissions: `chmod 600 .env`
- [ ] Backup database existing (jika ada)
- [ ] Test semua fitur utama di staging environment

### ✅ Security

- [ ] ENCRYPTION_KEY disimpan di environment variable atau secure vault
- [ ] Database file permissions: `chmod 640 pos.db`
- [ ] Log directory permissions: `chmod 750 logs/`
- [ ] User aplikasi tidak punya akses root/admin
- [ ] Firewall configured untuk block akses yang tidak perlu

### ✅ Backup & Recovery

- [ ] Automated backup script configured
- [ ] Backup retention policy set (keep last 7-30 days)
- [ ] Test restore procedure
- [ ] Document recovery steps

---

## Configuration

### Environment Variables (.env)

```bash
# =============================================================================
# APPLICATION ENVIRONMENT
# =============================================================================
APP_ENV=production

# =============================================================================
# DATABASE CONFIGURATION
# =============================================================================
DB_PATH=pos.db
DB_MAX_CONNECTIONS=20
DB_MIN_CONNECTIONS=5

# =============================================================================
# PAYMENT GATEWAY - MIDTRANS (PRODUCTION)
# =============================================================================
MIDTRANS_SERVER_KEY=Mid-server-xxxxxxxxxxxxx
MIDTRANS_BASE_URL=https://api.midtrans.com
QRIS_ENABLED=true

# =============================================================================
# SECURITY CONFIGURATION
# =============================================================================
# Generate dengan: openssl rand -hex 32
ENCRYPTION_KEY=your-super-secret-encryption-key-at-least-32-chars-long

SESSION_TIMEOUT_MINS=480
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION_MINS=15
MIN_PASSWORD_LENGTH=8

# =============================================================================
# LOGGING CONFIGURATION
# =============================================================================
RUST_LOG=warn
LOG_TO_STDOUT=true

# =============================================================================
# PRINTER CONFIGURATION
# =============================================================================
PRINTER_DEFAULT_PORT=cups
PRINTER_PAPER_WIDTH=80mm
PRINTER_COPIES=1
PRINTER_AUTO_PRINT=false
```

### Generate Encryption Key

```bash
# Linux/macOS
openssl rand -hex 32

# Windows PowerShell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
```

---

## Security Best Practices

### 1. File Permissions

```bash
# Linux
chmod 600 .env
chmod 640 pos.db
chmod 750 logs/
chown -R posuser:posgroup /opt/pos-kasir-alpiant/
```

### 2. Environment Variables

Jangan pernah hardcode credentials di code atau config file. Gunakan environment variables:

```bash
# /etc/environment atau ~/.bashrc
export ENCRYPTION_KEY="your-secret-key"
export MIDTRANS_SERVER_KEY="Mid-server-xxx"
```

### 3. Database Security

- SQLite file hanya bisa diakses oleh user aplikasi
- Enable WAL mode untuk concurrent access
- Regular backup untuk prevent data loss

### 4. Payment Gateway

- Gunakan production credentials dari Midtrans dashboard
- Enable QRIS di Midtrans dashboard
- Test dengan nominal kecil terlebih dahulu
- Monitor transaksi mencurigakan

---

## Deployment Steps

### Step 1: Build Application

```bash
# Clone repository
git clone https://github.com/your-org/pos-kasir-alpiant.git
cd pos-kasir-alpiant

# Install dependencies
npm install

# Build untuk production
npm run tauri build

# Binary akan ada di:
# Linux: src-tauri/target/release/pos-kasir-alpiant
# Windows: src-tauri/target/release/pos-kasir-alpiant.exe
```

### Step 2: Install Application

```bash
# Linux
sudo cp src-tauri/target/release/pos-kasir-alpiant /opt/pos-kasir-alpiant/
sudo cp -r dist /opt/pos-kasir-alpiant/
cd /opt/pos-kasir-alpiant

# Create .env file
sudo nano .env
# (paste configuration dari atas)

# Set permissions
sudo chmod 600 .env
sudo chown -R $USER:$USER /opt/pos-kasir-alpiant/
```

### Step 3: Create Systemd Service (Linux)

```bash
sudo nano /etc/systemd/system/pos-kasir-alpiant.service
```

Isi dengan:

```ini
[Unit]
Description=POS Kasir Alpiant
After=network.target

[Service]
Type=simple
User=posuser
WorkingDirectory=/opt/pos-kasir-alpiant
EnvironmentFile=/opt/pos-kasir-alpiant/.env
ExecStart=/opt/pos-kasir-alpiant/pos-kasir-alpiant
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable dan start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable pos-kasir-alpiant
sudo systemctl start pos-kasir-alpiant
sudo systemctl status pos-kasir-alpiant
```

### Step 4: First Run Setup

1. Launch aplikasi
2. Buat admin user pertama
3. Konfigurasi payment gateway di Settings
4. Test connection ke Midtrans
5. Setup printer
6. Test print receipt

---

## Monitoring & Maintenance

### Health Check

Aplikasi menyediakan endpoint health check via command:

```rust
// Call dari frontend
invoke('get_health_status', { sessionToken })
```

Response:

```json
{
  "status": "healthy",
  "version": "0.1.0",
  "environment": "production",
  "database": {
    "status": "healthy",
    "pool_size": 10,
    "response_time_ms": 1.23
  },
  "timestamp": "2026-02-28 10:30:00"
}
```

### Backup Database

Manual backup:

```rust
invoke('create_backup', { sessionToken })
```

Auto backup script (cron job):

```bash
# /etc/cron.daily/pos-backup
#!/bin/bash
cd /opt/pos-kasir-alpiant
./pos-kasir-alpiant backup --output=/backups/pos-$(date +%Y%m%d).db
```

### Log Monitoring

Log files ada di:

```bash
# Linux
~/.local/share/pos-kasir-alpiant/logs/

# Windows
%APPDATA%\pos-kasir-alpiant\logs\
```

Log rotation otomatis (max 10MB per file, keep 5 files).

### Performance Monitoring

Monitor:

- Database size (should grow linearly with transactions)
- Log file size (auto-rotated)
- Memory usage (should be stable < 500MB)
- Response time (health check)

---

## Troubleshooting

### Issue: Aplikasi tidak bisa start

**Check logs:**

```bash
journalctl -u pos-kasir-alpiant -n 50
# atau
tail -f ~/.local/share/pos-kasir-alpiant/logs/app-*.log
```

**Common causes:**

1. `.env` file tidak ada atau permissions salah
2. Port sudah digunakan aplikasi lain
3. Database corrupt

### Issue: Payment gateway error

**Check:**

1. Server key valid di Midtrans dashboard
2. Koneksi internet aktif
3. QRIS feature enabled di Midtrans
4. Log file untuk detail error

### Issue: Printer tidak berfungsi

**Linux:**

```bash
# Check printer connected
lpstat -p

# Check user in lp group
groups $USER
# Jika tidak ada 'lp', tambahkan:
sudo usermod -aG lp $USER
# Logout dan login kembali
```

**Windows:**

1. Check printer installed dan default
2. Test print dari aplikasi lain
3. Restart print spooler service

### Issue: Database corrupt

**Recovery:**

1. Stop aplikasi
2. Restore dari backup terakhir
3. Start aplikasi
4. Verify data

---

## Support & Contact

Untuk bantuan lebih lanjut:

- Documentation: `/docs` folder
- Issues: GitHub Issues
- Email: support@example.com

---

## Changelog

### Version 0.1.0 (2026-02-28)

- ✅ Production-ready logging system
- ✅ Environment-based configuration
- ✅ Database connection pooling
- ✅ Enhanced encryption with key management
- ✅ Input validation and sanitization
- ✅ Rate limiting for API endpoints
- ✅ Comprehensive audit logging
- ✅ Automated backup system
- ✅ Health check endpoints
- ✅ Session management improvements

---

**Last Updated**: 2026-02-28
**Version**: 0.1.0
