import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { 
  Archive, Scale, Plus, Search, Loader2, X, 
  History, ArrowDownRight, ArrowUpRight, FileSpreadsheet, 
  ShoppingCart, Edit, Trash2, Package, CheckCircle2
} from 'lucide-react';

export default function StockOpname() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('inventory'); // 'inventory', 'usage', 'restock', 'opname', 'gramasi'
  
  const [inventory, setInventory] = useState([]);
  const [usageLogs, setUsageLogs] = useState([]);
  const [restockLogs, setRestockLogs] = useState([]);
  const [opnameLogs, setOpnameLogs] = useState([]);
  const [gramasiLogs, setGramasiLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [isInvModalOpen, setIsInvModalOpen] = useState(false);
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [isOpnameModalOpen, setIsOpnameModalOpen] = useState(false);
  const [isGramasiModalOpen, setIsGramasiModalOpen] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Edit IDs (-null berarti mode create)
  const [editingInvId, setEditingInvId] = useState(null);
  const [editingRestockId, setEditingRestockId] = useState(null);
  const [editingOpnameId, setEditingOpnameId] = useState(null);
  const [editingGramasiId, setEditingGramasiId] = useState(null);

  // Form States
  const [invForm, setInvForm] = useState({ item_name: '', category: 'restoran', stock_gram: '', unit: 'kg', min_stock: 1000 });
  const [restockForm, setRestockForm] = useState({ item_name: 'Brisket Sapi', qty: '', unit: 'kg', unit_price: '', supplier: '' });
  const [opnameForm, setOpnameForm] = useState({ inventory_id: '', physical_stock: '', notes: '' });
  const [gramasiForm, setGramasiForm] = useState({ inventory_id: '', initial_weight: '', trimmed_weight: '', notes: '' });

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: invData } = await supabase.from('inventory').select('*').order('item_name');
      setInventory(invData || []);

      const { data: useData } = await supabase
        .from('stock_movements')
        .select(`*, inventory(item_name, unit), profiles(full_name)`)
        .eq('movement_type', 'usage')
        .order('created_at', { ascending: false });
      setUsageLogs(useData || []);

      const { data: restockData } = await supabase
        .from('stock_movements')
        .select(`*, inventory(item_name, unit), profiles(full_name)`)
        .eq('movement_type', 'restock')
        .order('created_at', { ascending: false });
      setRestockLogs(restockData || []);

      const { data: opData } = await supabase
        .from('stock_opname')
        .select(`*, inventory(item_name, unit), profiles(full_name)`)
        .order('created_at', { ascending: false });
      setOpnameLogs(opData || []);

      const { data: gramData } = await supabase
        .from('meat_gramasi')
        .select(`*, inventory(item_name), profiles(full_name)`)
        .order('created_at', { ascending: false });
      setGramasiLogs(gramData || []);

    } catch (error) {
      console.error('Error fetching stock data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- 1. CRUD MASTER INVENTORY ---
  const handleSaveInventory = async (e) => {
    e.preventDefault();
    setSubmitLoading(true);
    try {
      const payload = {
        item_name: invForm.item_name,
        category: invForm.category,
        stock_gram: parseFloat(invForm.stock_gram) || 0,
        unit: invForm.unit,
        min_stock: parseFloat(invForm.min_stock) || 1000
      };

      if (editingInvId) {
        const { error } = await supabase.from('inventory').update(payload).eq('id', editingInvId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('inventory').insert([payload]);
        if (error) throw error;
      }

      setIsInvModalOpen(false);
      setEditingInvId(null);
      setInvForm({ item_name: '', category: 'restoran', stock_gram: '', unit: 'kg', min_stock: 1000 });
      await fetchData();
      alert('Master inventory berhasil disimpan!');
    } catch (error) {
      alert('Gagal menyimpan inventory: ' + error.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleEditInventory = (item) => {
    setEditingInvId(item.id);
    setInvForm({
      item_name: item.item_name,
      category: item.category || 'restoran',
      stock_gram: item.stock_gram ?? item.stock_qty ?? 0,
      unit: item.unit || 'kg',
      min_stock: item.min_stock || 1000
    });
    setIsInvModalOpen(true);
  };

  const handleDeleteInventory = async (id) => {
    if (!confirm('Hapus item inventory ini?')) return;
    try {
      const { error } = await supabase.from('inventory').delete().eq('id', id);
      if (error) throw error;
      await fetchData();
    } catch (error) {
      alert('Gagal menghapus: ' + error.message);
    }
  };

  // --- 2. CRUD RESTOCK / BELANJA MASUK ---
  const handleSaveRestock = async (e) => {
    e.preventDefault();
    setSubmitLoading(true);
    try {
      const qtyNum = parseFloat(restockForm.qty) || 0;
      const priceNum = parseFloat(restockForm.unit_price) || 0;
      const totalPrice = qtyNum * priceNum;
      const unit = restockForm.unit;

      let calculatedGram = unit.toLowerCase() === 'kg' ? qtyNum * 1000 : qtyNum;

      if (editingRestockId) {
        // Update logic
        const { error } = await supabase.from('stock_movements').update({
          gram_change: calculatedGram,
          notes: `Restock update: ${restockForm.supplier || 'Supplier'} (${qtyNum} ${unit})`
        }).eq('id', editingRestockId);
        if (error) throw error;
      } else {
        // Create logic
        const { data: existingInv } = await supabase.from('inventory').select('*').ilike('item_name', restockForm.item_name).maybeSingle();

        let targetInvId;
        if (existingInv) {
          targetInvId = existingInv.id;
          await supabase.from('inventory').update({ stock_gram: (existingInv.stock_gram || 0) + calculatedGram }).eq('id', targetInvId);
        } else {
          const { data: newInv } = await supabase.from('inventory').insert([{
            item_name: restockForm.item_name,
            category: 'restoran',
            stock_gram: calculatedGram,
            unit: unit,
            min_stock: 1000
          }]).select().single();
          targetInvId = newInv.id;
        }

        await supabase.from('stock_movements').insert([{
          inventory_id: targetInvId,
          movement_type: 'restock',
          gram_change: calculatedGram,
          remaining_gram: calculatedGram, // simplified
          operator_id: profile?.id,
          notes: `Restock dari ${restockForm.supplier || 'Supplier Umum'} (${qtyNum} ${unit})`
        }]);
      }

      setIsRestockModalOpen(false);
      setEditingRestockId(null);
      setRestockForm({ item_name: 'Brisket Sapi', qty: '', unit: 'kg', unit_price: '', supplier: '' });
      await fetchData();
      alert('Restock berhasil disimpan!');
    } catch (error) {
      alert('Gagal menyimpan restock: ' + error.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteRestock = async (id) => {
    if (!confirm('Hapus log restock ini?')) return;
    try {
      const { error } = await supabase.from('stock_movements').delete().eq('id', id);
      if (error) throw error;
      await fetchData();
    } catch (error) {
      alert('Gagal menghapus: ' + error.message);
    }
  };

  // --- 3. CRUD STOCK OPNAME ---
  const handleSaveOpname = async (e) => {
    e.preventDefault();
    setSubmitLoading(true);
    try {
      const selectedItem = inventory.find(i => i.id === opnameForm.inventory_id);
      if (!selectedItem) throw new Error('Pilih item inventory.');

      const systemStock = selectedItem.stock_gram ?? 0;
      const physicalStock = parseFloat(opnameForm.physical_stock) || 0;

      const payload = {
        inventory_id: opnameForm.inventory_id,
        system_stock: systemStock,
        physical_stock: physicalStock,
        notes: opnameForm.notes,
        operator_id: profile?.id
      };

      if (editingOpnameId) {
        const { error } = await supabase.from('stock_opname').update(payload).eq('id', editingOpnameId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('stock_opname').insert([payload]);
        if (error) throw error;
      }

      await supabase.from('inventory').update({ stock_gram: physicalStock }).eq('id', opnameForm.inventory_id);

      setIsOpnameModalOpen(false);
      setEditingOpnameId(null);
      setOpnameForm({ inventory_id: '', physical_stock: '', notes: '' });
      await fetchData();
      alert('Stock Opname berhasil disimpan!');
    } catch (error) {
      alert('Gagal: ' + error.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteOpname = async (id) => {
    if (!confirm('Hapus data stock opname ini?')) return;
    try {
      const { error } = await supabase.from('stock_opname').delete().eq('id', id);
      if (error) throw error;
      await fetchData();
    } catch (error) {
      alert('Gagal: ' + error.message);
    }
  };

  // --- 4. CRUD GRAMASI DAGING ---
  const handleSaveGramasi = async (e) => {
    e.preventDefault();
    setSubmitLoading(true);
    try {
      const initial = parseFloat(gramasiForm.initial_weight) || 0;
      const trimmed = parseFloat(gramasiForm.trimmed_weight) || 0;

      const payload = {
        inventory_id: gramasiForm.inventory_id,
        initial_weight: initial,
        trimmed_weight: trimmed,
        notes: gramasiForm.notes,
        operator_id: profile?.id
      };

      if (editingGramasiId) {
        const { error } = await supabase.from('meat_gramasi').update(payload).eq('id', editingGramasiId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('meat_gramasi').insert([payload]);
        if (error) throw error;
      }

      setIsGramasiModalOpen(false);
      setEditingGramasiId(null);
      setGramasiForm({ inventory_id: '', initial_weight: '', trimmed_weight: '', notes: '' });
      await fetchData();
      alert('Gramasi daging berhasil disimpan!');
    } catch (error) {
      alert('Gagal: ' + error.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteGramasi = async (id) => {
    if (!confirm('Hapus data gramasi ini?')) return;
    try {
      const { error } = await supabase.from('meat_gramasi').delete().eq('id', id);
      if (error) throw error;
      await fetchData();
    } catch (error) {
      alert('Gagal: ' + error.message);
    }
  };

  const handleDeleteUsage = async (id) => {
    if (!confirm('Hapus log penggunaan ini?')) return;
    try {
      const { error } = await supabase.from('stock_movements').delete().eq('id', id);
      if (error) throw error;
      await fetchData();
    } catch (error) {
      alert('Gagal: ' + error.message);
    }
  };

  const handleExportExcel = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Waktu,Keterangan,Menu,Jenis Daging,Tipe Gramasi,Berat Terpakai (g),Sisa Stok (g),Operator\n";

    usageLogs.forEach(row => {
      const dateStr = new Date(row.created_at).toLocaleString('id-ID');
      const line = `"${dateStr}","${row.notes || '-'}","-","${row.inventory?.item_name || 'Daging'}","Fleksibel","${Math.abs(row.gram_change)}","${row.remaining_gram}","${row.profiles?.full_name || 'Kasir'}"\n`;
      csvContent += line;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Rekap_Stok_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5">
      {/* =========================================================
          PAGE HEADER
          ========================================================= */}
      <section className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 shadow-2xl shadow-black/20">
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-orange-600/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-44 w-44 rounded-full bg-amber-500/5 blur-3xl" />

        <div className="relative flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-orange-500/15 bg-orange-500/5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-orange-300">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400 shadow-lg shadow-orange-500/40" />
              ASAP ISEP · Daging Asap
            </div>

            <h2 className="text-xl font-bold tracking-tight text-zinc-100 sm:text-2xl lg:text-[28px]">
              Manajemen Stok & Inventory
            </h2>
            <p className="mt-2 max-w-2xl text-xs leading-6 text-zinc-400 sm:text-sm">
              Kelola master barang, restock, opname, dan yield daging secara presisi dalam satu pusat kontrol.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto lg:shrink-0 lg:justify-end">
            {activeTab === 'inventory' && (
              <button
                onClick={() => {
                  setEditingInvId(null);
                  setInvForm({ item_name: '', category: 'restoran', stock_gram: '', unit: 'kg', min_stock: 1000 });
                  setIsInvModalOpen(true);
                }}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 text-sm font-semibold text-white shadow-lg shadow-orange-950/30 transition hover:from-orange-400 hover:to-orange-600 active:scale-[0.99] sm:w-auto"
              >
                <Plus className="h-4 w-4" />
                Tambah Item Master
              </button>
            )}

            {activeTab === 'restock' && (
              <button
                onClick={() => {
                  setEditingRestockId(null);
                  setIsRestockModalOpen(true);
                }}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 text-sm font-semibold text-white shadow-lg shadow-orange-950/30 transition hover:from-orange-400 hover:to-orange-600 active:scale-[0.99] sm:w-auto"
              >
                <Plus className="h-4 w-4" />
                Tambah Restock Daging
              </button>
            )}

            {activeTab === 'opname' && (
              <button
                onClick={() => {
                  setEditingOpnameId(null);
                  setIsOpnameModalOpen(true);
                }}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 text-sm font-semibold text-white shadow-lg shadow-orange-950/30 transition hover:from-orange-400 hover:to-orange-600 active:scale-[0.99] sm:w-auto"
              >
                <Plus className="h-4 w-4" />
                Input Stock Opname
              </button>
            )}

            {activeTab === 'gramasi' && (
              <button
                onClick={() => {
                  setEditingGramasiId(null);
                  setIsGramasiModalOpen(true);
                }}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 text-sm font-semibold text-white shadow-lg shadow-orange-950/30 transition hover:from-orange-400 hover:to-orange-600 active:scale-[0.99] sm:w-auto"
              >
                <Plus className="h-4 w-4" />
                Catat Trim Daging
              </button>
            )}

            <button
              onClick={handleExportExcel}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 text-sm font-semibold text-emerald-300 transition hover:border-emerald-400/30 hover:bg-emerald-500/15 active:scale-[0.99] sm:w-auto"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Export Excel
            </button>
          </div>
        </div>
      </section>

      {/* =========================================================
          TAB NAVIGATION
          ========================================================= */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-2 shadow-xl shadow-black/10 backdrop-blur-sm">
        <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[
            { id: 'inventory', icon: Package, label: 'Master Inventory' },
            { id: 'usage', icon: History, label: 'History Penggunaan' },
            { id: 'restock', icon: ShoppingCart, label: 'Riwayat Restock' },
            { id: 'opname', icon: Archive, label: 'Stock Opname' },
            { id: 'gramasi', icon: Scale, label: 'Gramasi & Yield' },
          ].map(({ id, icon: Icon, label }) => {
            const selected = activeTab === id;

            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`group inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border px-3.5 text-xs font-semibold transition-all sm:px-4 ${
                  selected
                    ? 'border-orange-400/20 bg-gradient-to-r from-orange-500 to-orange-700 text-white shadow-lg shadow-orange-950/30'
                    : 'border-transparent text-zinc-400 hover:border-zinc-800 hover:bg-white/[0.035] hover:text-zinc-200'
                }`}
              >
                <Icon className={`h-4 w-4 ${selected ? 'text-orange-100' : 'text-zinc-500 group-hover:text-zinc-300'}`} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* =========================================================
          MASTER INVENTORY
          ========================================================= */}
      {activeTab === 'inventory' && (
        <section className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 shadow-xl shadow-black/15">
          <div className="flex flex-col gap-3 border-b border-zinc-800 bg-gradient-to-r from-zinc-900 to-zinc-950 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-orange-500/15 bg-orange-500/10 text-orange-300">
                  <Package className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-bold text-zinc-100 sm:text-base">Master Inventory</h3>
              </div>
              <p className="mt-2 pl-11 text-xs text-zinc-500">Daftar bahan baku dan daging yang terdaftar dalam sistem.</p>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[260px] items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-zinc-500">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950">
                  <Loader2 className="h-6 w-6 animate-spin text-orange-400" />
                </div>
                <span className="text-xs">Memuat data inventory...</span>
              </div>
            </div>
          ) : inventory.length === 0 ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 text-zinc-600">
                <Package className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-zinc-300">Belum ada master inventory</p>
              <p className="mt-1 max-w-sm text-xs leading-5 text-zinc-500">Tambahkan item pertama agar stok dapat mulai dicatat dan dipantau.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[880px] w-full text-left">
                <thead className="bg-zinc-950/70">
                  <tr className="border-b border-zinc-800">
                    <th className="px-5 py-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Nama Barang</th>
                    <th className="px-5 py-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Kategori</th>
                    <th className="px-5 py-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Stok Saat Ini</th>
                    <th className="px-5 py-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Min. Stok</th>
                    <th className="px-5 py-4 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80">
                  {inventory.map((item) => {
                    const stock = item.stock_gram ?? item.stock_qty ?? 0;
                    const minimum = item.min_stock || 1000;
                    const isLow = Number(stock) <= Number(minimum);

                    return (
                      <tr key={item.id} className="group transition-colors hover:bg-orange-500/[0.025]">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-orange-300">
                              <Package className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-zinc-100">{item.item_name}</p>
                              <p className="mt-0.5 text-[10px] text-zinc-600">ID: {item.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex rounded-full border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-[10px] font-semibold capitalize text-zinc-400">
                            {item.category}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-bold tabular-nums text-orange-300">
                              {stock} {item.unit || 'g'}
                            </span>
                            {isLow ? (
                              <span className="inline-flex w-fit items-center gap-1 rounded-full border border-amber-500/15 bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold text-amber-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                                Stok rendah
                              </span>
                            ) : (
                              <span className="inline-flex w-fit items-center gap-1 rounded-full border border-emerald-500/15 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold text-emerald-300">
                                <CheckCircle2 className="h-3 w-3" />
                                Aman
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-sm text-zinc-400 tabular-nums">
                          {minimum} {item.unit || 'g'}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleEditInventory(item)}
                              title="Edit inventory"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-400 transition hover:border-orange-500/20 hover:bg-orange-500/10 hover:text-orange-300"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteInventory(item.id)}
                              title="Hapus inventory"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-red-400 transition hover:border-red-500/20 hover:bg-red-500/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* =========================================================
          USAGE HISTORY
          ========================================================= */}
      {activeTab === 'usage' && (
        <section className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 shadow-xl shadow-black/15">
          <div className="border-b border-zinc-800 bg-gradient-to-r from-zinc-900 to-zinc-950 px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-orange-500/15 bg-orange-500/10 text-orange-300">
                <History className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-100 sm:text-base">History Penggunaan Daging</h3>
                <p className="mt-1 text-xs text-zinc-500">Rekap kronologis penggunaan stok yang tercatat pada sistem.</p>
              </div>
            </div>
          </div>

          {usageLogs.length === 0 ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 text-zinc-600">
                <History className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-zinc-300">Belum ada riwayat penggunaan</p>
              <p className="mt-1 max-w-sm text-xs text-zinc-500">Riwayat akan muncul ketika stok digunakan oleh transaksi.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1280px] w-full text-left">
                <thead className="bg-zinc-950/70">
                  <tr className="border-b border-zinc-800">
                    <th className="px-4 py-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Tanggal & Jam</th>
                    <th className="px-4 py-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Keterangan / Meja</th>
                    <th className="px-4 py-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Menu Dipesan</th>
                    <th className="px-4 py-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Jenis Daging</th>
                    <th className="px-4 py-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Tipe Gramasi</th>
                    <th className="px-4 py-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Berat Terpakai</th>
                    <th className="px-4 py-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Sisa Stok</th>
                    <th className="px-4 py-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Operator</th>
                    <th className="px-4 py-4 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80">
                  {usageLogs.map((log) => (
                    <tr key={log.id} className="transition-colors hover:bg-orange-500/[0.025]">
                      <td className="px-4 py-4 text-xs text-zinc-500">{new Date(log.created_at).toLocaleString('id-ID')}</td>
                      <td className="px-4 py-4 font-medium text-zinc-200">{log.notes || '-'}</td>
                      <td className="px-4 py-4 text-xs text-zinc-400">Menu Asap</td>
                      <td className="px-4 py-4 font-semibold text-orange-300">{log.inventory?.item_name || 'Daging'}</td>
                      <td className="px-4 py-4">
                        <span className="rounded-full border border-orange-500/15 bg-orange-500/10 px-2.5 py-1 text-[10px] font-semibold text-orange-300">Fleksibel</span>
                      </td>
                      <td className="px-4 py-4 font-bold tabular-nums text-red-300">{Math.abs(log.gram_change)} g</td>
                      <td className="px-4 py-4 font-semibold tabular-nums text-zinc-200">{log.remaining_gram} g</td>
                      <td className="px-4 py-4 text-xs text-zinc-500">{log.profiles?.full_name || 'Kasir'}</td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end">
                          <button
                            onClick={() => handleDeleteUsage(log.id)}
                            title="Hapus log penggunaan"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-red-400 transition hover:border-red-500/20 hover:bg-red-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* =========================================================
          RESTOCK HISTORY
          ========================================================= */}
      {activeTab === 'restock' && (
        <section className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 shadow-xl shadow-black/15">
          <div className="border-b border-zinc-800 bg-gradient-to-r from-zinc-900 to-zinc-950 px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/15 bg-emerald-500/10 text-emerald-300">
                <ShoppingCart className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-100 sm:text-base">Riwayat Restock Masuk</h3>
                <p className="mt-1 text-xs text-zinc-500">Pantau penambahan stok dan asal restock yang telah dicatat.</p>
              </div>
            </div>
          </div>

          {restockLogs.length === 0 ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 text-zinc-600">
                <ShoppingCart className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-zinc-300">Belum ada riwayat restock</p>
              <p className="mt-1 max-w-sm text-xs text-zinc-500">Data akan tampil setelah restock berhasil dicatat.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[920px] w-full text-left">
                <thead className="bg-zinc-950/70">
                  <tr className="border-b border-zinc-800">
                    <th className="px-5 py-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Waktu</th>
                    <th className="px-5 py-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Barang</th>
                    <th className="px-5 py-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Masuk</th>
                    <th className="px-5 py-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Sisa Stok</th>
                    <th className="px-5 py-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Supplier / Keterangan</th>
                    <th className="px-5 py-4 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80">
                  {restockLogs.map((log) => (
                    <tr key={log.id} className="transition-colors hover:bg-emerald-500/[0.025]">
                      <td className="px-5 py-4 text-xs text-zinc-500">{new Date(log.created_at).toLocaleString('id-ID')}</td>
                      <td className="px-5 py-4 font-semibold text-zinc-200">{log.inventory?.item_name}</td>
                      <td className="px-5 py-4 font-bold tabular-nums text-emerald-300">+{log.gram_change} g</td>
                      <td className="px-5 py-4 font-semibold tabular-nums text-zinc-200">{log.remaining_gram} g</td>
                      <td className="px-5 py-4 text-xs text-zinc-500">{log.notes || '-'}</td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end">
                          <button
                            onClick={() => handleDeleteRestock(log.id)}
                            title="Hapus log restock"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-red-400 transition hover:border-red-500/20 hover:bg-red-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* =========================================================
          STOCK OPNAME
          ========================================================= */}
      {activeTab === 'opname' && (
        <section className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 shadow-xl shadow-black/15">
          <div className="border-b border-zinc-800 bg-gradient-to-r from-zinc-900 to-zinc-950 px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/15 bg-amber-500/10 text-amber-300">
                <Archive className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-100 sm:text-base">Riwayat Audit Stock Opname</h3>
                <p className="mt-1 text-xs text-zinc-500">Bandingkan stok sistem dengan stok fisik aktual.</p>
              </div>
            </div>
          </div>

          {opnameLogs.length === 0 ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 text-zinc-600">
                <Archive className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-zinc-300">Belum ada riwayat stock opname</p>
              <p className="mt-1 max-w-sm text-xs text-zinc-500">Gunakan tombol Input Stock Opname untuk mencatat pemeriksaan fisik.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full text-left">
                <thead className="bg-zinc-950/70">
                  <tr className="border-b border-zinc-800">
                    <th className="px-5 py-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Waktu</th>
                    <th className="px-5 py-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Barang</th>
                    <th className="px-5 py-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Sistem</th>
                    <th className="px-5 py-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Fisik</th>
                    <th className="px-5 py-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Selisih</th>
                    <th className="px-5 py-4 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80">
                  {opnameLogs.map((log) => (
                    <tr key={log.id} className="transition-colors hover:bg-amber-500/[0.025]">
                      <td className="px-5 py-4 text-xs text-zinc-500">{new Date(log.created_at).toLocaleString('id-ID')}</td>
                      <td className="px-5 py-4 font-semibold text-zinc-200">{log.inventory?.item_name}</td>
                      <td className="px-5 py-4 text-sm tabular-nums text-zinc-400">{log.system_stock}</td>
                      <td className="px-5 py-4 font-bold tabular-nums text-orange-300">{log.physical_stock}</td>
                      <td className="px-5 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${Number(log.discrepancy) === 0 ? 'border border-emerald-500/15 bg-emerald-500/10 text-emerald-300' : 'border border-amber-500/15 bg-amber-500/10 text-amber-300'}`}>
                          {log.discrepancy}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end">
                          <button
                            onClick={() => handleDeleteOpname(log.id)}
                            title="Hapus stock opname"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-red-400 transition hover:border-red-500/20 hover:bg-red-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* =========================================================
          GRAMASI
          ========================================================= */}
      {activeTab === 'gramasi' && (
        <section className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 shadow-xl shadow-black/15">
          <div className="border-b border-zinc-800 bg-gradient-to-r from-zinc-900 to-zinc-950 px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-orange-500/15 bg-orange-500/10 text-orange-300">
                <Scale className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-100 sm:text-base">Yield & Trim Daging</h3>
                <p className="mt-1 text-xs text-zinc-500">Pantau berat awal, berat bersih, dan persentase yield daging.</p>
              </div>
            </div>
          </div>

          {gramasiLogs.length === 0 ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 text-zinc-600">
                <Scale className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-zinc-300">Belum ada catatan gramasi</p>
              <p className="mt-1 max-w-sm text-xs text-zinc-500">Catat proses trimming untuk mulai membangun histori yield daging.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full text-left">
                <thead className="bg-zinc-950/70">
                  <tr className="border-b border-zinc-800">
                    <th className="px-5 py-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Waktu</th>
                    <th className="px-5 py-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Jenis Daging</th>
                    <th className="px-5 py-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Awal</th>
                    <th className="px-5 py-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Bersih</th>
                    <th className="px-5 py-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Yield</th>
                    <th className="px-5 py-4 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80">
                  {gramasiLogs.map((log) => (
                    <tr key={log.id} className="transition-colors hover:bg-orange-500/[0.025]">
                      <td className="px-5 py-4 text-xs text-zinc-500">{new Date(log.created_at).toLocaleString('id-ID')}</td>
                      <td className="px-5 py-4 font-semibold text-zinc-200">{log.inventory?.item_name}</td>
                      <td className="px-5 py-4 text-sm tabular-nums text-zinc-400">{log.initial_weight} g</td>
                      <td className="px-5 py-4 font-semibold tabular-nums text-orange-300">{log.trimmed_weight} g</td>
                      <td className="px-5 py-4">
                        <span className="inline-flex rounded-full border border-orange-500/15 bg-orange-500/10 px-2.5 py-1 text-[10px] font-bold tabular-nums text-orange-300">
                          {log.yield_percentage}%
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end">
                          <button
                            onClick={() => handleDeleteGramasi(log.id)}
                            title="Hapus data gramasi"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-red-400 transition hover:border-red-500/20 hover:bg-red-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* =========================================================
          MODAL: MASTER INVENTORY
          ========================================================= */}
      {isInvModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
          <div className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-zinc-800 bg-zinc-900 shadow-2xl shadow-black/40">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-700" />

            <div className="flex items-center justify-between gap-4 border-b border-zinc-800 px-5 py-4 sm:px-6">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-orange-300">ASAP ISEP</p>
                <h3 className="mt-1 text-base font-bold text-zinc-100 sm:text-lg">
                  {editingInvId ? 'Edit Master Item' : 'Tambah Master Item'}
                </h3>
              </div>
              <button
                onClick={() => setIsInvModalOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-500 transition hover:border-zinc-700 hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveInventory} className="space-y-5 p-5 sm:p-6">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300">Nama Barang / Daging</label>
                <input
                  type="text"
                  required
                  value={invForm.item_name}
                  onChange={(e) => setInvForm({ ...invForm, item_name: e.target.value })}
                  placeholder="Misal: Brisket Sapi"
                  className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-700 focus:border-orange-500/40 focus:ring-4 focus:ring-orange-500/10"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-300">Stok Awal</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={invForm.stock_gram}
                    onChange={(e) => setInvForm({ ...invForm, stock_gram: e.target.value })}
                    placeholder="10000"
                    className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-700 focus:border-orange-500/40 focus:ring-4 focus:ring-orange-500/10"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-300">Satuan</label>
                  <select
                    value={invForm.unit}
                    onChange={(e) => setInvForm({ ...invForm, unit: e.target.value })}
                    className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 text-sm text-zinc-100 outline-none transition focus:border-orange-500/40 focus:ring-4 focus:ring-orange-500/10"
                  >
                    <option value="kg">kg</option>
                    <option value="gram">gram</option>
                    <option value="pack">pack</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-zinc-800 pt-4 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setIsInvModalOpen(false)} className="h-11 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800">
                  Batal
                </button>
                <button type="submit" disabled={submitLoading} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-5 text-sm font-semibold text-white shadow-lg shadow-orange-950/25 transition hover:from-orange-400 hover:to-orange-600 disabled:cursor-not-allowed disabled:opacity-60">
                  {submitLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL: RESTOCK
          ========================================================= */}
      {isRestockModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
          <div className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-zinc-800 bg-zinc-900 shadow-2xl shadow-black/40">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 via-orange-400 to-orange-700" />

            <div className="flex items-center justify-between gap-4 border-b border-zinc-800 px-5 py-4 sm:px-6">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300">Restock</p>
                <h3 className="mt-1 text-base font-bold text-zinc-100 sm:text-lg">Tambah Restock Daging</h3>
              </div>
              <button onClick={() => setIsRestockModalOpen(false)} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-500 transition hover:border-zinc-700 hover:text-zinc-200">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRestock} className="space-y-5 p-5 sm:p-6">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300">Nama Barang / Daging</label>
                <input type="text" required value={restockForm.item_name} onChange={(e) => setRestockForm({ ...restockForm, item_name: e.target.value })} className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 text-sm text-zinc-100 outline-none transition focus:border-orange-500/40 focus:ring-4 focus:ring-orange-500/10" />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-300">Jumlah (Qty)</label>
                  <input type="number" step="any" required value={restockForm.qty} onChange={(e) => setRestockForm({ ...restockForm, qty: e.target.value })} placeholder="10" className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-700 focus:border-orange-500/40 focus:ring-4 focus:ring-orange-500/10" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-300">Satuan</label>
                  <select value={restockForm.unit} onChange={(e) => setRestockForm({ ...restockForm, unit: e.target.value })} className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 text-sm text-zinc-100 outline-none transition focus:border-orange-500/40 focus:ring-4 focus:ring-orange-500/10">
                    <option value="kg">kg</option>
                    <option value="gram">gram</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300">Harga Satuan (Rp)</label>
                <input type="number" required value={restockForm.unit_price} onChange={(e) => setRestockForm({ ...restockForm, unit_price: e.target.value })} placeholder="160000" className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-700 focus:border-orange-500/40 focus:ring-4 focus:ring-orange-500/10" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300">Supplier</label>
                <input type="text" value={restockForm.supplier} onChange={(e) => setRestockForm({ ...restockForm, supplier: e.target.value })} placeholder="Toko Daging Segar" className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-700 focus:border-orange-500/40 focus:ring-4 focus:ring-orange-500/10" />
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-zinc-800 pt-4 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setIsRestockModalOpen(false)} className="h-11 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800">
                  Batal
                </button>
                <button type="submit" disabled={submitLoading} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-5 text-sm font-semibold text-white shadow-lg shadow-orange-950/25 transition hover:from-orange-400 hover:to-orange-600 disabled:cursor-not-allowed disabled:opacity-60">
                  {submitLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL: STOCK OPNAME
          ========================================================= */}
      {isOpnameModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
          <div className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-zinc-800 bg-zinc-900 shadow-2xl shadow-black/40">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-orange-700" />

            <div className="flex items-center justify-between gap-4 border-b border-zinc-800 px-5 py-4 sm:px-6">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300">Audit Stok</p>
                <h3 className="mt-1 text-base font-bold text-zinc-100 sm:text-lg">Form Stock Opname</h3>
              </div>
              <button onClick={() => setIsOpnameModalOpen(false)} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-500 transition hover:border-zinc-700 hover:text-zinc-200">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveOpname} className="space-y-5 p-5 sm:p-6">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300">Pilih Barang</label>
                <select required value={opnameForm.inventory_id} onChange={(e) => setOpnameForm({ ...opnameForm, inventory_id: e.target.value })} className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 text-sm text-zinc-100 outline-none transition focus:border-orange-500/40 focus:ring-4 focus:ring-orange-500/10">
                  <option value="">-- Pilih --</option>
                  {inventory.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.item_name} ({inv.stock_gram ?? inv.stock_qty} {inv.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-2xl border border-amber-500/10 bg-amber-500/[0.04] p-4">
                <div className="mb-3 flex items-center gap-2 text-amber-300">
                  <Archive className="h-4 w-4" />
                  <span className="text-xs font-semibold">Stok Fisik Aktual</span>
                </div>
                <input type="number" step="any" required value={opnameForm.physical_stock} onChange={(e) => setOpnameForm({ ...opnameForm, physical_stock: e.target.value })} placeholder="Masukkan jumlah..." className="h-12 w-full rounded-xl border border-amber-500/10 bg-zinc-950 px-3.5 text-sm font-semibold text-zinc-100 outline-none transition placeholder:text-zinc-700 focus:border-amber-400/40 focus:ring-4 focus:ring-amber-500/10" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300">Catatan</label>
                <textarea rows="3" value={opnameForm.notes} onChange={(e) => setOpnameForm({ ...opnameForm, notes: e.target.value })} placeholder="Contoh: Selisih karena trimming / waste..." className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 p-3.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-700 focus:border-orange-500/40 focus:ring-4 focus:ring-orange-500/10" />
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-zinc-800 pt-4 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setIsOpnameModalOpen(false)} className="h-11 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800">Batal</button>
                <button type="submit" disabled={submitLoading} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-5 text-sm font-semibold text-white shadow-lg shadow-orange-950/25 transition hover:from-orange-400 hover:to-orange-600 disabled:cursor-not-allowed disabled:opacity-60">
                  {submitLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL: GRAMASI
          ========================================================= */}
      {isGramasiModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
          <div className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-zinc-800 bg-zinc-900 shadow-2xl shadow-black/40">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-400 via-amber-400 to-orange-700" />

            <div className="flex items-center justify-between gap-4 border-b border-zinc-800 px-5 py-4 sm:px-6">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-orange-300">Daging Asap</p>
                <h3 className="mt-1 text-base font-bold text-zinc-100 sm:text-lg">Kalkulator Yield & Trim Daging</h3>
              </div>
              <button onClick={() => setIsGramasiModalOpen(false)} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-500 transition hover:border-zinc-700 hover:text-zinc-200">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveGramasi} className="space-y-5 p-5 sm:p-6">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300">Jenis Daging</label>
                <select required value={gramasiForm.inventory_id} onChange={(e) => setGramasiForm({ ...gramasiForm, inventory_id: e.target.value })} className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 text-sm text-zinc-100 outline-none transition focus:border-orange-500/40 focus:ring-4 focus:ring-orange-500/10">
                  <option value="">-- Pilih --</option>
                  {inventory.map((inv) => (
                    <option key={inv.id} value={inv.id}>{inv.item_name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                  <label className="mb-2 block text-xs font-semibold text-zinc-300">Berat Awal (g)</label>
                  <input type="number" step="any" required value={gramasiForm.initial_weight} onChange={(e) => setGramasiForm({ ...gramasiForm, initial_weight: e.target.value })} placeholder="1000" className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-700 focus:border-orange-500/40 focus:ring-4 focus:ring-orange-500/10" />
                </div>
                <div className="rounded-2xl border border-orange-500/10 bg-orange-500/[0.04] p-4">
                  <label className="mb-2 block text-xs font-semibold text-orange-200">Berat Bersih (g)</label>
                  <input type="number" step="any" required value={gramasiForm.trimmed_weight} onChange={(e) => setGramasiForm({ ...gramasiForm, trimmed_weight: e.target.value })} placeholder="850" className="h-11 w-full rounded-xl border border-orange-500/10 bg-zinc-950 px-3.5 text-sm font-semibold text-zinc-100 outline-none transition placeholder:text-zinc-700 focus:border-orange-400/40 focus:ring-4 focus:ring-orange-500/10" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300">Catatan</label>
                <textarea rows="3" value={gramasiForm.notes} onChange={(e) => setGramasiForm({ ...gramasiForm, notes: e.target.value })} placeholder="Catatan trimming / proses daging..." className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 p-3.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-700 focus:border-orange-500/40 focus:ring-4 focus:ring-orange-500/10" />
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-zinc-800 pt-4 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setIsGramasiModalOpen(false)} className="h-11 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800">Batal</button>
                <button type="submit" disabled={submitLoading} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-5 text-sm font-semibold text-white shadow-lg shadow-orange-950/25 transition hover:from-orange-400 hover:to-orange-600 disabled:cursor-not-allowed disabled:opacity-60">
                  {submitLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
