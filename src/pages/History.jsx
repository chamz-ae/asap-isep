import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { 
  History as HistoryIcon, Search, ShieldAlert, X, 
  Loader2, CheckCircle2, XCircle, AlertTriangle, User, FileText
} from 'lucide-react';

export default function History() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all', 'restoran', 'penginapan'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'lunas', 'cancelled'

  // State Modal Void
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidLoading, setVoidLoading] = useState(false);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          guests(name, phone),
          tables(table_number),
          rooms(room_number),
          order_items(*, menus(name))
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // Filter Orders
  const filteredOrders = orders.filter(order => {
    const normalizedSearch = searchQuery.toLowerCase();
    const matchSearch = 
      (order.order_number || '').toLowerCase().includes(normalizedSearch) ||
      order.guests?.name?.toLowerCase().includes(normalizedSearch) ||
      order.guests?.phone?.includes(searchQuery);

    const matchType = typeFilter === 'all' || order.order_type === typeFilter;
    const matchStatus = statusFilter === 'all' || 
      (statusFilter === 'cancelled' ? order.status === 'cancelled' : order.payment_status === statusFilter);

    return matchSearch && matchType && matchStatus;
  });

  // Handle Detail Riwayat
  const handleOpenDetailModal = (order) => {
    setSelectedOrder(order);
    setIsDetailModalOpen(true);
  };

  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedOrder(null);
  };

  // Handle Void Order (Pembatalan Transaksi)
  const handleOpenVoidModal = (order) => {
    // Cek apakah user adalah owner / admin
    const isAdminOrOwner = ['owner', 'admin'].includes(profile?.role);
    if (!isAdminOrOwner) {
      alert('⚠️ AKSES DITOLAK: Tindakan Void / Pembatalan pesanan hanya dapat dilakukan oleh Admin atau Owner!');
      return;
    }

    setSelectedOrder(order);
    setVoidReason('');
    setIsVoidModalOpen(true);
  };

  const confirmVoidOrder = async (e) => {
    e.preventDefault();
    if (!voidReason.trim()) {
      alert('Harap masukkan alasan pembatalan (Void Reason).');
      return;
    }

    setVoidLoading(true);
    try {
      // 1. Update status order menjadi 'cancelled'
      const { error: updateError } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', selectedOrder.id);

      if (updateError) throw updateError;

      // 2. Jika transaksi penginapan, kembalikan status kamar menjadi 'available'
      if (selectedOrder.room_id) {
        await supabase
          .from('rooms')
          .update({ status: 'available' })
          .eq('id', selectedOrder.room_id);
      }

      // 3. Jika transaksi restoran, kembalikan status meja menjadi 'available'
      if (selectedOrder.table_id) {
        await supabase
          .from('tables')
          .update({ status: 'available' })
          .eq('id', selectedOrder.table_id);
      }

      // 4. Catat ke Audit Log
      await supabase
        .from('audit_logs')
        .insert([{
          user_id: profile?.id,
          action: 'VOID_ORDER',
          details: `Melakukan Void pada transaksi ${selectedOrder.order_number}. Alasan: ${voidReason}`
        }]);

      setIsVoidModalOpen(false);
      setSelectedOrder(null);
      setVoidReason('');
      await fetchHistory();
      alert('Transaksi berhasil di-void (dibatalkan) dan tercatat dalam audit log.');

    } catch (error) {
      alert('Gagal melakukan void pesanan: ' + error.message);
    } finally {
      setVoidLoading(false);
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
          <h2 className="text-2xl font-bold text-zinc-100 tracking-tight">Riwayat & Void Transaksi</h2>
          <p className="text-sm text-zinc-400 mt-1">Audit log seluruh transaksi restoran dan penginapan.</p>
        </div>

        {/* Pencarian */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Cari no. transaksi / nama tamu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-72 bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-primary transition-colors"
          />
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-3 bg-zinc-900 p-3 rounded-2xl border border-zinc-800">
        <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-xs">
          <span className="px-3 py-1.5 text-zinc-400 font-medium">Tipe:</span>
          <button onClick={() => setTypeFilter('all')} className={`px-3 py-1.5 rounded-lg transition-colors ${typeFilter === 'all' ? 'bg-primary text-zinc-950 font-semibold' : 'text-zinc-400 hover:text-zinc-200'}`}>Semua</button>
          <button onClick={() => setTypeFilter('restoran')} className={`px-3 py-1.5 rounded-lg transition-colors ${typeFilter === 'restoran' ? 'bg-primary text-zinc-950 font-semibold' : 'text-zinc-400 hover:text-zinc-200'}`}>Restoran</button>
          <button onClick={() => setTypeFilter('penginapan')} className={`px-3 py-1.5 rounded-lg transition-colors ${typeFilter === 'penginapan' ? 'bg-primary text-zinc-950 font-semibold' : 'text-zinc-400 hover:text-zinc-200'}`}>Penginapan</button>
        </div>

        <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-xs">
          <span className="px-3 py-1.5 text-zinc-400 font-medium">Status:</span>
          <button onClick={() => setStatusFilter('all')} className={`px-3 py-1.5 rounded-lg transition-colors ${statusFilter === 'all' ? 'bg-zinc-800 text-zinc-100 font-semibold' : 'text-zinc-400 hover:text-zinc-200'}`}>Semua</button>
          <button onClick={() => setStatusFilter('lunas')} className={`px-3 py-1.5 rounded-lg transition-colors ${statusFilter === 'lunas' ? 'bg-zinc-800 text-zinc-100 font-semibold' : 'text-zinc-400 hover:text-zinc-200'}`}>Lunas</button>
          <button onClick={() => setStatusFilter('cancelled')} className={`px-3 py-1.5 rounded-lg transition-colors ${statusFilter === 'cancelled' ? 'bg-zinc-800 text-zinc-100 font-semibold' : 'text-zinc-400 hover:text-zinc-200'}`}>Void / Batal</button>
        </div>
      </div>

      {/* Tabel Riwayat */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
            <Loader2 className="animate-spin h-8 w-8 mb-4 text-primary" />
            <p>Memuat riwayat transaksi...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500 text-center px-4">
            <div className="w-16 h-16 bg-zinc-950 rounded-full flex items-center justify-center mb-4">
              <HistoryIcon className="h-8 w-8 text-zinc-600" />
            </div>
            <p className="font-medium text-zinc-300">Tidak ada riwayat transaksi</p>
            <p className="text-sm mt-1">Transaksi yang dilakukan akan muncul di sini.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {filteredOrders.map((order) => (
              <div key={order.id} className="p-5 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 hover:bg-zinc-800/30 transition-colors">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-zinc-100 text-base">{order.order_number}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${order.order_type === 'restoran' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
                      {order.order_type}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-300">
                      {order.tables?.table_number || order.rooms?.room_number || 'Umum'}
                    </span>
                    
                    {order.status === 'cancelled' ? (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase bg-red-500/10 text-red-400 border border-red-500/20">
                        Void / Dibatalkan
                      </span>
                    ) : (
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${order.payment_status === 'lunas' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                        {order.payment_status} ({order.payment_method})
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-zinc-300 flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-zinc-500" /> Tamu: <strong className="text-zinc-100">{order.guests?.name || 'Tamu Umum'}</strong> ({order.guests?.phone || '-'})
                  </p>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {order.order_items?.map((item, idx) => (
                      <span key={idx} className="text-xs bg-zinc-950 px-2.5 py-1 rounded-lg border border-zinc-800 text-zinc-300">
                        {item.menus?.name || 'Menu'} x{item.qty}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col items-end justify-between self-stretch lg:self-auto gap-3">
                  <div className={`text-lg font-bold ${order.status === 'cancelled' ? 'line-through text-zinc-500' : 'text-primary'}`}>
                    {formatRupiah(order.total_amount)}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-zinc-500">
                      {new Date(order.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>

                    <button


                      onClick={() => handleOpenDetailModal(order)}


                      className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-medium border border-zinc-700 transition-colors"


                      title="Lihat Detail Transaksi"


                    >


                      <FileText className="h-3.5 w-3.5" /> Detail


                    </button>



                    {order.status !== 'cancelled' && (


                      <button


                        onClick={() => handleOpenVoidModal(order)}


                        className="flex items-center gap-1 px-3 py-1.5 bg-red-950/40 hover:bg-red-900/50 text-red-400 rounded-xl text-xs font-medium border border-red-900/50 transition-colors"


                        title="Void Transaksi (Admin/Owner Only)"


                      >


                        <ShieldAlert className="h-3.5 w-3.5" /> Void


                      </button>


                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL DETAIL RIWAYAT TRANSAKSI */}
      {isDetailModalOpen && selectedOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) handleCloseDetailModal();
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="detail-riwayat-title"
        >
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl shadow-2xl relative my-8 overflow-hidden">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 p-6 border-b border-zinc-800">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-3 bg-primary/10 rounded-xl border border-primary/20 text-primary shrink-0">
                  <FileText className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <h3 id="detail-riwayat-title" className="text-lg font-bold text-zinc-100 truncate">
                    Detail Riwayat Transaksi
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5 truncate">
                    {selectedOrder.order_number || 'Nomor transaksi tidak tersedia'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseDetailModal}
                className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-xl transition-colors shrink-0"
                aria-label="Tutup detail"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Status */}
              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-3 py-1.5 rounded-full text-xs font-semibold uppercase ${
                  selectedOrder.order_type === 'restoran'
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                }`}>
                  {selectedOrder.order_type || 'transaksi'}
                </span>

                {selectedOrder.status === 'cancelled' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold uppercase bg-red-500/10 text-red-400 border border-red-500/20">
                    <XCircle className="h-3.5 w-3.5" />
                    Void / Dibatalkan
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold uppercase bg-green-500/10 text-green-400 border border-green-500/20">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Transaksi Aktif
                  </span>
                )}
              </div>

              {/* Informasi utama */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-4">
                  <p className="text-xs text-zinc-500 mb-1">Nama Tamu</p>
                  <p className="font-semibold text-zinc-100">
                    {selectedOrder.guests?.name || 'Tamu Umum'}
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">
                    {selectedOrder.guests?.phone || 'Nomor telepon -'}
                  </p>
                </div>

                <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-4">
                  <p className="text-xs text-zinc-500 mb-1">
                    {selectedOrder.order_type === 'penginapan' ? 'Nomor Kamar' : 'Nomor Meja'}
                  </p>
                  <p className="font-semibold text-zinc-100">
                    {selectedOrder.tables?.table_number ||
                     selectedOrder.rooms?.room_number ||
                     'Umum'}
                  </p>
                </div>

                <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-4">
                  <p className="text-xs text-zinc-500 mb-1">Pembayaran</p>
                  <p className="font-semibold text-zinc-100 capitalize">
                    {selectedOrder.payment_status || '-'}
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">
                    Metode: {selectedOrder.payment_method || '-'}
                  </p>
                </div>

                <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-4">
                  <p className="text-xs text-zinc-500 mb-1">Waktu Transaksi</p>
                  <p className="font-semibold text-zinc-100">
                    {selectedOrder.created_at
                      ? new Date(selectedOrder.created_at).toLocaleDateString('id-ID', {
                          dateStyle: 'medium'
                        })
                      : '-'}
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">
                    {selectedOrder.created_at
                      ? new Date(selectedOrder.created_at).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : '-'}
                  </p>
                </div>
              </div>

              {/* Detail item */}
              <div className="bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800">
                  <h4 className="text-sm font-semibold text-zinc-100">Daftar Pesanan</h4>
                </div>

                {selectedOrder.order_items?.length ? (
                  <div className="divide-y divide-zinc-800">
                    {selectedOrder.order_items.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className="flex items-center justify-between gap-4 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-zinc-100 truncate">
                            {item.menus?.name || 'Menu tidak tersedia'}
                          </p>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            Item #{idx + 1}
                          </p>
                        </div>

                        <span className="shrink-0 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-300">
                          x{item.qty ?? 0}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-6 text-sm text-zinc-500 text-center">
                    Tidak ada item pesanan yang tercatat.
                  </div>
                )}
              </div>

              {/* Total */}
              <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-medium text-zinc-400">Total Transaksi</span>
                  <span className={`text-xl font-bold ${
                    selectedOrder.status === 'cancelled' ? 'text-zinc-500 line-through' : 'text-primary'
                  }`}>
                    {formatRupiah(selectedOrder.total_amount || 0)}
                  </span>
                </div>
              </div>

              {selectedOrder.status === 'cancelled' && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/5 border border-red-500/10">
                  <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-300">Transaksi telah di-void</p>
                    <p className="text-xs text-zinc-400 mt-1">
                      Alasan pembatalan dicatat pada audit log saat proses void dilakukan.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 p-6 border-t border-zinc-800 bg-zinc-900/80">
              {selectedOrder.status !== 'cancelled' && (
                <button
                  type="button"
                  onClick={() => {
                    const orderForVoid = selectedOrder;
                    handleCloseDetailModal();
                    handleOpenVoidModal(orderForVoid);
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-950/40 hover:bg-red-900/50 text-red-400 rounded-xl text-sm font-medium border border-red-900/50 transition-colors"
                >
                  <ShieldAlert className="h-4 w-4" />
                  Void Transaksi
                </button>
              )}

              <button
                type="button"
                onClick={handleCloseDetailModal}
                className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-xl text-sm font-semibold transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL VOID VERIFIKASI ADMIN/OWNER */}
      {isVoidModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl relative my-8 p-6 space-y-6">
            
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20 text-red-500">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-100">Verifikasi Void Transaksi</h3>
                  <p className="text-xs text-zinc-400">Pembatalan pesanan {selectedOrder.order_number}</p>
                </div>
              </div>
              <button onClick={() => setIsVoidModalOpen(false)} className="p-1 text-zinc-400 hover:text-zinc-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-2 text-xs text-zinc-300">
              <div className="flex justify-between">
                <span className="text-zinc-500">Total Transaksi:</span>
                <span className="font-bold text-zinc-100">{formatRupiah(selectedOrder.total_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Nama Tamu:</span>
                <span className="font-semibold text-zinc-100">{selectedOrder.guests?.name}</span>
              </div>
            </div>

            <form onSubmit={confirmVoidOrder} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400 font-medium">Alasan Pembatalan (Wajib Diisi)</label>
                <textarea 
                  required
                  rows="3"
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="Contoh: Salah input pesanan / Tamu membatalkan pesanan..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-100 focus:border-red-500 focus:outline-none resize-none"
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsVoidModalOpen(false)}
                  className="px-4 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  disabled={voidLoading}
                  className="px-4 py-2.5 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors flex items-center gap-2 shadow-lg shadow-red-900/20 disabled:opacity-50"
                >
                  {voidLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>Konfirmasi Void</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}