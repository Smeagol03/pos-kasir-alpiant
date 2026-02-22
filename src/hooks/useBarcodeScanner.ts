import { useEffect, useRef } from "react";

interface UseBarcodeScannerOptions {
    onScan: (barcode: string) => void;
    debounceTime?: number;
}

export function useBarcodeScanner({ onScan, debounceTime = 50 }: UseBarcodeScannerOptions) {
    const buffer = useRef<string>("");
    const timer = useRef<NodeJS.Timeout | NodeJS.Timer | null>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if user is typing in an input field or textarea
            const target = e.target as HTMLElement;
            if (
                target.tagName === "INPUT" ||
                target.tagName === "TEXTAREA" ||
                target.isContentEditable
            ) {
                return;
            }

            if (e.key === "Enter") {
                if (buffer.current.length > 0) {
                    onScan(buffer.current);
                    buffer.current = "";
                }
                return;
            }

            // Append standard printable characters
            if (e.key.length === 1) {
                buffer.current += e.key;

                // Clear buffer if it takes too long between keystrokes (human typing)
                if (timer.current) {
                    clearTimeout(timer.current as any);
                }
                timer.current = setTimeout(() => {
                    buffer.current = "";
                }, debounceTime); // Fast interval assumed for barcode scanners
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            if (timer.current) clearTimeout(timer.current as any);
        };
    }, [onScan, debounceTime]);
}
