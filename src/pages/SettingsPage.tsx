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
import {
  Store,
  Receipt,
  Calculator,
  Printer,
  CheckCircle,
  Tag,
  User as UserIcon,
} from "lucide-react";
import { useToast } from "../hooks/use-toast";
import { DiscountSettings } from "../features/settings/DiscountSettings";
import { NumericInput } from "../components/NumericInput";
import { invoke } from "../lib/tauri";

export default function SettingsPage() {
  const { user, sessionToken, setUser } = useAuthStore();
  const { toast } = useToast();

  const { data: initialSettings, isLoading } = useInvokeQuery<AppSettings>(
    ["settings"],
    "get_settings",
    { sessionToken },
  );

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [profileData, setProfileData] = useState({
    name: user?.name || "",
    username: user?.username || "",
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    if (initialSettings) setSettings(initialSettings);
  }, [initialSettings]);

  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name,
        username: user.username,
      });
    }
  }, [user]);

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

  const handleUpdateProfile = async () => {
    if (!user) return;
    setIsSavingProfile(true);
    try {
      const updatedUser = await invoke<any>("update_user", {
        sessionToken,
        id: user.id,
        payload: {
          name: profileData.name,
          username: profileData.username,
        },
      });
      setUser(updatedUser);
      toast({
        title: "Profile Updated",
        description: "Your account details have been updated successfully.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: String(error),
      });
    } finally {
      setIsSavingProfile(false);
    }
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
        <TabsList className="grid w-full grid-cols-6 mb-4">
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
          <TabsTrigger value="account">
            <UserIcon className="h-4 w-4 mr-2" /> Account
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
                  <NumericInput
                    value={settings.receipt.copies}
                    onChange={(val) => updateReceipt("copies", val)}
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
                    <NumericInput
                      value={settings.tax.rate}
                      onChange={(val) => updateTax("rate", val)}
                      suffix="%"
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

        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle>My Profile</CardTitle>
              <CardDescription>
                Update your administrative account details.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input
                  value={profileData.name}
                  onChange={(e) =>
                    setProfileData({ ...profileData, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Username</Label>
                <Input
                  value={profileData.username}
                  onChange={(e) =>
                    setProfileData({ ...profileData, username: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  This username is used for logging into the system.
                </p>
              </div>
              <div className="pt-2">
                <Button
                  onClick={handleUpdateProfile}
                  disabled={isSavingProfile}
                >
                  {isSavingProfile ? "Saving Profile..." : "Update Profile"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hardware">
          <Card>
            <CardHeader>
              <CardTitle>Printer & Hardware</CardTitle>
              <CardDescription>
                Konfigurasi koneksi printer thermal ESC/POS dan peringatan stok.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <PrinterSection
                sessionToken={sessionToken || ""}
                printerPort={settings.printer_port}
                onPortChange={(val) => updateRoot("printer_port", val)}
              />

              <div className="border-t pt-6">
                <div className="space-y-2 max-w-md">
                  <Label>Low Stock Alert Threshold</Label>
                  <NumericInput
                    value={settings.low_stock_threshold}
                    onChange={(val) => updateRoot("low_stock_threshold", val)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Produk dengan stok ≤ ini akan ditampilkan di notifikasi stok
                    kritis.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ──────── Printer Section Component ────────

interface PrinterPortInfo {
  path: string;
  description: string;
}

function PrinterSection({
  sessionToken,
  printerPort,
  onPortChange,
}: {
  sessionToken: string;
  printerPort: string;
  onPortChange: (val: string) => void;
}) {
  const [ports, setPorts] = useState<PrinterPortInfo[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<"idle" | "success" | "error">(
    "idle",
  );
  const [testError, setTestError] = useState("");
  const { toast } = useToast();

  const scanPorts = async () => {
    setIsScanning(true);
    try {
      const detected = await invoke<PrinterPortInfo[]>("list_serial_ports", {
        sessionToken,
      });
      setPorts(detected);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Scan Gagal",
        description: String(error),
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleTestPrint = async () => {
    setIsTesting(true);
    setTestResult("idle");
    setTestError("");
    try {
      await invoke("test_print", { sessionToken });
      setTestResult("success");
      toast({
        title: "Test Print Berhasil",
        description: "Printer merespon dengan baik!",
      });
    } catch (error) {
      setTestResult("error");
      setTestError(String(error));
      toast({
        variant: "destructive",
        title: "Test Print Gagal",
        description: String(error),
      });
    } finally {
      setIsTesting(false);
    }
  };

  useEffect(() => {
    if (sessionToken) scanPorts();
  }, [sessionToken]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">
          Printer Thermal ESC/POS
        </Label>
        <Button
          variant="outline"
          size="sm"
          onClick={scanPorts}
          disabled={isScanning}
        >
          {isScanning ? (
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary mr-2" />
          ) : (
            <Printer className="h-3 w-3 mr-2" />
          )}
          {isScanning ? "Scanning..." : "Scan Port"}
        </Button>
      </div>

      <div className="space-y-2 max-w-md">
        <Label>Port Printer</Label>
        {ports.length > 1 ? (
          <Select
            value={printerPort || "none"}
            onValueChange={(val: string) =>
              onPortChange(val === "none" ? "" : val)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Pilih port printer..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">-- Tidak ada --</SelectItem>
              {ports
                .filter((p) => p.path !== "network")
                .map((p) => (
                  <SelectItem key={p.path} value={p.path}>
                    {p.description}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            value={printerPort}
            onChange={(e) => onPortChange(e.target.value)}
            placeholder="/dev/usb/lp0, COM3, atau 192.168.1.100:9100"
          />
        )}
        <p className="text-xs text-muted-foreground">
          USB: /dev/usb/lp0 (Linux) atau COM3 (Windows). Network: IP:PORT
          (contoh: 192.168.1.100:9100)
        </p>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button
          variant="outline"
          onClick={handleTestPrint}
          disabled={isTesting || !printerPort || printerPort === "none"}
        >
          {isTesting ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2" />
          ) : (
            <Printer className="h-4 w-4 mr-2" />
          )}
          {isTesting ? "Mengirim..." : "Test Print"}
        </Button>

        {testResult === "success" && (
          <span className="text-sm text-green-600 flex items-center gap-1">
            <CheckCircle className="h-4 w-4" />
            Printer terhubung!
          </span>
        )}
        {testResult === "error" && (
          <span className="text-sm text-destructive max-w-sm truncate">
            ✗ {testError}
          </span>
        )}
      </div>
    </div>
  );
}
