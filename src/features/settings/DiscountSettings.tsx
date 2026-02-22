import { useState, useEffect } from "react";
import { useAuthStore } from "../../store/authStore";
import { invoke } from "../../lib/tauri";
import { Discount } from "../../types";
import { useToast } from "../../hooks/use-toast";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Switch } from "../../components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Plus, Pencil, Loader2 } from "lucide-react";
import { formatRupiah } from "../../lib/currency";
import { Badge } from "../../components/ui/badge";

export function DiscountSettings() {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<Partial<Discount> | null>(null);

  const sessionToken = useAuthStore((s) => s.sessionToken);
  const { toast } = useToast();

  useEffect(() => {
    fetchDiscounts();
  }, []);

  const fetchDiscounts = async () => {
    try {
      const data = await invoke<Discount[]>("get_discounts", { sessionToken });
      setDiscounts(data);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal mengambil data diskon",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingDiscount({
      name: "",
      type: "PERCENT",
      value: 0,
      min_purchase: 0,
      is_automatic: false,
      is_active: true,
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (discount: Discount) => {
    setEditingDiscount(discount);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingDiscount) return;
    setIsSaving(true);
    try {
      if (editingDiscount.id) {
        await invoke("update_discount", {
          sessionToken,
          id: editingDiscount.id,
          payload: {
            name: editingDiscount.name,
            type: editingDiscount.type,
            value: editingDiscount.value,
            min_purchase: editingDiscount.min_purchase,
            is_automatic: editingDiscount.is_automatic,
            is_active: editingDiscount.is_active,
          },
        });
      } else {
        await invoke("create_discount", {
          sessionToken,
          payload: editingDiscount,
        });
      }
      setIsDialogOpen(false);
      fetchDiscounts();
      toast({
        title: "Berhasil",
        description: "Diskon berhasil disimpan",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal menyimpan diskon",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async (id: number) => {
    try {
      await invoke("toggle_discount", { sessionToken, id });
      fetchDiscounts();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal mengubah status diskon",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">Manajemen Diskon</h2>
        <Button onClick={handleOpenAdd}>
          <Plus className="mr-2 h-4 w-4" /> Tambah Diskon
        </Button>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama Event/Diskon</TableHead>
              <TableHead>Tipe</TableHead>
              <TableHead>Nilai</TableHead>
              <TableHead>Min. Pembelian</TableHead>
              <TableHead>Metode</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {discounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  Belum ada data diskon.
                </TableCell>
              </TableRow>
            ) : (
              discounts.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{d.type}</Badge>
                  </TableCell>
                  <TableCell>
                    {d.type === "PERCENT" ? `${d.value}%` : formatRupiah(d.value)}
                  </TableCell>
                  <TableCell>{formatRupiah(d.min_purchase)}</TableCell>
                  <TableCell>
                    <Badge variant={d.is_automatic ? "default" : "secondary"}>
                      {d.is_automatic ? "Otomatis" : "Manual"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={d.is_active}
                      onCheckedChange={() => handleToggle(d.id)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenEdit(d)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingDiscount?.id ? "Edit Diskon" : "Tambah Diskon Baru"}
            </DialogTitle>
          </DialogHeader>
          {editingDiscount && (
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nama Event / Judul Diskon</Label>
                <Input
                  id="name"
                  placeholder="Contoh: Promo Ramadhan"
                  value={editingDiscount.name}
                  onChange={(e) =>
                    setEditingDiscount({ ...editingDiscount, name: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Tipe Diskon</Label>
                  <Select
                    value={editingDiscount.type}
                    onValueChange={(val: any) =>
                      setEditingDiscount({ ...editingDiscount, type: val })
                    }
                  >
                    <SelectTrigger id="type">
                      <SelectValue placeholder="Pilih tipe" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERCENT">Persentase (%)</SelectItem>
                      <SelectItem value="NOMINAL">Nominal (Rp)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="value">Nilai</Label>
                  <Input
                    id="value"
                    type="number"
                    value={editingDiscount.value}
                    onChange={(e) =>
                      setEditingDiscount({
                        ...editingDiscount,
                        value: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="min_purchase">Minimum Pembelian (Rp)</Label>
                <Input
                  id="min_purchase"
                  type="number"
                  value={editingDiscount.min_purchase}
                  onChange={(e) =>
                    setEditingDiscount({
                      ...editingDiscount,
                      min_purchase: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Terapkan Otomatis</Label>
                  <p className="text-xs text-muted-foreground">
                    Aktifkan jika ingin diskon langsung diterapkan saat syarat terpenuhi.
                  </p>
                </div>
                <Switch
                  checked={editingDiscount.is_automatic}
                  onCheckedChange={(checked) =>
                    setEditingDiscount({ ...editingDiscount, is_automatic: checked })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
