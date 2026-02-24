use sqlx::SqlitePool;

/// Menjalankan semua migrasi database (CREATE TABLE IF NOT EXISTS + seed default settings).
pub async fn run_migrations(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    // ═══════════════════════════════════════
    // TABLE: users
    // ═══════════════════════════════════════
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS users (
            id              INTEGER  PRIMARY KEY AUTOINCREMENT,
            name            TEXT     NOT NULL,
            username        TEXT     NOT NULL UNIQUE,
            password_hash   TEXT     NOT NULL,
            role            TEXT     NOT NULL CHECK(role IN ('ADMIN', 'KASIR')),
            is_active       INTEGER  NOT NULL DEFAULT 1,
            created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_by      INTEGER  REFERENCES users(id) ON DELETE SET NULL,
            last_login_at   DATETIME
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)")
        .execute(pool)
        .await?;

    // ═══════════════════════════════════════
    // TABLE: categories
    // ═══════════════════════════════════════
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS categories (
            id   INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT    NOT NULL UNIQUE
        )",
    )
    .execute(pool)
    .await?;

    // ═══════════════════════════════════════
    // TABLE: products
    // ═══════════════════════════════════════
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS products (
            id          INTEGER  PRIMARY KEY AUTOINCREMENT,
            category_id INTEGER  REFERENCES categories(id) ON DELETE SET NULL,
            sku         TEXT,
            name        TEXT     NOT NULL,
            price       REAL     NOT NULL CHECK(price >= 0),
            stock       INTEGER  NOT NULL DEFAULT 0 CHECK(stock >= 0),
            barcode     TEXT,
            is_active   INTEGER  NOT NULL DEFAULT 1,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    // Partial unique indexes - hanya berlaku untuk produk aktif
    sqlx::query("CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku_active ON products(sku) WHERE sku IS NOT NULL AND is_active = 1")
        .execute(pool)
        .await?;

    sqlx::query("CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode_active ON products(barcode) WHERE barcode IS NOT NULL AND is_active = 1")
        .execute(pool)
        .await?;

    sqlx::query("CREATE UNIQUE INDEX IF NOT EXISTS idx_products_name_active ON products(name) WHERE is_active = 1")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)")
        .execute(pool)
        .await?;

    // ═══════════════════════════════════════
    // TABLE: discounts
    // ═══════════════════════════════════════
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS discounts (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            name         TEXT    NOT NULL,
            type         TEXT    NOT NULL CHECK(type IN ('NOMINAL', 'PERCENT')),
            value        REAL    NOT NULL CHECK(value > 0),
            min_purchase REAL    NOT NULL DEFAULT 0,
            is_active    INTEGER NOT NULL DEFAULT 1,
            created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    // ═══════════════════════════════════════
    // TABLE: transactions
    // ═══════════════════════════════════════
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS transactions (
            id               TEXT    PRIMARY KEY,
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
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_transactions_cashier ON transactions(cashier_id)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status)")
        .execute(pool)
        .await?;

    // ═══════════════════════════════════════
    // TABLE: transaction_items
    // ═══════════════════════════════════════
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS transaction_items (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            transaction_id TEXT    NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
            product_id     INTEGER NOT NULL REFERENCES products(id),
            quantity       INTEGER NOT NULL CHECK(quantity > 0),
            price_at_time  REAL    NOT NULL,
            subtotal       REAL    NOT NULL
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_tx_items_transaction ON transaction_items(transaction_id)",
    )
    .execute(pool)
    .await?;

    // ═══════════════════════════════════════
    // TABLE: settings (key-value store)
    // ═══════════════════════════════════════
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
    )
    .execute(pool)
    .await?;

    // ── Seed default settings (OR IGNORE = tidak timpa jika sudah ada) ──

    // Company Profile
    let default_settings: Vec<(&str, &str)> = vec![
        ("company.store_name", "Toko Saya"),
        ("company.address", ""),
        ("company.phone", ""),
        ("company.email", ""),
        ("company.website", ""),
        ("company.logo_path", ""),
        ("company.tax_number", ""),
        // Receipt
        ("receipt.show_logo", "1"),
        ("receipt.header_text", ""),
        ("receipt.footer_text", "Terima kasih telah berbelanja!"),
        ("receipt.show_cashier_name", "1"),
        ("receipt.show_tax_detail", "1"),
        ("receipt.show_discount_detail", "1"),
        ("receipt.paper_width", "80mm"),
        ("receipt.copies", "1"),
        // Tax
        ("tax.is_enabled", "0"),
        ("tax.rate", "11"),
        ("tax.label", "PPN"),
        ("tax.is_included", "0"),
        // App
        ("app.low_stock_threshold", "5"),
        ("app.printer_port", ""),
        ("app.timezone", "Asia/Jakarta"),
    ];

    for (key, value) in default_settings {
        sqlx::query("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)")
            .bind(key)
            .bind(value)
            .execute(pool)
            .await?;
    }

    // ═══════════════════════════════════════
    // MIGRASI: Kolom baru (ALTER TABLE — aman untuk data existing)
    // ═══════════════════════════════════════

    // Diskon per-item transaksi
    safe_add_column(
        pool,
        "transaction_items",
        "discount_amount",
        "REAL NOT NULL DEFAULT 0",
    )
    .await;

    // Gambar produk
    safe_add_column(pool, "products", "image_path", "TEXT DEFAULT ''").await;

    // Harga Pokok Penjualan (HPP)
    safe_add_column(pool, "products", "cost_price", "REAL NOT NULL DEFAULT 0").await;

    // Diskon otomatis
    safe_add_column(
        pool,
        "discounts",
        "is_automatic",
        "INTEGER NOT NULL DEFAULT 0",
    )
    .await;

    // ═══════════════════════════════════════
    // TABLE: activity_logs (Audit Trail)
    // ═══════════════════════════════════════
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS activity_logs (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
            action      TEXT    NOT NULL, -- 'LOGIN', 'CREATE_PRODUCT', 'VOID_TRANSACTION', etc.
            description TEXT    NOT NULL,
            metadata    TEXT,             -- JSON string for extra data
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    // ═══════════════════════════════════════
    // TABLE: stock_adjustments
    // ═══════════════════════════════════════
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS stock_adjustments (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            user_id     INTEGER NOT NULL REFERENCES users(id),
            type        TEXT    NOT NULL, -- 'IN' atau 'OUT'
            quantity    INTEGER NOT NULL,
            reason      TEXT    NOT NULL, -- 'SALE', 'RESTOCK', 'DAMAGE', 'ADJUSTMENT'
            notes       TEXT,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    // Fix unique constraints untuk existing database
    // Drop constraint lama dan ganti dengan partial unique indexes
    fix_unique_constraints(pool).await?;

    // ═══════════════════════════════════════
    // MIGRASI: QRIS Payment Tracking
    // ═══════════════════════════════════════

    // Tambah kolom ke transactions table
    safe_add_column(pool, "transactions", "qris_reference", "TEXT").await;
    safe_add_column(pool, "transactions", "payment_status", "TEXT DEFAULT 'COMPLETED'").await;

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
        )",
    )
    .execute(pool)
    .await?;

    Ok(())
}

