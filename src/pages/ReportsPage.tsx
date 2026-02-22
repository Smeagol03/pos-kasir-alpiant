import { SalesChart } from "../features/reports/SalesChart";
import { TopProducts } from "../features/reports/TopProducts";
import { ShiftSummary } from "../features/reports/ShiftSummary";

export default function ReportsPage() {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto h-full flex flex-col">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Financial Reports</h1>
        <p className="text-muted-foreground mt-1">
          View revenue, sales volumes, and shift performance.
        </p>
      </div>

      <ShiftSummary />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        <SalesChart />
        <TopProducts />
      </div>
    </div>
  );
}
