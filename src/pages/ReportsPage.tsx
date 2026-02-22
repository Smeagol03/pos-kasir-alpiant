import { useState } from "react";
import { SalesChart } from "../features/reports/SalesChart";
import { TopProducts } from "../features/reports/TopProducts";
import { ShiftSummary } from "../features/reports/ShiftSummary";
import { FinancialSummaryCards } from "../features/reports/FinancialSummaryCards";
import { PaymentMethodsChart } from "../features/reports/PaymentMethodsChart";
import { TransactionHistory } from "../features/reports/TransactionHistory";
import { AuditTrail } from "../features/reports/AuditTrail";
import { StockRestockHistory } from "../features/reports/StockRestockHistory";
import { Button } from "../components/ui/button";
import { FileText, Download, Filter, BarChart3, History, PackageSearch } from "lucide-react";
import { format, subDays, startOfMonth, startOfYesterday } from "date-fns";
import { useAuthStore } from "../store/authStore";
import { invoke } from "../lib/tauri";
import { FinancialSummary, ProductStat, PaginatedTransactions } from "../types";
import { useToast } from "../hooks/use-toast";
import * as XLSX from "xlsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Input } from "../components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";

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
    if (val === "custom") return;

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

  const exportToCSV = async () => {
    setIsExporting(true);
    try {
      const [summary, topProducts, allTransactions] = await Promise.all([
        invoke<FinancialSummary>("get_financial_summary", { 
          sessionToken, 
          startDate: dateRange.start, 
          endDate: dateRange.end 
        }),
        invoke<ProductStat[]>("get_top_products", { 
          sessionToken, 
          startDate: dateRange.start, 
          endDate: dateRange.end,
          limit: 500
        }),
        invoke<PaginatedTransactions>("get_transactions", {
          sessionToken,
          startDate: dateRange.start,
          endDate: dateRange.end,
          page: 1 
        })
      ]);

      const combinedData = [
        ["LAPORAN KEUANGAN KASIR PRO"],
        ["Periode", `${dateRange.start} s/d ${dateRange.end}`],
        ["Waktu Export", format(new Date(), "yyyy-MM-dd HH:mm:ss")],
        [],
        ["--- RINGKASAN KEUANGAN ---"],
        ["Kategori", "Nilai"],
        ["Total Transaksi", summary.transaction_count],
        ["Pendapatan Kotor", Math.round(summary.gross_revenue)],
        ["Total Pajak", Math.round(summary.tax_total)],
        ["Total Diskon", Math.round(summary.discount_total)],
        ["Pendapatan Bersih", Math.round(summary.net_revenue)],
        ["Total Cash", Math.round(summary.cash_total)],
        ["Total Debit", Math.round(summary.debit_total)],
        ["Total QRIS", Math.round(summary.qris_total)],
        ["Total Void (Pembatalan)", Math.round(summary.void_total)],
        [],
        ["--- DAFTAR TRANSAKSI ---"],
        ["WAKTU", "ID TRANSAKSI", "KASIR", "METODE", "TOTAL", "STATUS"],
        ...allTransactions.data.map(t => [
          t.timestamp, 
          t.id, 
          t.cashier_name, 
          t.payment_method, 
          Math.round(t.total_amount), 
          t.status
        ]),
        [],
        ["--- PRODUK TERLARIS ---"],
        ["Nama Produk", "Jumlah Terjual", "Total Omzet"],
        ...topProducts.map(p => [p.name, p.total_sold, Math.round(p.total_revenue)])
      ];

      const ws = XLSX.utils.aoa_to_sheet(combinedData);
      const csvContent = XLSX.utils.sheet_to_csv(ws);
      
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      const fileName = `Laporan_${dateRange.start}_${dateRange.end}.csv`;
      
      link.setAttribute("href", url);
      link.setAttribute("download", fileName);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Export CSV Berhasil",
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
    <div className="p-6 max-w-7xl mx-auto h-full flex flex-col bg-slate-50/30 dark:bg-transparent overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 shrink-0">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-primary">
            <FileText className="h-6 w-6" />
            <h1 className="text-3xl font-black tracking-tight uppercase text-slate-900 dark:text-white">Analytics & Laporan</h1>
          </div>
          <p className="text-muted-foreground font-medium text-sm">
            Pantau performa bisnis, audit stok, dan riwayat aktivitas sistem.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-xl border shadow-sm">
            <Select value={rangeLabel} onValueChange={handleRangeChange}>
              <SelectTrigger className="w-[140px] border-0 focus:ring-0 h-8 text-xs font-bold uppercase">
                <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Periode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hari Ini</SelectItem>
                <SelectItem value="yesterday">Kemarin</SelectItem>
                <SelectItem value="7d">7 Hari</SelectItem>
                <SelectItem value="30d">30 Hari</SelectItem>
                <SelectItem value="thisMonth">Bulan Ini</SelectItem>
                <SelectItem value="lastMonth">Bulan Lalu</SelectItem>
                <SelectItem value="custom">Kustom Tanggal</SelectItem>
              </SelectContent>
            </Select>

            {rangeLabel === "custom" && (
              <div className="flex items-center gap-2 px-2 border-l ml-1">
                <Input 
                  type="date" 
                  className="h-8 w-32 text-[10px] border-0 focus-visible:ring-0 p-0" 
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                />
                <span className="text-muted-foreground text-[10px] font-bold">S/D</span>
                <Input 
                  type="date" 
                  className="h-8 w-32 text-[10px] border-0 focus-visible:ring-0 p-0" 
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                />
              </div>
            )}
          </div>

          <Button 
            onClick={exportToCSV} 
            disabled={isExporting}
            className="bg-slate-900 dark:bg-white dark:text-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl h-11"
          >
            {isExporting ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            EXPORT CSV
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 mt-6 pr-1">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-white dark:bg-slate-900 p-1 rounded-xl border shadow-sm shrink-0">
            <TabsTrigger value="overview" className="rounded-lg px-6 gap-2 font-bold text-xs uppercase transition-all">
              <BarChart3 className="h-3.5 w-3.5" /> Ringkasan
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-lg px-6 gap-2 font-bold text-xs uppercase transition-all">
              <History className="h-3.5 w-3.5" /> Transaksi
            </TabsTrigger>
            <TabsTrigger value="inventory" className="rounded-lg px-6 gap-2 font-bold text-xs uppercase transition-all">
              <PackageSearch className="h-3.5 w-3.5" /> Audit Stok
            </TabsTrigger>
            <TabsTrigger value="audit" className="rounded-lg px-6 gap-2 font-bold text-xs uppercase transition-all">
              <History className="h-3.5 w-3.5" /> Log Aktivitas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-0">
            <ShiftSummary />
            <FinancialSummaryCards 
              startDate={dateRange.start} 
              endDate={dateRange.end} 
            />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <SalesChart startDate={dateRange.start} endDate={dateRange.end} />
              </div>
              <div className="space-y-6">
                <PaymentMethodsChart startDate={dateRange.start} endDate={dateRange.end} />
                <TopProducts startDate={dateRange.start} endDate={dateRange.end} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            <TransactionHistory startDate={dateRange.start} endDate={dateRange.end} />
          </TabsContent>

          <TabsContent value="inventory" className="mt-0">
            <StockRestockHistory />
          </TabsContent>

          <TabsContent value="audit" className="mt-0">
            <AuditTrail />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
