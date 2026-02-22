import { useState } from "react";
import { SalesChart } from "../features/reports/SalesChart";
import { TopProducts } from "../features/reports/TopProducts";
import { ShiftSummary } from "../features/reports/ShiftSummary";
import { FinancialSummaryCards } from "../features/reports/FinancialSummaryCards";
import { PaymentMethodsChart } from "../features/reports/PaymentMethodsChart";
import { Button } from "../components/ui/button";
import { FileSpreadsheet, Download, Filter } from "lucide-react";
import { format, subDays, startOfMonth, startOfYesterday } from "date-fns";
import { useAuthStore } from "../store/authStore";
import { invoke } from "../lib/tauri";
import { FinancialSummary, ProductStat, ChartPoint } from "../types";
import { useToast } from "../hooks/use-toast";
import * as XLSX from "xlsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 7), "yyyy-MM-dd"),
    end: format(new Date(), "yyyy-MM-dd"),
  });
  const [rangeLabel, setRangeLabel] = useState("7d");
  const sessionToken = useAuthStore((s) => s.sessionToken);
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const handleRangeChange = (val: string) => {
    setRangeLabel(val);
    const end = new Date();
    let start = new Date();

    switch (val) {
      case "today":
        start = end;
        break;
      case "yesterday":
        start = startOfYesterday();
        break;
      case "7d":
        start = subDays(end, 7);
        break;
      case "30d":
        start = subDays(end, 30);
        break;
      case "thisMonth":
        start = startOfMonth(end);
        break;
      case "lastMonth":
        const lastMonth = subDays(startOfMonth(end), 1);
        start = startOfMonth(lastMonth);
        break;
    }

    setDateRange({
      start: format(start, "yyyy-MM-dd"),
      end: format(end, "yyyy-MM-dd"),
    });
  };

  const exportToExcel = async () => {
    setIsExporting(true);
    try {
      // Fetch all data for the range
      const [summary, topProducts, salesChart] = await Promise.all([
        invoke<FinancialSummary>("get_financial_summary", { 
          sessionToken, 
          startDate: dateRange.start, 
          endDate: dateRange.end 
        }),
        invoke<ProductStat[]>("get_top_products", { 
          sessionToken, 
          startDate: dateRange.start, 
          endDate: dateRange.end,
          limit: 50
        }),
        invoke<ChartPoint[]>("get_sales_chart", { 
          sessionToken, 
          startDate: dateRange.start, 
          endDate: dateRange.end 
        })
      ]);

      const wb = XLSX.utils.book_new();

      // 1. Summary Sheet
      const summaryData = [
        ["LAPORAN KEUANGAN RINGKAS"],
        ["Periode", `${dateRange.start} s/d ${dateRange.end}`],
        ["Dicetak Pada", format(new Date(), "yyyy-MM-dd HH:mm:ss")],
        [],
        ["KATEGORI", "JUMLAH"],
        ["Total Transaksi", summary.transaction_count],
        ["Pendapatan Kotor (Gross)", summary.gross_revenue],
        ["Total Pajak", summary.tax_total],
        ["Total Diskon", summary.discount_total],
        ["Pendapatan Bersih (Net)", summary.net_revenue],
        [],
        ["METODE PEMBAYARAN", "TOTAL"],
        ["Cash", summary.cash_total],
        ["Debit", summary.debit_total],
        ["QRIS", summary.qris_total],
        [],
        ["PEMBATALAN (VOID)", "JUMLAH"],
        ["Jumlah Void", summary.void_count],
        ["Total Nilai Void", summary.void_total]
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Ringkasan");

      // 2. Sales Trend Sheet
      const salesData = [
        ["TANGGAL", "PENDAPATAN", "JUMLAH TRANSAKSI"],
        ...salesChart.map(p => [p.date, p.revenue, p.count])
      ];
      const wsSales = XLSX.utils.aoa_to_sheet(salesData);
      XLSX.utils.book_append_sheet(wb, wsSales, "Tren Penjualan");

      // 3. Top Products Sheet
      const productsData = [
        ["NAMA PRODUK", "TOTAL TERJUAL", "TOTAL PENDAPATAN"],
        ...topProducts.map(p => [p.name, p.total_sold, p.total_revenue])
      ];
      const wsProducts = XLSX.utils.aoa_to_sheet(productsData);
      XLSX.utils.book_append_sheet(wb, wsProducts, "Produk Terlaris");

      // Save file
      const fileName = `Laporan_Keuangan_${dateRange.start}_${dateRange.end}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast({
        title: "Export Berhasil",
        description: `Laporan telah disimpan sebagai ${fileName}`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Export Gagal",
        description: String(error),
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto h-full flex flex-col bg-slate-50/30 dark:bg-transparent">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-primary">
            <FileSpreadsheet className="h-6 w-6" />
            <h1 className="text-3xl font-black tracking-tight uppercase">Laporan Keuangan</h1>
          </div>
          <p className="text-muted-foreground font-medium">
            Analisis performa bisnis dan arus kas periode {dateRange.start} s/d {dateRange.end}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1 rounded-lg border shadow-sm">
            <Select value={rangeLabel} onValueChange={handleRangeChange}>
              <SelectTrigger className="w-[180px] border-0 focus:ring-0">
                <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Pilih Periode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hari Ini</SelectItem>
                <SelectItem value="yesterday">Kemarin</SelectItem>
                <SelectItem value="7d">7 Hari Terakhir</SelectItem>
                <SelectItem value="30d">30 Hari Terakhir</SelectItem>
                <SelectItem value="thisMonth">Bulan Ini</SelectItem>
                <SelectItem value="lastMonth">Bulan Lalu</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button 
            onClick={exportToExcel} 
            disabled={isExporting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
          >
            {isExporting ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Export Excel
          </Button>
        </div>
      </div>

      <ShiftSummary />
      
      <FinancialSummaryCards 
        startDate={dateRange.start} 
        endDate={dateRange.end} 
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <SalesChart 
            startDate={dateRange.start} 
            endDate={dateRange.end} 
          />
          <PaymentMethodsChart 
            startDate={dateRange.start} 
            endDate={dateRange.end} 
          />
        </div>
        <div className="space-y-6">
          <TopProducts 
            startDate={dateRange.start} 
            endDate={dateRange.end} 
          />
        </div>
      </div>
    </div>
  );
}
