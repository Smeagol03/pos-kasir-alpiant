export type Role = "ADMIN" | "KASIR";
export type PaymentMethod = "CASH" | "DEBIT" | "QRIS";
export type TransactionStatus = "COMPLETED" | "VOID";
export type DiscountType = "NOMINAL" | "PERCENT";

export interface LoginResult {
    user: {
        id: number;
        name: string;
        username: string;
        role: Role;
    };
    session_token: string;
    login_at: string;
}

export interface AuthUserData {
    id: number;
    name: string;
    username: string;
    role: Role;
}

export interface User {
    id: number;
    name: string;
    username: string;
    role: Role;
    is_active: boolean;
    created_at: string | null;
    last_login_at: string | null;
}

export interface ProductWithCategory {
    id: number;
    category_id: number | null;
    category_name: string | null;
    sku: string | null;
    name: string;
    price: number;
    cost_price: number;
    stock: number;
    barcode: string | null;
    image_path: string | null;
    is_active: boolean;
}

export interface Product {
    id: number;
    category_id: number | null;
    sku: string | null;
    name: string;
    price: number;
    cost_price: number;
    stock: number;
    barcode: string | null;
    is_active: boolean;
    created_at: string | null;
    updated_at: string | null;
}

export interface Category {
    id: number;
    name: string;
}

export interface CategoryWithCount {
    id: number;
    name: string;
    product_count: number;
}

export interface Discount {
    id: number;
    name: string;
    type: DiscountType;
    value: number;
    min_purchase: number;
    is_automatic: boolean;
    is_active: boolean;
    created_at: string | null;
}

export interface Transaction {
    id: string;
    cashier_id: number;
    timestamp: string | null;
    total_amount: number;
    discount_id: number | null;
    discount_amount: number;
    tax_amount: number;
    payment_method: PaymentMethod;
    amount_paid: number;
    change_given: number;
    status: TransactionStatus;
    voided_by: number | null;
    voided_at: string | null;
    notes: string | null;
}

export interface TransactionWithCashier extends Transaction {
    cashier_name: string;
}

export interface TransactionItemWithProduct {
    id: number;
    transaction_id: string;
    product_id: number;
    product_name: string;
    quantity: number;
    price_at_time: number;
    subtotal: number;
}

export interface TransactionDetail {
    transaction: TransactionWithCashier;
    items: TransactionItemWithProduct[];
}

export interface PaginatedTransactions {
    data: TransactionWithCashier[];
    total: number;
    page: number;
    per_page: number;
}

export interface FinancialSummary {
    start_date: string;
    end_date: string;
    gross_revenue: number;
    net_revenue: number;
    tax_total: number;
    discount_total: number;
    transaction_count: number;
    cash_total: number;
    debit_total: number;
    qris_total: number;
    void_count: number;
    void_total: number;
}

export interface DailyReport {
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

export interface ChartPoint {
    date: string;
    revenue: number;
    count: number;
}

export interface ProductStat {
    product_id: number;
    name: string;
    total_sold: number;
    total_revenue: number;
}

export interface ShiftSummary {
    cashier_name: string;
    login_at: string;
    transaction_count: number;
    total_revenue: number;
}

export interface ActivityLog {
    id: number;
    user_id: number | null;
    user_name: string | null;
    action: string;
    description: string;
    metadata: string | null;
    created_at: string | null;
}

export interface StockAdjustment {
    id: number;
    product_id: number;
    product_name: string;
    user_id: number;
    user_name: string;
    type: "IN" | "OUT";
    quantity: number;
    reason: string;
    notes: string | null;
    created_at: string | null;
}

export interface AppSettings {
    company: {
        store_name: string;
        address: string;
        phone: string;
        email: string;
        website: string;
        logo_path: string;
        tax_number: string;
    };
    receipt: {
        show_logo: boolean;
        header_text: string;
        footer_text: string;
        show_cashier_name: boolean;
        show_tax_detail: boolean;
        show_discount_detail: boolean;
        paper_width: "58mm" | "80mm";
        copies: number;
    };
    tax: {
        is_enabled: boolean;
        rate: number;
        label: string;
        is_included: boolean;
    };
    low_stock_threshold: number;
    printer_port: string;
    timezone: string;
}

export interface CreateTransactionPayload {
    items: Array<{
        product_id: number;
        quantity: number;
        price_at_time: number;
        discount_amount: number;
    }>;
    discount_id: number | null;
    discount_amount: number;
    payment_method: PaymentMethod;
    amount_paid: number;
    notes?: string;
}

export interface ProfitReport {
    total_cost: number;
    gross_profit: number;
    profit_margin: number;
}

export interface BulkImportResult {
    success_count: number;
    error_count: number;
    errors: string[];
}

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
