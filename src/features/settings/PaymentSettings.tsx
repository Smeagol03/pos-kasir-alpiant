import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Switch } from "../../components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { useToast } from "../../hooks/use-toast";
import { useAuthStore } from "../../store/authStore";
import { invoke } from "../../lib/tauri";
import { CreditCard, CheckCircle, Loader2 } from "lucide-react";

interface PaymentConfig {
  qris_enabled: boolean;
  provider: string;
  midtrans_server_key_masked: string;  // Masked version for display
  midtrans_base_url: string;
}

export function PaymentSettings() {
  const { sessionToken } = useAuthStore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");

  const [settings, setSettings] = useState<PaymentConfig>({
    qris_enabled: true,
    provider: "midtrans",
    midtrans_server_key_masked: "",  // Will show masked version
    midtrans_base_url: "https://api.sandbox.midtrans.com",
  });

  // For input, we use a separate state that's not persisted
  const [serverKeyInput, setServerKeyInput] = useState("");

  // Load existing config on mount
  useEffect(() => {
    const loadConfig = async () => {
      if (!sessionToken) return;
      try {
        const config = await invoke<PaymentConfig>("get_payment_config", { sessionToken });
        setSettings(config);
        // Don't populate server key input for security
        // User must re-enter if they want to change it
      } catch (error) {
        console.error("Failed to load payment config:", error);
      }
    };
    loadConfig();
  }, [sessionToken]);

  const handleSave = async () => {
    if (!sessionToken) return;
    
    // User must enter server key if it's not already saved
    const keyToSave = serverKeyInput.trim();
    
    if (!keyToSave && !settings.midtrans_server_key_masked.startsWith('****')) {
      toast({
        variant: "destructive",
        title: "Server Key Required",
        description: "Masukkan Server Key untuk menyimpan konfigurasi.",
      });
      return;
    }
    
    setLoading(true);
    try {
      // Only save if user entered a new key, or if there's no existing key
      const shouldSaveKey = keyToSave || !settings.midtrans_server_key_masked.startsWith('****');
      
      await invoke("save_payment_config", {
        sessionToken,
        qrisEnabled: settings.qris_enabled,
        provider: settings.provider,
        midtransServerKey: keyToSave || "",
        midtransBaseUrl: settings.midtrans_base_url,
      });
      toast({
        title: "Pengaturan Tersimpan",
        description: shouldSaveKey 
          ? "Server key telah diupdate." 
          : "Konfigurasi diupdate (server key tidak berubah).",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Gagal Simpan",
        description: String(error),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    // Use input value first, fallback to existing key if testing with saved key
    const keyToTest = serverKeyInput.trim() || (settings.midtrans_server_key_masked.startsWith('****') ? settings.midtrans_server_key_masked : '');
    
    if (!keyToTest || keyToTest.startsWith('****')) {
      toast({
        variant: "destructive",
        title: "Server Key Required",
        description: "Masukkan Midtrans Server Key terlebih dahulu untuk test koneksi.",
      });
      return;
    }

    setTestStatus("testing");
    setTestMessage("");
    try {
      const result = await invoke<string>("test_payment_connection", {
        sessionToken,
        serverKey: keyToTest,
        baseUrl: settings.midtrans_base_url,
      });
      setTestStatus("success");
      setTestMessage(result);
      toast({
        title: "Koneksi Berhasil!",
        description: result,
      });
    } catch (error) {
      setTestStatus("error");
      setTestMessage(String(error));
      toast({
        variant: "destructive",
        title: "Koneksi Gagal",
        description: String(error),
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Payment Gateway Configuration
        </CardTitle>
        <CardDescription>
          Configure QRIS payment integration with Midtrans or other payment providers.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable QRIS */}
        <div className="flex items-center justify-between border rounded-md p-4 bg-muted/30">
          <div>
            <Label htmlFor="qris-enabled" className="text-base cursor-pointer">
              Enable QRIS Payments
            </Label>
            <p className="text-sm text-muted-foreground mt-1">
              Allow customers to pay via QRIS (GoPay, OVO, Dana, ShopeePay, etc.)
            </p>
          </div>
          <Switch
            id="qris-enabled"
            checked={settings.qris_enabled}
            onCheckedChange={(checked) =>
              setSettings({ ...settings, qris_enabled: checked })
            }
          />
        </div>

        {/* Payment Provider */}
        <div className="space-y-2">
          <Label>Payment Provider</Label>
          <Select
            value={settings.provider}
            onValueChange={(value) =>
              setSettings({ ...settings, provider: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="midtrans">Midtrans</SelectItem>
              <SelectItem value="xendit" disabled>
                Xendit (Coming Soon)
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Currently only Midtrans is supported. More providers coming soon.
          </p>
        </div>

        {/* Midtrans Configuration */}
        {settings.provider === "midtrans" && (
          <div className="space-y-4 border rounded-md p-4 bg-card">
            <div className="space-y-2">
              <Label>Midtrans Server Key</Label>
              <Input
                type="password"
                value={serverKeyInput}
                onChange={(e) => setServerKeyInput(e.target.value)}
                placeholder={
                  settings.midtrans_server_key_masked.startsWith('****')
                    ? `Current: ${settings.midtrans_server_key_masked} (kosongkan jika tidak ingin mengubah)`
                    : "Mid-server-xxxxxxxxxxxxx or SB-Mid-server-xxxxxxxxxxxxx"
                }
              />
              {settings.midtrans_server_key_masked.startsWith('****') && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Server key sudah tersimpan. Isi di atas hanya jika ingin mengubah.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Get your Server Key from{" "}
                <a
                  href="https://dashboard.sandbox.midtrans.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  Midtrans Dashboard
                </a>{" "}
                (Sandbox or Production)
              </p>
            </div>

            <div className="space-y-2">
              <Label>Midtrans Base URL</Label>
              <Input
                value={settings.midtrans_base_url}
                onChange={(e) =>
                  setSettings({ ...settings, midtrans_base_url: e.target.value })
                }
                placeholder="https://api.sandbox.midtrans.com"
              />
              <p className="text-xs text-muted-foreground">
                Use sandbox URL for testing, production URL for live environment
              </p>
            </div>

            {/* Test Connection Button */}
            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={testStatus === "testing" || (!serverKeyInput && !settings.midtrans_server_key_masked.startsWith('****'))}
              >
                {testStatus === "testing" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CreditCard className="h-4 w-4 mr-2" />
                )}
                {testStatus === "testing" ? "Testing..." : "Test Connection"}
              </Button>

              {testStatus === "success" && (
                <span className="text-sm text-green-600 flex items-center gap-1">
                  <CheckCircle className="h-4 w-4" />
                  {testMessage}
                </span>
              )}
              {testStatus === "error" && (
                <span className="text-sm text-destructive">
                  ✗ {testMessage}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="border-t pt-4">
          <Button
            onClick={handleSave}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            {loading ? "Saving..." : "Save Payment Settings"}
          </Button>
        </div>

        {/* Info Box */}
        <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg">
          <h4 className="font-semibold text-blue-600 mb-2">ℹ️ Environment Variables</h4>
          <p className="text-sm text-muted-foreground mb-2">
            For better security, you can also store credentials in environment variables:
          </p>
          <code className="block bg-muted p-2 rounded text-xs font-mono">
            MIDTRANS_SERVER_KEY=your-server-key<br />
            MIDTRANS_BASE_URL=https://api.sandbox.midtrans.com
          </code>
        </div>
      </CardContent>
    </Card>
  );
}
