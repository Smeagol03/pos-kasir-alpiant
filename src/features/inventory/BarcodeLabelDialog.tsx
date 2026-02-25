import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { invoke } from "@tauri-apps/api/core";
import { ProductWithCategory } from "../../types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Printer, Plus, Minus, X, Zap } from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { useToast } from "../../hooks/use-toast";

interface BarcodeLabelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: ProductWithCategory[];
}

interface LabelItem {
  product: ProductWithCategory;
  qty: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

function BarcodeImage({
  value,
  width = 1.5,
  height = 40,
}: {
  value: string;
  width?: number;
  height?: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, {
          format:
            value.length === 13
              ? "EAN13"
              : value.length === 8
                ? "EAN8"
                : "CODE128",
          width,
          height,
          displayValue: true,
          fontSize: 12,
          margin: 2,
          textMargin: 2,
        });
      } catch {
        // Fallback if barcode format is invalid
        JsBarcode(svgRef.current, value, {
          format: "CODE128",
          width,
          height,
          displayValue: true,
          fontSize: 12,
          margin: 2,
          textMargin: 2,
        });
      }
    }
  }, [value, width, height]);

  return <svg ref={svgRef} />;
}

export function BarcodeLabelDialog({
  open,
  onOpenChange,
  products,
}: BarcodeLabelDialogProps) {
  const [labelItems, setLabelItems] = useState<LabelItem[]>([]);
  const [labelsPerRow, setLabelsPerRow] = useState(3);
  const [thermalPrinting, setThermalPrinting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const sessionToken = useAuthStore((s) => s.sessionToken);
  const { toast } = useToast();

  // Initialize items when products change
  useEffect(() => {
    if (products.length > 0) {
      setLabelItems(
        products.filter((p) => p.barcode).map((p) => ({ product: p, qty: 1 })),
      );
    }
  }, [products]);

  const updateQty = (index: number, delta: number) => {
    setLabelItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, qty: Math.max(1, item.qty + delta) } : item,
      ),
    );
  };

  const removeItem = (index: number) => {
    setLabelItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Generate flat list of labels based on qty
  const allLabels = labelItems.flatMap((item) =>
    Array.from({ length: item.qty }, () => item.product),
  );

  const noBarcode = products.filter((p) => !p.barcode);
  const totalLabels = allLabels.length;

  const handlePrint = () => {
    if (!printRef.current) return;

    const printContent = printRef.current.innerHTML;

    // Use iframe approach — works in Tauri webview
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.top = "-10000px";
    iframe.style.left = "-10000px";
    iframe.style.width = "210mm";
    iframe.style.height = "297mm";
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      return;
    }

    doc.open();
    doc.write(`
<!DOCTYPE html>
<html>
<head>
  <title>Cetak Label Barcode</title>
  <style>
    @page { size: A4; margin: 10mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; }
    .label-grid {
      display: grid;
      grid-template-columns: repeat(${labelsPerRow}, 1fr);
      gap: 2mm;
      width: 100%;
    }
    .label {
      border: 0.5px dashed #ccc;
      padding: 3mm;
      text-align: center;
      page-break-inside: avoid;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 30mm;
    }
    .label svg { max-width: 100%; height: auto; }
    @media print { .label { border: 0.5px dashed #ddd; } }
  </style>
</head>
<body>
  <div class="label-grid">${printContent}</div>
</body>
</html>`);
    doc.close();

    // Wait for content to render then print
    setTimeout(() => {
      iframe.contentWindow?.print();
      // Cleanup after print dialog closes
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Cetak Label Barcode
          </DialogTitle>
        </DialogHeader>

        {/* Settings */}
        <div className="flex items-center gap-4 py-2 border-b">
          <div className="flex items-center gap-2">
            <Label className="text-sm whitespace-nowrap">
              Kolom per baris:
            </Label>
            <Input
              type="number"
              min={1}
              max={5}
              value={labelsPerRow}
              onChange={(e) =>
                setLabelsPerRow(
                  Math.min(5, Math.max(1, parseInt(e.target.value) || 3)),
                )
              }
              className="w-16 h-8"
            />
          </div>
          <div className="text-sm text-muted-foreground">
            Total: <strong>{totalLabels}</strong> label
          </div>
        </div>

        {/* No barcode warning */}
        {noBarcode.length > 0 && (
          <div className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-md">
            ⚠️ {noBarcode.length} produk tidak punya barcode:{" "}
            {noBarcode.map((p) => p.name).join(", ")}. Generate barcode di form
            edit produk.
          </div>
        )}

        {/* Bulk qty control */}
        {labelItems.length > 1 && (
          <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-md">
            <Label className="text-sm whitespace-nowrap font-medium">
              Set semua:
            </Label>
            <Input
              type="number"
              min={1}
              max={100}
              placeholder="qty"
              className="w-20 h-8"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const val = parseInt((e.target as HTMLInputElement).value);
                  if (val > 0) {
                    setLabelItems((prev) =>
                      prev.map((item) => ({ ...item, qty: val })),
                    );
                    (e.target as HTMLInputElement).value = "";
                  }
                }
              }}
            />
            <span className="text-xs text-muted-foreground">
              ketik angka lalu Enter
            </span>
          </div>
        )}

        {/* Item list with qty */}
        {labelItems.length > 0 && (
          <div className="space-y-1 max-h-40 overflow-y-auto border rounded-md p-2">
            {labelItems.map((item, i) => (
              <div
                key={item.product.id}
                className="flex items-center justify-between text-sm py-1 px-2 hover:bg-muted/50 rounded"
              >
                <span className="font-medium truncate flex-1">
                  {item.product.name}
                </span>
                <span className="text-muted-foreground mx-2 text-xs">
                  {item.product.barcode}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => updateQty(i, -1)}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={item.qty}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1;
                      setLabelItems((prev) =>
                        prev.map((it, idx) =>
                          idx === i ? { ...it, qty: Math.max(1, val) } : it,
                        ),
                      );
                    }}
                    className="w-14 h-6 text-center text-sm p-0"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => updateQty(i, 1)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive"
                    onClick={() => removeItem(i)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Preview */}
        {allLabels.length > 0 && (
          <div className="border rounded-lg p-4 bg-white dark:bg-gray-950">
            <p className="text-xs text-muted-foreground mb-2">
              Preview (kertas A4):
            </p>
            <div
              ref={printRef}
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${labelsPerRow}, 1fr)`,
                gap: "2mm",
              }}
            >
              {allLabels.map((product, i) => (
                <div
                  key={`${product.id}-${i}`}
                  style={{
                    border: "0.5px dashed #ccc",
                    padding: "3mm",
                    textAlign: "center",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  className="label"
                >
                  <div
                    style={{
                      fontSize: "9pt",
                      fontWeight: "bold",
                      marginBottom: "1mm",
                      lineHeight: 1.2,
                    }}
                  >
                    {product.name}
                  </div>
                  <div
                    style={{
                      fontSize: "10pt",
                      fontWeight: "bold",
                      marginBottom: "2mm",
                      color: "#333",
                    }}
                  >
                    {formatCurrency(product.price)}
                  </div>
                  {product.barcode && (
                    <BarcodeImage
                      value={product.barcode}
                      width={labelsPerRow >= 4 ? 1 : 1.5}
                      height={labelsPerRow >= 4 ? 30 : 40}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {allLabels.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Tidak ada produk dengan barcode untuk dicetak.
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            variant="secondary"
            disabled={allLabels.length === 0 || thermalPrinting}
            onClick={async () => {
              setThermalPrinting(true);
              try {
                const labels = labelItems.map((item) => ({
                  name: item.product.name,
                  price: item.product.price,
                  barcode: item.product.barcode || "",
                  qty: item.qty,
                }));
                await invoke("print_barcode_labels", { sessionToken, labels });
                toast({
                  title: "Berhasil",
                  description: `${totalLabels} label barcode terkirim ke printer thermal`,
                });
              } catch (e) {
                toast({
                  variant: "destructive",
                  title: "Gagal",
                  description: String(e),
                });
              } finally {
                setThermalPrinting(false);
              }
            }}
          >
            <Zap className="mr-2 h-4 w-4" />
            {thermalPrinting ? "Mengirim..." : `Thermal (${totalLabels})`}
          </Button>
          <Button onClick={handlePrint} disabled={allLabels.length === 0}>
            <Printer className="mr-2 h-4 w-4" />
            Cetak A4 ({totalLabels})
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
