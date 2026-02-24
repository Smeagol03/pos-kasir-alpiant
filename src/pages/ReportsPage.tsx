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
import {
  BarChart3,
  Download,
  History,
  PackageSearch,
  ShieldCheck,
  CalendarDays,
} from "lucide-react";
import { format, subDays, startOfMonth, startOfYesterday } from "date-fns";
import { id as localeId } from "date-fns/locale";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";

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
      case "lastMonth": {
        const lastMonth = subDays(startOfMonth(end), 1);
        start = startOfMonth(lastMonth);
        break;
      }
    }

    setDateRange({
      start: format(start, "yyyy-MM-dd"),
      end: format(end, "yyyy-MM-dd"),
    });
  };

  // Human-readable date range
  const formatDateDisplay = () => {
    try {
      const s = new Date(dateRange.start);
      const e = new Date(dateRange.end);
      return `${format(s, "d MMM", { locale: localeId })} – ${format(e, "d MMM yyyy", { locale: localeId })}`;
    } catch {
      return `${dateRange.start} – ${dateRange.end}`;
    }
  };

  const exportToCSV = async () => {
    setIsExporting(true);
    try {
      const [summary, topProducts, allTransactions] = await Promise.all([
        invoke<FinancialSummary>("get_financial_summary", {
          sessionToken,
          startDate: dateRange.start,
          endDate: dateRange.end,
        }),
        invoke<ProductStat[]>("get_top_products", {
          sessionToken,
          startDate: dateRange.start,
          endDate: dateRange.end,
          limit: 500,
        }),
        invoke<PaginatedTransactions>("get_transactions", {
          sessionToken,
          startDate: dateRange.start,
          endDate: dateRange.end,
          page: 1,
        }),
      ]);

      const combinedData = [
        ["LAPORAN KEUANGAN POS KASIR"],
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
        ...allTransactions.data.map((t) => [
          t.timestamp,
          t.id,
          t.cashier_name,
          t.payment_method,
          Math.round(t.total_amount),
          t.status,
        ]),
        [],
        ["--- PRODUK TERLARIS ---"],
        ["Nama Produk", "Jumlah Terjual", "Total Omzet"],
        ...topProducts.map((p) => [
          p.name,
          p.total_sold,
          Math.round(p.total_revenue),
        ]),
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
        description: `Laporan disimpan: ${fileName}`,
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
    <div className="p-6 max-w-7xl mx-auto h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 shrink-0 mb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Laporan & Analitik
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {formatDateDisplay()}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Period Selector */}
          <div className="flex items-center gap-2 bg-muted/40 p-1 rounded-lg border border-border/50">
            <Select value={rangeLabel} onValueChange={handleRangeChange}>
              <SelectTrigger className="w-[130px] border-0 bg-transparent focus:ring-0 h-8 text-xs font-medium">
                <SelectValue placeholder="Periode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hari Ini</SelectItem>
                <SelectItem value="yesterday">Kemarin</SelectItem>
                <SelectItem value="7d">7 Hari</SelectItem>
                <SelectItem value="30d">30 Hari</SelectItem>
                <SelectItem value="thisMonth">Bulan Ini</SelectItem>
                <SelectItem value="lastMonth">Bulan Lalu</SelectItem>
                <SelectItem value="custom">Kustom</SelectItem>
              </SelectContent>
            </Select>

            {rangeLabel === "custom" && (
              <div className="flex items-center gap-1.5 border-l border-border/50 pl-2">
                <Input
                  type="date"
                  className="h-7 w-[120px] text-[11px] border-0 bg-transparent p-0"
                  value={dateRange.start}
                  onChange={(e) =>
                    setDateRange({ ...dateRange, start: e.target.value })
                  }
                />
                <span className="text-[10px] text-muted-foreground">—</span>
                <Input
                  type="date"
                  className="h-7 w-[120px] text-[11px] border-0 bg-transparent p-0"
                  value={dateRange.end}
                  onChange={(e) =>
                    setDateRange({ ...dateRange, end: e.target.value })
                  }
                />
              </div>
            )}
          </div>

          <Button
            onClick={exportToCSV}
            disabled={isExporting}
            variant="outline"
            size="sm"
            className="h-10 text-xs font-medium"
          >
            {isExporting ? (
              <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-foreground mr-1.5" />
            ) : (
              <Download className="h-3.5 w-3.5 mr-1.5" />
            )}
            Export CSV
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <Tabs defaultValue="overview" className="space-y-5">
          <TabsList className="bg-muted/40 p-1 rounded-lg border border-border/50 shrink-0">
            <TabsTrigger
              value="overview"
              className="rounded-md px-4 gap-1.5 text-xs font-medium"
            >
              <BarChart3 className="h-3.5 w-3.5" /> Ringkasan
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="rounded-md px-4 gap-1.5 text-xs font-medium"
            >
              <History className="h-3.5 w-3.5" /> Transaksi
            </TabsTrigger>
            <TabsTrigger
              value="inventory"
              className="rounded-md px-4 gap-1.5 text-xs font-medium"
            >
              <PackageSearch className="h-3.5 w-3.5" /> Audit Stok
            </TabsTrigger>
            <TabsTrigger
              value="audit"
              className="rounded-md px-4 gap-1.5 text-xs font-medium"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Log Aktivitas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-5 mt-0">
            {/* Shift Summary */}
            <ShiftSummary />

            {/* Financial KPIs + Breakdown */}
            <FinancialSummaryCards
              startDate={dateRange.start}
              endDate={dateRange.end}
            />

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <SalesChart
                  startDate={dateRange.start}
                  endDate={dateRange.end}
                />
              </div>
              <div>
                <PaymentMethodsChart
                  startDate={dateRange.start}
                  endDate={dateRange.end}
                />
              </div>
            </div>

            {/* Top Products */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <TopProducts
                startDate={dateRange.start}
                endDate={dateRange.end}
              />
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            <TransactionHistory
              startDate={dateRange.start}
              endDate={dateRange.end}
            />
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
