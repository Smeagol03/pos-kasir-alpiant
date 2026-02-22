import { useState, useEffect } from "react";
import { useInvokeQuery, useInvokeMutation } from "../hooks/useInvokeQuery";
import { AppSettings } from "../types";
import { useAuthStore } from "../store/authStore";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Store, Receipt, Calculator, Printer, CheckCircle, Tag } from "lucide-react";
import { useToast } from "../hooks/use-toast";
import { DiscountSettings } from "../features/settings/DiscountSettings";

export default function SettingsPage() {
  const sessionToken = useAuthStore((s) => s.sessionToken);
  const { toast } = useToast();

  const { data: initialSettings, isLoading } = useInvokeQuery<AppSettings>(
    ["settings"],
    "get_settings",
    { sessionToken },
  );

  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    if (initialSettings) setSettings(initialSettings);
  }, [initialSettings]);

  const saveMutation = useInvokeMutation("save_settings", {
    onSuccess: () => {
      toast({
        title: "Settings Saved",
        description: "Your configuration has been applied.",
      });
    },
    onError: (e) =>
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: String(e),
      }),
  });

  const handleSave = () => {
    if (!settings) return;
    saveMutation.mutate({ sessionToken, payload: settings });
  };

  const updateCompany = (key: keyof AppSettings["company"], val: string) => {
    if (!settings) return;
    setSettings({ ...settings, company: { ...settings.company, [key]: val } });
  };

  const updateReceipt = (key: keyof AppSettings["receipt"], val: any) => {
    if (!settings) return;
    setSettings({ ...settings, receipt: { ...settings.receipt, [key]: val } });
  };

  const updateTax = (key: keyof AppSettings["tax"], val: any) => {
    if (!settings) return;
    setSettings({ ...settings, tax: { ...settings.tax, [key]: val } });
  };

  const updateRoot = (key: keyof AppSettings, val: any) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: val });
  };

  if (isLoading || !settings) {
    return <div className="p-8 text-center">Loading Settings...</div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto h-full space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
          <p className="text-muted-foreground mt-1">
            Configure your POS preferences, taxation, and receipt formats.
          </p>
        </div>
        <Button
          size="lg"
          onClick={handleSave}
          disabled={saveMutation.isPending}
        >
          <CheckCircle className="h-5 w-5 mr-2" />
          {saveMutation.isPending ? "Saving..." : "Save All Changes"}
        </Button>
      </div>

      <Tabs defaultValue="company" className="w-full">
        <TabsList className="grid w-full grid-cols-5 mb-4">
          <TabsTrigger value="company">
            <Store className="h-4 w-4 mr-2" /> Store
          </TabsTrigger>
          <TabsTrigger value="receipt">
            <Receipt className="h-4 w-4 mr-2" /> Receipt
          </TabsTrigger>
          <TabsTrigger value="tax">
            <Calculator className="h-4 w-4 mr-2" /> Taxation
          </TabsTrigger>
          <TabsTrigger value="discounts">
            <Tag className="h-4 w-4 mr-2" /> Discounts
          </TabsTrigger>
          <TabsTrigger value="hardware">
            <Printer className="h-4 w-4 mr-2" /> Hardware
          </TabsTrigger>
        </TabsList>

        <TabsContent value="company">
          <Card>
            <CardHeader>
              <CardTitle>Company Details</CardTitle>
              <CardDescription>
                This information will appear on receipts and reports.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Store Name</Label>
                <Input
                  value={settings.company.store_name}
                  onChange={(e) => updateCompany("store_name", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Store Address</Label>
                <Input
                  value={settings.company.address}
                  onChange={(e) => updateCompany("address", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input
                    value={settings.company.phone}
                    onChange={(e) => updateCompany("phone", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tax/NPWP Number (Optional)</Label>
                  <Input
                    value={settings.company.tax_number}
                    onChange={(e) =>
                      updateCompany("tax_number", e.target.value)
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="receipt">
          <Card>
            <CardHeader>
              <CardTitle>Receipt Configurations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Header Text (Optional message below store name)</Label>
                  <Input
                    value={settings.receipt.header_text}
                    onChange={(e) =>
                      updateReceipt("header_text", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Footer Text (Thank you message)</Label>
                  <Input
                    value={settings.receipt.footer_text}
                    onChange={(e) =>
                      updateReceipt("footer_text", e.target.value)
                    }
                  />
                </div>
              </div>

              <div className="space-y-4 border rounded-md p-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="showLogo"
                    checked={settings.receipt.show_logo}
                    onCheckedChange={(c) => updateReceipt("show_logo", !!c)}
                  />
                  <Label htmlFor="showLogo" className="cursor-pointer">
                    Print Store Logo
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="showCashier"
                    checked={settings.receipt.show_cashier_name}
                    onCheckedChange={(c) =>
                      updateReceipt("show_cashier_name", !!c)
                    }
                  />
                  <Label htmlFor="showCashier" className="cursor-pointer">
                    Show Cashier Name
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="showTax"
                    checked={settings.receipt.show_tax_detail}
                    onCheckedChange={(c) =>
                      updateReceipt("show_tax_detail", !!c)
                    }
                  />
                  <Label htmlFor="showTax" className="cursor-pointer">
                    Breakdown Tax Details
                  </Label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Paper Width</Label>
                  <Select
                    value={settings.receipt.paper_width}
                    onValueChange={(val) => updateReceipt("paper_width", val)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="58mm">
                        58mm (Standard Thermal)
                      </SelectItem>
                      <SelectItem value="80mm">80mm (Wide Thermal)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Receipt Copies</Label>
                  <Input
                    type="number"
                    min="1"
                    max="3"
                    value={settings.receipt.copies}
                    onChange={(e) =>
                      updateReceipt("copies", Number(e.target.value))
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tax">
          <Card>
            <CardHeader>
              <CardTitle>Tax Settings</CardTitle>
              <CardDescription>
                Setup automatic global taxation rules.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between border rounded-md p-4 bg-muted/30">
                <div>
                  <Label
                    htmlFor="enableTax"
                    className="text-base cursor-pointer"
                  >
                    Enable Taxation
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    If enabled, tax will be calculated on all POS transactions.
                  </p>
                </div>
                <Checkbox
                  id="enableTax"
                  className="h-6 w-6"
                  checked={settings.tax.is_enabled}
                  onCheckedChange={(c) => updateTax("is_enabled", !!c)}
                />
              </div>

              <div
                className={`space-y-4 ${!settings.tax.is_enabled ? "opacity-50 pointer-events-none" : ""}`}
              >
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tax Label (e.g. VAT, PPN, Custom)</Label>
                    <Input
                      value={settings.tax.label}
                      onChange={(e) => updateTax("label", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tax Rate (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={settings.tax.rate}
                      onChange={(e) =>
                        updateTax("rate", Number(e.target.value))
                      }
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    id="taxIncl"
                    checked={settings.tax.is_included}
                    onCheckedChange={(c) => updateTax("is_included", !!c)}
                  />
                  <Label htmlFor="taxIncl" className="cursor-pointer">
                    Tax Included in Product Price (Gross)
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="discounts">
          <Card>
            <CardContent className="pt-6">
              <DiscountSettings />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hardware">
          <Card>
            <CardHeader>
              <CardTitle>Hardware Interactions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2 max-w-md">
                <Label>Printer Device Port / Connection string</Label>
                <Input
                  value={settings.printer_port}
                  onChange={(e) => updateRoot("printer_port", e.target.value)}
                  placeholder="/dev/usb/lp0 or COM3"
                />
              </div>

              <div className="space-y-2 max-w-md">
                <Label>Low Stock Alert Threshold</Label>
                <Input
                  type="number"
                  value={settings.low_stock_threshold}
                  onChange={(e) =>
                    updateRoot("low_stock_threshold", Number(e.target.value))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Products with stock at or below this limit will be marked in
                  red.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
