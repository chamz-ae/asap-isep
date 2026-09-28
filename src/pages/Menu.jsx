import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  UtensilsCrossed, Search, PlusCircle, X, Loader2, 
  Edit, Trash2, CheckCircle2, XCircle, Package, Scale
} from 'lucide-react';

export default function Menu() {
  const [menus, setMenus] = useState([]);
  const [inventoryList, setInventoryList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all'); // 'all', 'restoran', 'penginapan'
  const [typeFilter, setTypeFilter] = useState('all'); // 'all', 'makanan', 'minuman'

  // State Modal Form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    category: 'restoran',
    type: 'makanan',
    price: '',
    description: '',
    is_meat: false,
    inventory_id: '',
    meat_gram: '100',
    min_meat_gram: '30',
    is_ready: true
  });

  const fetchData = async () => {
    try {
      setLoading(true);

      // 1. Fetch data menu beserta relasi inventory jenis daging
      const { data: menuData, error: menuError } = await supabase
        .from('menus')
        .select(`*, inventory(id, item_name, stock_gram)`)
        .order('name', { ascending: true });
      
      if (menuError) {
        console.error('Error fetching menus with join, fallback to plain query:', menuError);
        // Fallback jika join error
        const { data: plainData, error: plainErr } = await supabase.from('menus').select('*').order('name');
        if (plainErr) throw plainErr;
        setMenus(plainData || []);
      } else {
        setMenus(menuData || []);
      }

      // 2. Fetch master inventory untuk dropdown pilihan jenis daging
      const { data: invData } = await supabase
        .from('inventory')
        .select('*')
        .order('item_name', { ascending: true });
      
      setInventoryList(invData || []);

    } catch (error) {
      console.error('Error fetching menus:', error);
      alert('Gagal mengambil data menu: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter menu berdasarkan search, kategori, & tipe
  const filteredMenus = menus.filter(menu => {
    const matchesSearch = menu.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || menu.category === categoryFilter;
    const matchesType = typeFilter === 'all' || menu.type === typeFilter;
    return matchesSearch && matchesCategory && matchesType;
  });

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData({
      name: '',
      category: 'restoran',
      type: 'makanan',
      price: '',
      description: '',
      is_meat: false,
      inventory_id: inventoryList.length > 0 ? inventoryList[0].id : '',
      meat_gram: '100',
      min_meat_gram: '30',
      is_ready: true
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (menu) => {
    setEditingId(menu.id);
    const isNasiGoreng = menu.name.toLowerCase().includes('nasi goreng');

    setFormData({
      name: menu.name || '',
      category: menu.category || 'restoran',
      type: menu.type || 'makanan',
      price: menu.price || '',
      description: menu.description || '',
      is_meat: !!menu.is_meat,
      inventory_id: menu.inventory_id || (inventoryList.length > 0 ? inventoryList[0].id : ''),
      meat_gram: menu.meat_gram || '100',
      min_meat_gram: menu.min_meat_gram || '30',
      is_ready: menu.is_ready ?? true
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitLoading(true);

    try {
      const isNasiGoreng = formData.name.toLowerCase().includes('nasi goreng');
      const isMeatActive = formData.type === 'makanan' && formData.is_meat;

      const payload = {
        name: formData.name,
        category: formData.category,
        type: formData.type,
        price: parseFloat(formData.price) || 0,
        description: formData.description,
        is_meat: isMeatActive,
        inventory_id: isMeatActive ? (formData.inventory_id || null) : null,
        meat_gram: isMeatActive ? (isNasiGoreng ? 30 : (parseFloat(formData.meat_gram) || 100)) : 0,
        min_meat_gram: isMeatActive ? (parseFloat(formData.min_meat_gram) || 30) : 0,
        gramasi_type: isMeatActive ? (isNasiGoreng ? 'fiks' : 'fleksibel') : 'none',
        is_ready: formData.is_ready
      };

      if (editingId) {
        const { error } = await supabase
          .from('menus')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('menus')
          .insert([payload]);
        if (error) throw error;
      }

      await fetchData();
      setIsModalOpen(false);
      alert('Menu berhasil disimpan!');
    } catch (error) {
      alert('Gagal menyimpan menu: ' + error.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Apakah Anda yakin ingin menghapus menu ini?')) return;

    try {
      const { error } = await supabase
        .from('menus')
        .delete()
        .eq('id', id);
      if (error) throw error;
      await fetchData();
      alert('Menu berhasil dihapus.');
    } catch (error) {
      alert('Gagal menghapus menu: ' + error.message);
    }
  };

  const handleToggleReady = async (menu) => {
    try {
      const { error } = await supabase
        .from('menus')
        .update({ is_ready: !menu.is_ready })
        .eq('id', menu.id);
      if (error) throw error;
      await fetchData();
    } catch (error) {
      alert('Gagal mengubah status menu: ' + error.message);
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
          <h2 className="text-2xl font-bold text-zinc-100 tracking-tight">Manajemen Menu & Daging</h2>
          <p className="text-sm text-zinc-400 mt-1">Kelola daftar menu makanan, minuman, harga, dan penautan jenis daging.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Cari nama menu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-60 bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <button 
            onClick={handleOpenAdd}
            className="flex items-center justify-center gap-2 bg-primary hover:bg-amber-600 text-zinc-950 font-semibold px-4 py-2 rounded-xl transition-colors text-sm shadow-lg shadow-amber-900/20"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Tambah Menu</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-3 bg-zinc-900 p-3 rounded-2xl border border-zinc-800">
        <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-xs">
          <span className="px-3 py-1.5 text-zinc-400 font-medium">Kategori:</span>
          <button onClick={() => setCategoryFilter('all')} className={`px-3 py-1.5 rounded-lg transition-colors ${categoryFilter === 'all' ? 'bg-primary text-zinc-950 font-semibold' : 'text-zinc-400 hover:text-zinc-200'}`}>Semua</button>
          <button onClick={() => setCategoryFilter('restoran')} className={`px-3 py-1.5 rounded-lg transition-colors ${categoryFilter === 'restoran' ? 'bg-primary text-zinc-950 font-semibold' : 'text-zinc-400 hover:text-zinc-200'}`}>Restoran</button>
          <button onClick={() => setCategoryFilter('penginapan')} className={`px-3 py-1.5 rounded-lg transition-colors ${categoryFilter === 'penginapan' ? 'bg-primary text-zinc-950 font-semibold' : 'text-zinc-400 hover:text-zinc-200'}`}>Penginapan</button>
        </div>

        <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-xs">
          <span className="px-3 py-1.5 text-zinc-400 font-medium">Tipe:</span>
          <button onClick={() => setTypeFilter('all')} className={`px-3 py-1.5 rounded-lg transition-colors ${typeFilter === 'all' ? 'bg-zinc-800 text-zinc-100 font-semibold' : 'text-zinc-400 hover:text-zinc-200'}`}>Semua</button>
          <button onClick={() => setTypeFilter('makanan')} className={`px-3 py-1.5 rounded-lg transition-colors ${typeFilter === 'makanan' ? 'bg-zinc-800 text-zinc-100 font-semibold' : 'text-zinc-400 hover:text-zinc-200'}`}>Makanan</button>
          <button onClick={() => setTypeFilter('minuman')} className={`px-3 py-1.5 rounded-lg transition-colors ${typeFilter === 'minuman' ? 'bg-zinc-800 text-zinc-100 font-semibold' : 'text-zinc-400 hover:text-zinc-200'}`}>Minuman</button>
        </div>
      </div>

      {/* Konten Menu List */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
            <Loader2 className="animate-spin h-8 w-8 mb-4 text-primary" />
            <p>Memuat daftar menu...</p>
          </div>
        ) : filteredMenus.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500 text-center px-4">
            <div className="w-16 h-16 bg-zinc-950 rounded-full flex items-center justify-center mb-4">
              <UtensilsCrossed className="h-8 w-8 text-zinc-600" />
            </div>
            <p className="font-medium text-zinc-300">Belum ada data menu</p>
            <p className="text-sm mt-1">Silakan tambahkan menu baru melalui tombol di atas.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {filteredMenus.map((menu) => (
              <div key={menu.id} className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between space-y-4 hover:border-zinc-700 transition-colors">
                <div className="space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-bold text-zinc-100 text-base">{menu.name}</h3>
                    <button 
                      onClick={() => handleToggleReady(menu)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase transition-colors ${
                        menu.is_ready 
                          ? 'bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20' 
                          : 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20'
                      }`}
                    >
                      {menu.is_ready ? <CheckCircle2 className="h-3 w-3"/> : <XCircle className="h-3 w-3"/>}
                      {menu.is_ready ? 'Ready' : 'Habis'}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800 capitalize">
                      {menu.category}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800 capitalize">
                      {menu.type}
                    </span>
                    {menu.is_meat ? (
                      <span className="px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-medium flex items-center gap-1">
                        <Scale className="h-3 w-3" />
                        🥩 {menu.inventory?.item_name || 'Daging'} ({menu.name.toLowerCase().includes('nasi goreng') ? 'Fiks 30g' : 'Custom'})
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-500 border border-zinc-800">
                        Non-Daging
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-zinc-900">
                  <div className="text-lg font-bold text-primary">
                    {formatRupiah(menu.price)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={() => handleOpenEdit(menu)}
                      className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg border border-zinc-800 transition-colors"
                      title="Edit"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(menu.id)}
                      className="p-2 bg-zinc-900 hover:bg-red-950/50 text-zinc-400 hover:text-red-400 rounded-lg border border-zinc-800 hover:border-red-900/50 transition-colors"
                      title="Hapus"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL FORM TAMBAH / EDIT MENU */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-3 backdrop-blur-sm sm:p-4">
          <div className="flex min-h-full items-center justify-center">
            <div className="flex w-full max-w-2xl max-h-[calc(100vh-1.5rem)] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#151311] shadow-[0_25px_80px_rgba(0,0,0,0.6)] sm:max-h-[calc(100vh-2rem)]">

              {/* Header */}
              <div className="relative shrink-0 overflow-hidden border-b border-white/10 bg-gradient-to-br from-orange-500/[0.08] via-transparent to-transparent px-5 py-4 sm:px-6 sm:py-5">
                <div className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full bg-orange-500/[0.08] blur-3xl" />

                <div className="relative flex items-start justify-between gap-4">
                  <div className="min-w-0 pr-2">
                    <div className="mb-2 inline-flex items-center rounded-full border border-orange-400/15 bg-orange-400/[0.06] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-orange-300">
                      {editingId ? 'Konfigurasi Menu' : 'Menu Baru'}
                    </div>

                    <h3 className="text-lg font-bold tracking-tight text-white sm:text-xl">
                      {editingId ? 'Edit Menu' : 'Tambah Menu Baru'}
                    </h3>

                    <p className="mt-1 max-w-xl text-xs leading-5 text-zinc-400 sm:text-sm">
                      Atur informasi menu, kategori, harga, serta konfigurasi daging asap.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    aria-label="Tutup modal"
                    className="shrink-0 rounded-xl border border-white/10 bg-white/[0.03] p-2 text-zinc-400 transition-colors hover:border-white/15 hover:bg-white/[0.06] hover:text-white"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
                  <div className="space-y-5">

                    {/* Informasi Dasar */}
                    <section className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 sm:p-5">
                      <div className="mb-4 flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-300">
                          <UtensilsCrossed className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-zinc-100">Informasi Menu</h4>
                          <p className="text-[11px] text-zinc-500">Informasi utama yang akan tampil pada daftar menu.</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-zinc-300">Nama Menu</label>
                          <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                            className="w-full rounded-xl border border-white/10 bg-black/20 px-3.5 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-orange-400/50 focus:outline-none focus:ring-2 focus:ring-orange-500/10"
                            placeholder="Misal: Brisket Sapi Asap Plate"
                          />
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-zinc-300">Kategori Bisnis</label>
                            <select
                              value={formData.category}
                              onChange={(e) => setFormData({...formData, category: e.target.value})}
                              className="w-full rounded-xl border border-white/10 bg-black/20 px-3.5 py-3 text-sm text-zinc-100 focus:border-orange-400/50 focus:outline-none focus:ring-2 focus:ring-orange-500/10"
                            >
                              <option value="restoran">Restoran</option>
                              <option value="penginapan">Penginapan</option>
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-zinc-300">Tipe Menu</label>
                            <select
                              value={formData.type}
                              onChange={(e) => setFormData({...formData, type: e.target.value})}
                              className="w-full rounded-xl border border-white/10 bg-black/20 px-3.5 py-3 text-sm text-zinc-100 focus:border-orange-400/50 focus:outline-none focus:ring-2 focus:ring-orange-500/10"
                            >
                              <option value="makanan">Makanan</option>
                              <option value="minuman">Minuman</option>
                            </select>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-zinc-300">Harga (Rp)</label>
                          <div className="relative">
                            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-500">Rp</span>
                            <input
                              type="number"
                              required
                              value={formData.price}
                              onChange={(e) => setFormData({...formData, price: e.target.value})}
                              className="w-full rounded-xl border border-white/10 bg-black/20 py-3 pl-10 pr-3.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-orange-400/50 focus:outline-none focus:ring-2 focus:ring-orange-500/10"
                              placeholder="75000"
                            />
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* Konfigurasi Daging */}
                    {formData.type === 'makanan' && (
                      <section className="rounded-2xl border border-orange-500/10 bg-orange-500/[0.025] p-4 sm:p-5">
                        <div className="mb-4 flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-300">
                            <Scale className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-sm font-semibold text-zinc-100">Konfigurasi Daging Asap</h4>
                            <p className="text-[11px] text-zinc-500">Tentukan apakah menu menggunakan bahan daging dari inventory.</p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/8 bg-black/20 p-3.5 transition-colors hover:border-orange-500/20 hover:bg-white/[0.025]">
                            <input
                              type="checkbox"
                              checked={formData.is_meat}
                              onChange={(e) => setFormData({...formData, is_meat: e.target.checked})}
                              className="mt-0.5 h-4 w-4 shrink-0 accent-orange-500"
                            />
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-zinc-200">Menggunakan Daging Asap</span>
                              <span className="mt-1 block text-xs leading-5 text-zinc-500">Stok daging terkait akan menjadi bagian dari konfigurasi menu.</span>
                            </span>
                          </label>

                          {formData.is_meat && (
                            <div className="space-y-4 rounded-2xl border border-white/8 bg-black/20 p-4">
                              <div className="space-y-1.5">
                                <label className="flex items-center gap-2 text-xs font-semibold text-orange-300">
                                  <Package className="h-3.5 w-3.5 shrink-0" />
                                  <span>Pilih Jenis Daging</span>
                                </label>

                                <select
                                  required={formData.is_meat}
                                  value={formData.inventory_id}
                                  onChange={(e) => setFormData({...formData, inventory_id: e.target.value})}
                                  className="w-full rounded-xl border border-white/10 bg-[#171513] px-3.5 py-3 text-xs font-medium text-zinc-100 focus:border-orange-400/50 focus:outline-none focus:ring-2 focus:ring-orange-500/10"
                                >
                                  <option value="">-- Pilih Jenis Daging --</option>
                                  {inventoryList.map((inv) => (
                                    <option key={inv.id} value={inv.id}>
                                      🥩 {inv.item_name} (Sisa Stok: {inv.stock_gram || 0}g)
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {!formData.name.toLowerCase().includes('nasi goreng') && (
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                  <div className="space-y-1.5">
                                    <label className="block text-xs font-semibold text-zinc-400">Gram Daging (Standar)</label>
                                    <input
                                      type="number"
                                      value={formData.meat_gram}
                                      onChange={(e) => setFormData({...formData, meat_gram: e.target.value})}
                                      className="w-full rounded-xl border border-white/10 bg-[#171513] px-3.5 py-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-orange-400/50 focus:outline-none focus:ring-2 focus:ring-orange-500/10"
                                      placeholder="100"
                                    />
                                  </div>

                                  <div className="space-y-1.5">
                                    <label className="block text-xs font-semibold text-zinc-400">Minimum Gram</label>
                                    <input
                                      type="number"
                                      value={formData.min_meat_gram}
                                      onChange={(e) => setFormData({...formData, min_meat_gram: e.target.value})}
                                      className="w-full rounded-xl border border-white/10 bg-[#171513] px-3.5 py-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-orange-400/50 focus:outline-none focus:ring-2 focus:ring-orange-500/10"
                                      placeholder="30"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </section>
                    )}

                    {/* Ketersediaan */}
                    <section className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 sm:p-5">
                      <div className="mb-4 flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                          {formData.is_ready ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-zinc-100">Status Ketersediaan</h4>
                          <p className="text-[11px] text-zinc-500">Tentukan apakah menu dapat dipesan saat ini.</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition-colors ${formData.is_ready === true ? 'border-emerald-500/20 bg-emerald-500/[0.06]' : 'border-white/8 bg-black/20 hover:bg-white/[0.03]'}`}>
                          <input
                            type="radio"
                            name="is_ready"
                            checked={formData.is_ready === true}
                            onChange={() => setFormData({...formData, is_ready: true})}
                            className="h-4 w-4 shrink-0 accent-emerald-500"
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-zinc-200">Ready</span>
                            <span className="block text-[11px] text-zinc-500">Menu tersedia untuk dipesan.</span>
                          </span>
                        </label>

                        <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition-colors ${formData.is_ready === false ? 'border-red-500/20 bg-red-500/[0.05]' : 'border-white/8 bg-black/20 hover:bg-white/[0.03]'}`}>
                          <input
                            type="radio"
                            name="is_ready"
                            checked={formData.is_ready === false}
                            onChange={() => setFormData({...formData, is_ready: false})}
                            className="h-4 w-4 shrink-0 accent-red-500"
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-zinc-200">Habis</span>
                            <span className="block text-[11px] text-zinc-500">Menu tidak tersedia untuk dipesan.</span>
                          </span>
                        </label>
                      </div>
                    </section>

                  </div>
                </div>

                {/* Footer */}
                <div className="shrink-0 border-t border-white/10 bg-[#131210] px-5 py-4 sm:px-6">
                  <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:items-center sm:justify-end">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/[0.06] hover:text-white sm:w-auto"
                    >
                      Batal
                    </button>

                    <button
                      type="submit"
                      disabled={submitLoading}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-950/30 transition-all hover:from-orange-400 hover:to-orange-600 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                    >
                      {submitLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                      {editingId ? 'Simpan Perubahan' : 'Tambah Menu'}
                    </button>
                  </div>
                </div>
              </form>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}