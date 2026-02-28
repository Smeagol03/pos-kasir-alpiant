//! Input validation and sanitization module
//! 
//! This module provides centralized input validation for:
//! - User input (names, emails, phone numbers)
//! - Financial data (amounts, quantities)
//! - API parameters
//! - File paths

/// Validation result type
pub type ValidationResult = Result<(), String>;

/// Validate a username
/// - Length: 3-50 characters
/// - Allowed: alphanumeric, underscore, hyphen
/// - Must start with letter
pub fn validate_username(username: &str) -> ValidationResult {
    let trimmed = username.trim();
    
    if trimmed.is_empty() {
        return Err("Username tidak boleh kosong".into());
    }
    
    if trimmed.len() < 3 || trimmed.len() > 50 {
        return Err("Username harus 3-50 karakter".into());
    }
    
    if !trimmed.chars().next().unwrap().is_alphabetic() {
        return Err("Username harus dimulai dengan huruf".into());
    }
    
    if !trimmed.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '-') {
        return Err("Username hanya boleh berisi huruf, angka, underscore, dan hyphen".into());
    }
    
    Ok(())
}

/// Validate a full name
/// - Length: 2-100 characters
/// - Allowed: letters, spaces, basic punctuation
pub fn validate_name(name: &str) -> ValidationResult {
    let trimmed = name.trim();
    
    if trimmed.is_empty() {
        return Err("Nama tidak boleh kosong".into());
    }
    
    if trimmed.len() < 2 || trimmed.len() > 100 {
        return Err("Nama harus 2-100 karakter".into());
    }
    
    // Allow letters, spaces, and basic punctuation
    if !trimmed.chars().all(|c| c.is_alphabetic() || c.is_whitespace() || ".-'".contains(c)) {
        return Err("Nama hanya boleh berisi huruf, spasi, dan karakter .-'".into());
    }
    
    Ok(())
}

/// Validate email format
pub fn validate_email(email: &str) -> ValidationResult {
    let trimmed = email.trim();
    
    if trimmed.is_empty() {
        return Err("Email tidak boleh kosong".into());
    }
    
    if trimmed.len() > 254 {
        return Err("Email terlalu panjang (max 254 karakter)".into());
    }
    
    // Basic email validation
    if !trimmed.contains('@') {
        return Err("Email harus berisi '@'".into());
    }
    
    let parts: Vec<&str> = trimmed.split('@').collect();
    if parts.len() != 2 {
        return Err("Format email tidak valid".into());
    }
    
    let (local, domain) = (parts[0], parts[1]);
    
    if local.is_empty() || local.len() > 64 {
        return Err("Bagian lokal email tidak valid".into());
    }
    
    if !domain.contains('.') {
        return Err("Domain email tidak valid".into());
    }
    
    Ok(())
}

/// Validate phone number (Indonesian format)
pub fn validate_phone(phone: &str) -> ValidationResult {
    let trimmed = phone.trim();
    
    if trimmed.is_empty() {
        return Err("Nomor telepon tidak boleh kosong".into());
    }
    
    // Remove common prefixes and separators
    let cleaned: String = trimmed
        .chars()
        .filter(|c| c.is_numeric() || "+- ".contains(*c))
        .collect();
    
    // Indonesian phone numbers: 8-15 digits
    let digits: String = cleaned.chars().filter(|c| c.is_numeric()).collect();
    
    if digits.len() < 8 || digits.len() > 15 {
        return Err("Nomor telepon harus 8-15 digit".into());
    }
    
    Ok(())
}

/// Validate password strength
/// - Minimum length: 8 characters
/// - Must contain: uppercase, lowercase, number
pub fn validate_password(password: &str) -> ValidationResult {
    if password.is_empty() {
        return Err("Password tidak boleh kosong".into());
    }
    
    if password.len() < 8 {
        return Err("Password minimal 8 karakter".into());
    }
    
    if password.len() > 128 {
        return Err("Password maksimal 128 karakter".into());
    }
    
    let has_upper = password.chars().any(|c| c.is_uppercase());
    let has_lower = password.chars().any(|c| c.is_lowercase());
    let has_digit = password.chars().any(|c| c.is_numeric());
    
    if !has_upper || !has_lower || !has_digit {
        return Err("Password harus mengandung huruf kapital, huruf kecil, dan angka".into());
    }
    
    Ok(())
}

/// Validate monetary amount
/// - Must be positive
/// - Maximum: 1 billion (adjustable)
pub fn validate_amount(amount: f64, min: Option<f64>, max: Option<f64>) -> ValidationResult {
    if amount.is_nan() || amount.is_infinite() {
        return Err("Jumlah tidak valid".into());
    }
    
    let min_val = min.unwrap_or(0.0);
    let max_val = max.unwrap_or(1_000_000_000.0);
    
    if amount < min_val {
        return Err(format!("Jumlah minimal {}", format_currency(min_val)).into());
    }
    
    if amount > max_val {
        return Err(format!("Jumlah maksimal {}", format_currency(max_val)).into());
    }
    
    Ok(())
}

