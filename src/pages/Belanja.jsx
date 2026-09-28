import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { 
  ShoppingCart, Plus, Search, Trash2, Edit, X, 
  Loader2, DollarSign, Package, Calendar, FileText, ArrowDownRight
} from 'lucide-react';

export default function Belanja() {
  const { profile } = useAuth();
  const [purchases, setPurchases] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // State Modal Form Belanja
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    category: 'restoran',
    item_name: '',
    qty: '',
    unit: 'kg',
    unit_price: '',
    supplier: '',
    payment_method: 'cash',
    is_stock_item: true,
    note_photo_url: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      // 1. Ambil data purchases
      const { data: purchaseData, error: purchaseError } = await supabase
        .from('purchases')
        .select(`*, profiles(full_name)`)
        .order('purchase_date', { ascending: false });

      if (purchaseError) throw purchaseError;
      setPurchases(purchaseData || []);

      // 2. Ambil data inventory untuk referensi stok
      const { data: invData } = await supabase.from('inventory').select('*');
      setInventory(invData || []);

    } catch (error) {
      console.error('Error fetching purchases:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter purchases
  const filteredPurchases = purchases.filter(item => {
    const matchesSearch = item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.supplier?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = categoryFilter === 'all' || item.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData({
      category: 'restoran',
      item_name: '',
      qty: '',
      unit: 'kg',
      unit_price: '',
      supplier: '',
      payment_method: 'cash',
      is_stock_item: true,
      note_photo_url: ''
    });
    setIsModalOpen(true);
  };

  // Simpan Data Belanja & Integrasi Stok Otomatis
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitLoading(true);

    try {
      const qtyNum = parseFloat(formData.qty) || 0;
      const priceNum = parseFloat(formData.unit_price) || 0;
      const totalPrice = qtyNum * priceNum;

      const payload = {
        category: formData.category,
        item_name: formData.item_name,
        qty: qtyNum,
        unit: formData.unit,
        unit_price: priceNum,
        total_price: totalPrice,
        supplier: formData.supplier,
        payment_method: formData.payment_method,
        is_stock_item: formData.is_stock_item,
        note_photo_url: formData.note_photo_url,
        created_by: profile?.id
      };

      if (editingId) {
        // Mode Edit
        const { error } = await supabase
          .from('purchases')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
      } else {
        // Mode Tambah Baru
        const { data: newPurchase, error: insertError } = await supabase
          .from('purchases')
          .insert([payload])
          .select()
          .single();

        if (insertError) throw insertError;

        // JIKA DITANDAI SEBAGAI ITEM STOK, OTOMATIS TAMBAHKAN KE INVENTORY & STOCK MOVEMENTS
        if (formData.is_stock_item) {
          // Cek apakah item sudah ada di tabel inventory
          const existingInv = inventory.find(
            inv => inv.item_name.toLowerCase() === formData.item_name.toLowerCase()
          );

          let targetInvId;
          let calculatedGram = 0;

          // Konversi ke gram jika satuan kg atau gram
          if (formData.unit.toLowerCase() === 'kg') {
            calculatedGram = qtyNum * 1000;
          } else if (formData.unit.toLowerCase() === 'gram') {
            calculatedGram = qtyNum;
          }

          if (existingInv) {
            targetInvId = existingInv.id;
            const newStockGram = (existingInv.stock_gram || 0) + calculatedGram;
            const newStockQty = (existingInv.stock_qty || 0) + qtyNum;

            // Update inventory
            await supabase
              .from('inventory')
              .update({ stock_gram: newStockGram, stock_qty: newStockQty })
              .eq('id', targetInvId);

          } else {
            // Buat record baru di inventory jika belum ada
            const { data: newInv, error: invError } = await supabase
              .from('inventory')
              .insert([{
                item_name: formData.item_name,
                category: formData.category,
                stock_gram: calculatedGram,
                stock_qty: qtyNum,
                unit: formData.unit,
                min_stock: 1000 // default 1kg
              }])
              .select()
              .single();

            if (invError) throw invError;
            targetInvId = newInv.id;
          }

          // Catat Stock Movement (Restock)
          if (targetInvId && calculatedGram > 0) {
            const currentInv = inventory.find(i => i.id === targetInvId);
            const currentGram = currentInv ? currentInv.stock_gram : 0;
            const remainingGram = currentGram + calculatedGram;

            await supabase
              .from('stock_movements')
              .insert([{
                inventory_id: targetInvId,
                movement_type: 'restock',
                gram_change: calculatedGram,
                remaining_gram: remainingGram,
                operator_id: profile?.id,
                notes: `Pembelian dari ${formData.supplier || 'Supplier'} (${qtyNum} ${formData.unit})`
              }]);
          }
        }
      }

      setIsModalOpen(false);
      await fetchData();
      alert('Data belanja berhasil disimpan dan stok otomatis diperbarui!');

    } catch (error) {
      alert('Gagal menyimpan belanja: ' + error.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Apakah Anda yakin ingin menghapus catatan belanja ini?')) return;

    try {
      const { error } = await supabase.from('purchases').delete().eq('id', id);
      if (error) throw error;
      await fetchData();
    } catch (error) {
      alert('Gagal menghapus data: ' + error.message);
    }
  };

  const formatRupiah = (num) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-100 tracking-tight">Belanja Operasional & Stok</h2>
          <p className="text-sm text-zinc-400 mt-1">Catat pengeluaran belanja yang otomatis terintegrasi ke inventory.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Cari barang / supplier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-64 bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <button 
            onClick={handleOpenAdd}
            className="flex items-center justify-center gap-2 bg-primary hover:bg-amber-600 text-zinc-950 font-semibold px-4 py-2 rounded-xl transition-colors text-sm shadow-lg shadow-amber-900/20"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Belanja</span>
          </button>
        </div>
      </div>

      {/* Filter Kategori */}
      <div className="flex gap-2 bg-zinc-900 p-3 rounded-2xl border border-zinc-800 text-xs">
        <span className="px-3 py-1.5 text-zinc-400 font-medium self-center">Kategori:</span>
        <button onClick={() => setCategoryFilter('all')} className={`px-3 py-1.5 rounded-xl transition-colors ${categoryFilter === 'all' ? 'bg-primary text-zinc-950 font-semibold' : 'text-zinc-400 hover:text-zinc-200'}`}>Semua</button>
        <button onClick={() => setCategoryFilter('restoran')} className={`px-3 py-1.5 rounded-xl transition-colors ${categoryFilter === 'restoran' ? 'bg-primary text-zinc-950 font-semibold' : 'text-zinc-400 hover:text-zinc-200'}`}>Restoran</button>
        <button onClick={() => setCategoryFilter('penginapan')} className={`px-3 py-1.5 rounded-xl transition-colors ${categoryFilter === 'penginapan' ? 'bg-primary text-zinc-950 font-semibold' : 'text-zinc-400 hover:text-zinc-200'}`}>Penginapan</button>
        <button onClick={() => setCategoryFilter('operasional')} className={`px-3 py-1.5 rounded-xl transition-colors ${categoryFilter === 'operasional' ? 'bg-primary text-zinc-950 font-semibold' : 'text-zinc-400 hover:text-zinc-200'}`}>Operasional</button>
      </div>

      {/* Tabel Riwayat Belanja */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
            <Loader2 className="animate-spin h-8 w-8 mb-4 text-primary" />
            <p>Memuat data belanja...</p>
          </div>
        ) : filteredPurchases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500 text-center px-4">
            <div className="w-16 h-16 bg-zinc-950 rounded-full flex items-center justify-center mb-4">
              <ShoppingCart className="h-8 w-8 text-zinc-600" />
            </div>
            <p className="font-medium text-zinc-300">Belum ada catatan belanja</p>
            <p className="text-sm mt-1">Klik tombol "Tambah Belanja" untuk mencatat pengeluaran.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-300">
              <thead className="bg-zinc-950/50 text-xs uppercase font-semibold text-zinc-400 border-b border-zinc-800">
                <tr>
                  <th className="px-6 py-4">Tanggal</th>
                  <th className="px-6 py-4">Nama Barang</th>
                  <th className="px-6 py-4">Kategori & Qty</th>
                  <th className="px-6 py-4">Total Harga</th>
                  <th className="px-6 py-4">Supplier & Bayar</th>
                  <th className="px-6 py-4">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filteredPurchases.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-800/50 transition-colors">
                    <td className="px-6 py-4 text-xs text-zinc-400">
                      {new Date(item.purchase_date).toLocaleDateString('id-ID', { dateStyle: 'medium' })}
                    </td>
                    <td className="px-6 py-4 font-medium text-zinc-100">
                      {item.item_name}
                      {item.is_stock_item && (
                        <span className="block text-[10px] text-primary font-semibold uppercase tracking-wider">
                          📦 Terintegrasi Stok
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="capitalize px-2 py-0.5 bg-zinc-950 rounded text-xs border border-zinc-800 mr-2">
                        {item.category}
                      </span>
                      <span className="font-semibold text-zinc-200">{item.qty} {item.unit}</span>
                    </td>
                    <td className="px-6 py-4 font-bold text-primary">
                      {formatRupiah(item.total_price)}
                    </td>
                    <td className="px-6 py-4 text-xs text-zinc-400">
                      <p className="font-medium text-zinc-200">{item.supplier || 'Supplier Umum'}</p>
                      <p className="uppercase text-[10px] text-zinc-500">{item.payment_method}</p>
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => handleDelete(item.id)}
                        className="p-2 bg-zinc-800 hover:bg-red-950/50 text-zinc-400 hover:text-red-400 rounded-lg border border-zinc-700 transition-colors"
                        title="Hapus"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL TAMBAH BELANJA */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl relative my-8">
            
            <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 p-5 rounded-t-2xl flex justify-between items-center z-10">
              <div>
                <h3 className="text-lg font-bold text-zinc-100">Catat Belanja Operasional</h3>
                <p className="text-xs text-zinc-400 mt-1">Belanja stok akan otomatis menambah inventory.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-xl">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-400 font-medium">Kategori</label>
                  <select 
                    value={formData.category} 
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:border-primary focus:outline-none capitalize"
                  >
                    <option value="restoran">Restoran</option>
                    <option value="penginapan">Penginapan</option>
                    <option value="operasional">Operasional</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-400 font-medium">Metode Bayar</label>
                  <select 
                    value={formData.payment_method} 
                    onChange={(e) => setFormData({...formData, payment_method: e.target.value})}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:border-primary focus:outline-none uppercase"
                  >
                    <option value="cash">Cash</option>
                    <option value="qris">QRIS</option>
                    <option value="transfer">Transfer</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400 font-medium">Nama Barang / Bahan</label>
                <input 
                  type="text" 
                  required 
                  value={formData.item_name} 
                  onChange={(e) => setFormData({...formData, item_name: e.target.value})}
                  placeholder="Misal: Daging Brisket Sapi" 
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:border-primary focus:outline-none" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-400 font-medium">Jumlah (Qty)</label>
                  <input 
                    type="number" 
                    step="any"
                    required 
                    value={formData.qty} 
                    onChange={(e) => setFormData({...formData, qty: e.target.value})}
                    placeholder="10" 
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:border-primary focus:outline-none" 
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-400 font-medium">Satuan</label>
                  <select 
                    value={formData.unit} 
                    onChange={(e) => setFormData({...formData, unit: e.target.value})}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:border-primary focus:outline-none"
                  >
                    <option value="kg">Kilogram (kg)</option>
                    <option value="gram">Gram (g)</option>
                    <option value="pcs">Pcs / Buah</option>
                    <option value="pack">Pack / Dus</option>
                    <option value="liter">Liter</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400 font-medium">Harga Satuan (Rp)</label>
                <div className="relative">
                  <span className="absolute left-4 top-2.5 text-zinc-500 text-sm">Rp</span>
                  <input 
                    type="number" 
                    required 
                    value={formData.unit_price} 
                    onChange={(e) => setFormData({...formData, unit_price: e.target.value})}
                    placeholder="150000" 
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-100 focus:border-primary focus:outline-none" 
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400 font-medium">Supplier / Toko</label>
                <input 
                  type="text" 
                  value={formData.supplier} 
                  onChange={(e) => setFormData({...formData, supplier: e.target.value})}
                  placeholder="Pasar / Toko Daging Segar" 
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:border-primary focus:outline-none" 
                />
              </div>

              <div className="pt-2 border-t border-zinc-800">
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-zinc-800 bg-zinc-950/50 hover:bg-zinc-800 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={formData.is_stock_item}
                    onChange={(e) => setFormData({...formData, is_stock_item: e.target.checked})}
                    className="w-4 h-4 accent-primary rounded bg-zinc-900 border-zinc-700"
                  />
                  <div>
                    <p className="text-sm font-medium text-zinc-200">Tandai sebagai Item Stok / Daging</p>
                    <p className="text-xs text-zinc-500">Otomatis menambah stok inventory database & stock movement.</p>
                  </div>
                </label>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-zinc-800">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  disabled={submitLoading}
                  className="px-5 py-2.5 text-sm font-semibold bg-primary hover:bg-amber-600 text-zinc-950 rounded-xl transition-colors flex items-center gap-2 shadow-lg shadow-amber-900/20 disabled:opacity-50"
                >
                  {submitLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>Simpan & Update Stok</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}