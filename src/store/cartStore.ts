// src/store/cartStore.ts
import { create } from "zustand";

export interface CartItem {
    product_id: number;
    product_name: string;
    price: number;
    quantity: number;
    discount_amount: number;
}

interface CartState {
    items: CartItem[];
    // Discount state
    discount_id: number | null;
    discount_name: string | null;
    discount_amount: number;
    discount_percent: number | null;
    manual_discount_applied: boolean;

    // Tax state
    tax_rate: number;
    tax_included: boolean;
    tax_label: string;
    tax_enabled: boolean;

    addItem: (item: CartItem) => void;
    updateQuantity: (product_id: number, delta: number) => void;
    setQuantity: (product_id: number, quantity: number) => void;
    removeItem: (product_id: number) => void;
    setItemDiscount: (product_id: number, discount_amount: number) => void;

    setDiscount: (id: number | null, name: string | null, amount: number, percent?: number | null, isManual?: boolean) => void;
    setTaxConfig: (rate: number, included: boolean, label: string, enabled: boolean) => void;
    clearCart: () => void;

    getSubtotal: () => number;
    getDiscountAmount: () => number;
    getTaxableAmount: () => number;
    getTaxAmount: () => number;
    getTotal: () => number;
}

export const useCartStore = create<CartState>()((set, get) => ({
    items: [],
    discount_id: null,
    discount_name: null,
    discount_amount: 0,
    discount_percent: null,
    manual_discount_applied: false,

    tax_rate: 0,
    tax_included: false,
    tax_label: "PPN",
    tax_enabled: false,

    addItem: (newItem) =>
        set((state) => {
            const existing = state.items.find((i) => i.product_id === newItem.product_id);
            if (existing) {
                return {
                    items: state.items.map((i) =>
                        i.product_id === newItem.product_id
                            ? { ...i, quantity: i.quantity + newItem.quantity }
                            : i
                    ),
                };
            }
            return { items: [...state.items, { ...newItem, discount_amount: newItem.discount_amount || 0 }] };
        }),

    updateQuantity: (product_id, delta) =>
        set((state) => ({
            items: state.items.map((i) =>
                i.product_id === product_id
                    ? { ...i, quantity: Math.max(1, i.quantity + delta) }
                    : i
            ),
        })),

    setQuantity: (product_id, quantity) =>
        set((state) => ({
            items: state.items.map((i) =>
                i.product_id === product_id
                    ? { ...i, quantity: Math.max(1, quantity) }
                    : i
            ),
        })),

    setItemDiscount: (product_id, discount_amount) =>
        set((state) => ({
            items: state.items.map((i) =>
                i.product_id === product_id
                    ? { ...i, discount_amount: Math.max(0, discount_amount) }
                    : i
            ),
        })),

    removeItem: (product_id) =>
        set((state) => ({
            items: state.items.filter((i) => i.product_id !== product_id),
        })),

    setDiscount: (id, name, amount, percent = null, isManual = false) =>
        set({
            discount_id: id,
            discount_name: name,
            discount_amount: amount,
            discount_percent: percent,
            manual_discount_applied: isManual,
        }),

    setTaxConfig: (rate, included, label, enabled) =>
        set({
            tax_rate: rate,
            tax_included: included,
            tax_label: label,
            tax_enabled: enabled,
        }),

    clearCart: () =>
        set({
            items: [],
            discount_id: null,
            discount_name: null,
            discount_amount: 0,
            discount_percent: null,
            manual_discount_applied: false,
        }),

    getSubtotal: () => {
        const { items } = get();
        return items.reduce((sum, item) => sum + (item.price * item.quantity) - (item.discount_amount || 0), 0);
    },

    getDiscountAmount: () => {
        const state = get();
        const subtotal = state.getSubtotal();
        if (state.discount_percent !== null) {
            return subtotal * (state.discount_percent / 100);
        }
        return state.discount_amount;
    },

    getTaxableAmount: () => {
        const state = get();
        const subtotal = state.getSubtotal();
        const discount = state.getDiscountAmount();
        return Math.max(0, subtotal - discount);
    },

    getTaxAmount: () => {
        const state = get();
        if (!state.tax_enabled || state.tax_rate <= 0) return 0;

        const taxableAmount = state.getTaxableAmount();

        if (state.tax_included) {
            return taxableAmount - taxableAmount / (1 + state.tax_rate / 100);
        } else {
            return taxableAmount * (state.tax_rate / 100);
        }
    },

    getTotal: () => {
        const state = get();
        const taxableAmount = state.getTaxableAmount();

        if (!state.tax_enabled || state.tax_rate <= 0 || state.tax_included) {
            return taxableAmount;
        } else {
            const tax = taxableAmount * (state.tax_rate / 100);
            return taxableAmount + tax;
        }
    },
}));
