import { useState, useCallback } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Download,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { ScrollArea } from "../../components/ui/scroll-area";
import { useAuthStore } from "../../store/authStore";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "../../hooks/use-toast";
import { invoke } from "../../lib/tauri";
import { BulkImportResult, CategoryWithCount } from "../../types";
import { useInvokeQuery } from "../../hooks/useInvokeQuery";
import * as XLSX from "xlsx";

interface ParsedRow {
  name: string;
  sku: string;
  barcode: string;
  category: string;
  price: number;
  cost_price: number;
  stock: number;
  valid: boolean;
  error?: string;
}

export function BulkImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [step, setStep] = useState<"upload" | "preview" | "result">("upload");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(
    null,
  );
  const [isImporting, setIsImporting] = useState(false);
  const [fileName, setFileName] = useState("");

  const sessionToken = useAuthStore((s) => s.sessionToken);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: categories } = useInvokeQuery<CategoryWithCount[]>(
    ["categories"],
    "get_categories",
    { sessionToken },
  );

  const resetState = useCallback(() => {
    setStep("upload");
    setParsedRows([]);
    setImportResult(null);
    setFileName("");
  }, []);

  const handleFileSelect = async () => {
    try {
      const selected = await openDialog({
        multiple: false,
        filters: [
          {
            name: "Spreadsheet",
            extensions: ["csv", "xlsx", "xls"],
          },
        ],
      });

      if (!selected) return;

      const filePath = selected as string;
      setFileName(filePath.split(/[\\/]/).pop() || "file");

      // Baca file via fetch (tauri asset protocol) atau langsung parse
      // Untuk Tauri, kita perlu baca file dari backend
      const response = await fetch(`asset://localhost/${filePath}`);

      let workbook: XLSX.WorkBook;

      if (filePath.endsWith(".csv") || filePath.endsWith(".CSV")) {
        const text = await response.text();
        workbook = XLSX.read(text, { type: "string" });
      } else {
        const buffer = await response.arrayBuffer();
        workbook = XLSX.read(buffer, { type: "array" });
      }

      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
        defval: "",
      });

      if (rawData.length === 0) {
        toast({
          variant: "destructive",
          title: "File Kosong",
          description: "File tidak berisi data produk.",
        });
        return;
      }

      // Map kolom (case-insensitive, support nama indo)
      const rows: ParsedRow[] = rawData.map((row) => {
        const get = (keys: string[]) => {
          for (const key of keys) {
            const found = Object.keys(row).find(
              (k) => k.toLowerCase().trim() === key.toLowerCase(),
            );
            if (found && row[found] !== "") return row[found];
          }
          return "";
        };

        const name = String(get(["name", "nama", "nama produk", "product"]));
        const sku = String(get(["sku"]));
        const barcode = String(get(["barcode", "kode"]));
        const category = String(get(["category", "kategori", "category_name"]));
        const price = Number(get(["price", "harga", "harga jual"])) || 0;
        const cost_price =
          Number(
            get(["cost_price", "hpp", "harga modal", "harga beli", "cost"]),
          ) || 0;
        const stock =
          Number(get(["stock", "stok", "qty", "quantity", "jumlah"])) || 0;

        let valid = true;
        let error: string | undefined;

        if (!name.trim()) {
          valid = false;
          error = "Nama kosong";
        } else if (price < 0) {
          valid = false;
          error = "Harga negatif";
        }

        return {
          name,
          sku,
          barcode,
          category,
          price,
          cost_price,
          stock,
          valid,
          error,
        };
      });

      setParsedRows(rows);
      setStep("preview");
    } catch (error) {
      console.error("File parse error:", error);
      toast({
        variant: "destructive",
        title: "Gagal Membaca File",
        description: String(error),
      });
    }
  };

  const handleImport = async () => {
    setIsImporting(true);
    try {
      const validRows = parsedRows.filter((r) => r.valid);

      // Map category names to IDs
      const categoryMap = new Map<string, number>();
      categories?.forEach((c) => categoryMap.set(c.name.toLowerCase(), c.id));

      const products = validRows.map((r) => ({
        name: r.name,
        sku: r.sku || null,
        barcode: r.barcode || null,
        category_id: categoryMap.get(r.category.toLowerCase()) || null,
        price: r.price,
        cost_price: r.cost_price,
        stock: r.stock,
        image_path: null,
      }));

      const result = await invoke<BulkImportResult>("bulk_import_products", {
        sessionToken,
        products,
      });

      setImportResult(result);
      setStep("result");
      queryClient.invalidateQueries({ queryKey: ["products"] });

      toast({
        title: "Import Selesai",
        description: `${result.success_count} produk berhasil, ${result.error_count} gagal`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Import Gagal",
        description: String(error),
      });
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = () => {
    const templateData = [
      ["Name", "SKU", "Barcode", "Category", "Price", "Cost_Price", "Stock"],
      ["Contoh Produk 1", "SKU001", "", "Makanan", "15000", "10000", "100"],
      ["Contoh Produk 2", "SKU002", "", "Minuman", "8000", "5000", "50"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    const csvContent = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", "template_import_produk.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const validCount = parsedRows.filter((r) => r.valid).length;
  const invalidCount = parsedRows.filter((r) => !r.valid).length;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetState();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Produk dari CSV/Excel
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-10 text-center">
              <Upload className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium mb-1">
                Pilih file CSV atau Excel
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                Format kolom: Name, SKU, Barcode, Category, Price, Cost_Price,
                Stock
              </p>
              <div className="flex gap-2">
                <Button onClick={handleFileSelect}>
                  <Upload className="h-4 w-4 mr-2" />
                  Pilih File
                </Button>
                <Button variant="outline" onClick={downloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <span className="font-medium">{fileName}</span> —{" "}
                {parsedRows.length} baris
              </div>
              <div className="flex gap-2">
                <Badge variant="default">{validCount} valid</Badge>
                {invalidCount > 0 && (
                  <Badge variant="destructive">{invalidCount} error</Badge>
                )}
              </div>
            </div>

            <ScrollArea className="max-h-[350px] border rounded-lg">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="p-2 text-left">#</th>
                    <th className="p-2 text-left">Nama</th>
                    <th className="p-2 text-left">SKU</th>
                    <th className="p-2 text-left">Kategori</th>
                    <th className="p-2 text-right">Harga</th>
                    <th className="p-2 text-right">HPP</th>
                    <th className="p-2 text-right">Stok</th>
                    <th className="p-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((row, i) => (
                    <tr
                      key={i}
                      className={
                        row.valid ? "" : "bg-destructive/10 text-destructive"
                      }
                    >
                      <td className="p-2">{i + 1}</td>
                      <td className="p-2 font-medium">{row.name || "-"}</td>
                      <td className="p-2">{row.sku || "-"}</td>
                      <td className="p-2">{row.category || "-"}</td>
                      <td className="p-2 text-right">
                        {row.price.toLocaleString("id-ID")}
                      </td>
                      <td className="p-2 text-right">
                        {row.cost_price.toLocaleString("id-ID")}
                      </td>
                      <td className="p-2 text-right">{row.stock}</td>
                      <td className="p-2">
                        {row.valid ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <span className="flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {row.error}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        )}

        {step === "result" && importResult && (
          <div className="space-y-4 py-4">
            <div className="text-center space-y-2">
              <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto" />
              <p className="font-bold text-lg">Import Selesai</p>
              <div className="flex justify-center gap-4 text-sm">
                <span className="text-green-600 font-medium">
                  ✓ {importResult.success_count} berhasil
                </span>
                {importResult.error_count > 0 && (
                  <span className="text-destructive font-medium">
                    ✗ {importResult.error_count} gagal
                  </span>
                )}
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <ScrollArea className="max-h-[200px] border rounded-lg p-3">
                <div className="space-y-1">
                  {importResult.errors.map((err, i) => (
                    <p key={i} className="text-xs text-destructive">
                      {err}
                    </p>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "upload" && (
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
          )}
          {step === "preview" && (
            <>
              <Button variant="ghost" onClick={resetState}>
                Kembali
              </Button>
              <Button
                onClick={handleImport}
                disabled={isImporting || validCount === 0}
              >
                {isImporting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Import {validCount} Produk
              </Button>
            </>
          )}
          {step === "result" && (
            <Button
              onClick={() => {
                resetState();
                onOpenChange(false);
              }}
            >
              Selesai
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
