// src/store/cartStore.ts
import { create } from "zustand";

export interface CartItem {
    product_id: number;
    product_name: string;
    price: number;
    quantity: number;
}

interface CartState {
    items: CartItem[];
    discount_id: number | null;
    discount_amount: number;
    discount_percent: number | null;
    tax_rate: number;
    tax_included: boolean;

    addItem: (item: CartItem) => void;
    updateQuantity: (product_id: number, delta: number) => void;
    setQuantity: (product_id: number, quantity: number) => void;
    removeItem: (product_id: number) => void;

    setDiscount: (id: number | null, amount: number, percent?: number | null) => void;
    setTaxConfig: (rate: number, included: boolean) => void;
    clearCart: () => void;

    getSubtotal: () => number;
    getTaxAmount: () => number;
    getTotal: () => number;
}

export const useCartStore = create<CartState>()((set, get) => ({
    items: [],
    discount_id: null,
    discount_amount: 0,
    discount_percent: null,
    tax_rate: 0,
    tax_included: false,

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
            return { items: [...state.items, newItem] };
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

    removeItem: (product_id) =>
        set((state) => ({
            items: state.items.filter((i) => i.product_id !== product_id),
        })),

    setDiscount: (id, amount, percent = null) =>
        set({
            discount_id: id,
            discount_amount: amount,
            discount_percent: percent,
        }),

    setTaxConfig: (rate, included) =>
        set({
            tax_rate: rate,
            tax_included: included,
        }),

    clearCart: () =>
        set({
            items: [],
            discount_id: null,
            discount_amount: 0,
            discount_percent: null,
        }),

    getSubtotal: () => {
        const { items } = get();
        return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    },

    getTaxAmount: () => {
        const state = get();
        const subtotal = state.getSubtotal();

        let actualDiscount = state.discount_amount;
        if (state.discount_percent !== null) {
            actualDiscount = subtotal * (state.discount_percent / 100);
        }

        const taxableAmount = Math.max(0, subtotal - actualDiscount);

        if (state.tax_included) {
            return taxableAmount - taxableAmount / (1 + state.tax_rate / 100);
        } else {
            return taxableAmount * (state.tax_rate / 100);
        }
    },

    getTotal: () => {
        const state = get();
        const subtotal = state.getSubtotal();

        let actualDiscount = state.discount_amount;
        if (state.discount_percent !== null) {
            actualDiscount = subtotal * (state.discount_percent / 100);
        }

        const afterDiscount = Math.max(0, subtotal - actualDiscount);

        if (state.tax_included) {
            return afterDiscount;
        } else {
            const tax = afterDiscount * (state.tax_rate / 100);
            return afterDiscount + tax;
        }
    },
}));
