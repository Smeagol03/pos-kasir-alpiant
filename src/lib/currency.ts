/**
 * Formats a number to Indonesian Rupiah (IDR).
 * @param amount - The number to format.
 * @returns The formatted currency string.
 */
export function formatRupiah(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

/**
 * Parses a currency string back to a number.
 * @param value - The currency string (e.g. "Rp 150.000").
 * @returns The numeric value.
 */
export function parseCurrency(value: string): number {
    const parsed = Number(value.replace(/[^0-9.-]+/g, ""));
    return isNaN(parsed) ? 0 : parsed;
}