/// Fix unique constraints pada products table untuk mendukung soft-delete
async fn fix_unique_constraints(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    // Drop indexes lama jika ada
    let _ = sqlx::query("DROP INDEX IF EXISTS idx_products_sku").execute(pool).await;
    let _ = sqlx::query("DROP INDEX IF EXISTS idx_products_barcode").execute(pool).await;
    let _ = sqlx::query("DROP INDEX IF EXISTS idx_products_name").execute(pool).await;
    
    // Buat partial unique indexes (hanya untuk produk aktif)
    sqlx::query("CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku_active ON products(sku) WHERE sku IS NOT NULL AND is_active = 1")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode_active ON products(barcode) WHERE barcode IS NOT NULL AND is_active = 1")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE UNIQUE INDEX IF NOT EXISTS idx_products_name_active ON products(name) WHERE is_active = 1")
        .execute(pool)
        .await?;
    
    Ok(())
}

/// Helper: ALTER TABLE ADD COLUMN yang aman (abaikan jika kolom sudah ada).
async fn safe_add_column(pool: &SqlitePool, table: &str, column: &str, col_type: &str) {
    let sql = format!("ALTER TABLE {} ADD COLUMN {} {}", table, column, col_type);
    match sqlx::query(&sql).execute(pool).await {
        Ok(_) => {}
        Err(e) => {
            let msg = e.to_string();
            // SQLite error jika kolom sudah ada: "duplicate column name"
            if !msg.contains("duplicate column") {
                eprintln!("Migration warning: {}", msg);
            }
        }
    }
}