/// Validate quantity (for products)
pub fn validate_quantity(qty: i64, min: Option<i64>, max: Option<i64>) -> ValidationResult {
    if qty < 0 {
        return Err("Jumlah tidak boleh negatif".into());
    }
    
    let min_val = min.unwrap_or(0);
    let max_val = max.unwrap_or(1_000_000);
    
    if qty < min_val {
        return Err(format!("Jumlah minimal {}", min_val).into());
    }
    
    if qty > max_val {
        return Err(format!("Jumlah maksimal {}", max_val).into());
    }
    
    Ok(())
}

/// Validate product name
pub fn validate_product_name(name: &str) -> ValidationResult {
    let trimmed = name.trim();
    
    if trimmed.is_empty() {
        return Err("Nama produk tidak boleh kosong".into());
    }
    
    if trimmed.len() < 2 || trimmed.len() > 200 {
        return Err("Nama produk harus 2-200 karakter".into());
    }
    
    Ok(())
}

/// Validate SKU (Stock Keeping Unit)
pub fn validate_sku(sku: &str) -> ValidationResult {
    if sku.is_empty() {
        return Ok(()); // SKU is optional
    }
    
    let trimmed = sku.trim();
    
    if trimmed.len() > 50 {
        return Err("SKU maksimal 50 karakter".into());
    }
    
    if !trimmed.chars().all(|c| c.is_alphanumeric() || "-_.".contains(c)) {
        return Err("SKU hanya boleh berisi huruf, angka, dan karakter -_.".into());
    }
    
    Ok(())
}

/// Validate barcode
pub fn validate_barcode(barcode: &str) -> ValidationResult {
    if barcode.is_empty() {
        return Ok(()); // Barcode is optional
    }
    
    let trimmed = barcode.trim();
    
    if trimmed.len() > 50 {
        return Err("Barcode terlalu panjang (max 50 karakter)".into());
    }
    
    // Barcode should be alphanumeric
    if !trimmed.chars().all(|c| c.is_alphanumeric()) {
        return Err("Barcode hanya boleh berisi huruf dan angka".into());
    }
    
    Ok(())
}

/// Validate file path (security check)
pub fn validate_file_path(path: &str) -> ValidationResult {
    if path.is_empty() {
        return Err("Path file tidak boleh kosong".into());
    }
    
    // Prevent path traversal attacks
    if path.contains("..") {
        return Err("Path file tidak valid".into());
    }
    
    // Check for null bytes
    if path.contains('\0') {
        return Err("Path file tidak valid".into());
    }
    
    Ok(())
}

/// Validate and sanitize file path
pub fn sanitize_file_path(path: &str) -> String {
    // Remove null bytes
    let sanitized = path.replace('\0', "");
    
    // Remove path traversal attempts
    let sanitized = sanitized.replace("..", "");
    
    // Trim whitespace
    sanitized.trim().to_string()
}

/// Sanitize string input (remove potentially dangerous characters)
pub fn sanitize_string(input: &str) -> String {
    input
        .chars()
        .filter(|c| !c.is_control())
        .collect()
}

/// Format currency for error messages
fn format_currency(amount: f64) -> String {
    format!("Rp {:>width$.0}", amount, width = 0)
}

/// Validate order ID format
pub fn validate_order_id(order_id: &str) -> ValidationResult {
    if order_id.is_empty() {
        return Err("Order ID tidak boleh kosong".into());
    }
    
    if order_id.len() > 100 {
        return Err("Order ID terlalu panjang".into());
    }
    
    // Order ID should be alphanumeric with hyphens
    if !order_id.chars().all(|c| c.is_alphanumeric() || c == '-') {
        return Err("Order ID hanya boleh berisi huruf, angka, dan hyphen".into());
    }
    
    Ok(())
}

/// Validate transaction notes
pub fn validate_notes(notes: &str) -> ValidationResult {
    if notes.is_empty() {
        return Ok(()); // Notes is optional
    }
    
    if notes.len() > 500 {
        return Err("Catatan terlalu panjang (max 500 karakter)".into());
    }
    
    Ok(())
}

/// Combined validation for creating a product
pub struct CreateProductValidation {
    pub name: String,
    pub price: f64,
    pub cost_price: f64,
    pub stock: i64,
    pub sku: Option<String>,
    pub barcode: Option<String>,
}

pub fn validate_create_product(data: CreateProductValidation) -> Result<CreateProductValidation, String> {
    validate_product_name(&data.name)?;
    validate_amount(data.price, Some(0.0), None)?;
    validate_amount(data.cost_price, Some(0.0), None)?;
    validate_quantity(data.stock, None, None)?;
    
    if let Some(ref sku) = data.sku {
        validate_sku(sku)?;
    }
    
    if let Some(ref barcode) = data.barcode {
        validate_barcode(barcode)?;
    }
    
    Ok(data)
}
