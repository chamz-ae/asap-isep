import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  BarChart3, DollarSign, TrendingUp, TrendingDown, 
  ShoppingCart, Calendar, FileSpreadsheet, Loader2, Filter
} from 'lucide-react';

export default function Laporan() {
  const [orders, setOrders] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filter States
  const [filterType, setFilterType] = useState('all'); // 'all', 'month', 'date'
  const [selectedMonth, setSelectedMonth] = useState(''); // format 'YYYY-MM'
  const [selectedDate, setSelectedDate] = useState(''); // format 'YYYY-MM-DD'

  const fetchReportData = async () => {
    try {
      setLoading(true);
      // 1. Ambil orders
      const { data: orderData, error: orderErr } = await supabase
        .from('orders')
        .select('*, guests(name), tables(table_number), rooms(room_number)')
        .neq('status', 'cancelled');
      if (orderErr) throw orderErr;
      setOrders(orderData || []);

      // 2. Ambil purchases
      const { data: purchaseData, error: purchaseErr } = await supabase
        .from('purchases')
        .select('*');
      if (purchaseErr) throw purchaseErr;
      setPurchases(purchaseData || []);

      // Set default nilai filter jika belum ada
      const months = getAvailableMonths(orderData || [], purchaseData || []);
      if (months.length > 0 && !selectedMonth) {
        setSelectedMonth(months[0]); // Default ke bulan terbaru yang ada datanya
      }
      setSelectedDate(getLocalDateString(new Date()));

    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, []);

  // Helper tanggal lokal
  const getLocalDateString = (dateInput) => {
    if (!dateInput) return '';
    const d = new Date(dateInput);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getLocalMonthString = (dateInput) => {
    if (!dateInput) return '';
    const d = new Date(dateInput);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  };

  // Ekstrak daftar bulan unik dari data transaksi yang pernah ada sejak aplikasi dipakai
  const getAvailableMonths = (ordList, purList) => {
    const monthsSet = new Set();
    ordList.forEach(o => {
      if (o.created_at) monthsSet.add(getLocalMonthString(o.created_at));
    });
    purList.forEach(p => {
      const d = p.purchase_date || p.created_at;
      if (d) monthsSet.add(getLocalMonthString(d));
    });
    // Selalu masukkan bulan berjalan jika kosong
    monthsSet.add(getLocalMonthString(new Date()));
    return Array.from(monthsSet).sort().reverse();
  };

  const availableMonths = getAvailableMonths(orders, purchases);

  const formatMonthLabel = (monthStr) => {
    if (!monthStr) return '';
    const [year, month] = monthStr.split('-');
    const date = new Date(year, parseInt(month) - 1, 1);
    return date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  };

  // Logika Filter Data
  const filteredOrders = orders.filter(order => {
    if (filterType === 'month' && selectedMonth) {
      return getLocalMonthString(order.created_at) === selectedMonth;
    }
    if (filterType === 'date' && selectedDate) {
      return getLocalDateString(order.created_at) === selectedDate;
    }
    return true;
  });

  const filteredPurchases = purchases.filter(purchase => {
    const targetDate = purchase.purchase_date || purchase.created_at;
    if (filterType === 'month' && selectedMonth) {
      return getLocalMonthString(targetDate) === selectedMonth;
    }
    if (filterType === 'date' && selectedDate) {
      return getLocalDateString(targetDate) === selectedDate;
    }
    return true;
  });

  // Kalkulasi Keuangan
  const totalOmzetResto = filteredOrders
    .filter(o => o.order_type === 'restoran')
    .reduce((sum, o) => sum + (o.total_amount || 0), 0);

  const totalOmzetInap = filteredOrders
    .filter(o => o.order_type === 'penginapan')
    .reduce((sum, o) => sum + (o.total_amount || 0), 0);

  const totalOmzet = totalOmzetResto + totalOmzetInap;

  const totalBelanja = filteredPurchases
    .reduce((sum, p) => sum + (p.total_price || 0), 0);

  const netProfit = totalOmzet - totalBelanja;

  const formatRupiah = (num) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
  };

  const handleExportLaporan = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += `LAPORAN KEUANGAN ASAP ISEP (${filterType.toUpperCase()})\n\n`;
    csvContent += `Total Omzet Restoran,${totalOmzetResto}\n`;
    csvContent += `Total Omzet Penginapan,${totalOmzetInap}\n`;
    csvContent += `Total Omzet Keseluruhan,${totalOmzet}\n`;
    csvContent += `Total Belanja Operasional,${totalBelanja}\n`;
    csvContent += `Laba Bersih (Net Profit),${netProfit}\n\n`;

    csvContent += "DAFTAR TRANSAKSI PENJUALAN\n";
    csvContent += "No Transaksi,Tipe,Total,Metode Bayar,Tanggal\n";
    filteredOrders.forEach(o => {
      csvContent += `"${o.order_number}","${o.order_type}","${o.total_amount}","${o.payment_method}","${o.created_at}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Laporan_Keuangan_${filterType}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-100 tracking-tight">Laporan Keuangan & Analitik</h2>
          <p className="text-sm text-zinc-400 mt-1">Rekapitulasi omzet, pengeluaran belanja, dan laba bersih bisnis.</p>
        </div>

        {/* INTERACTIVE FILTER BAR */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800 text-xs">
            <button 
              onClick={() => setFilterType('all')} 
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${filterType === 'all' ? 'bg-primary text-zinc-950 font-semibold' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              Semua
            </button>
            <button 
              onClick={() => setFilterType('month')} 
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${filterType === 'month' ? 'bg-primary text-zinc-950 font-semibold' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              Per Bulan
            </button>
            <button 
              onClick={() => setFilterType('date')} 
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${filterType === 'date' ? 'bg-primary text-zinc-950 font-semibold' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              Per Hari
            </button>
          </div>

          {/* DROPDOWN SELECTOR KETIKA PILIH BULAN */}
          {filterType === 'month' && (
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-primary"
            >
              {availableMonths.map(m => (
                <option key={m} value={m}>{formatMonthLabel(m)}</option>
              ))}
            </select>
          )}

          {/* DATE PICKER KETIKA PILIH HARI */}
          {filterType === 'date' && (
            <input 
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-primary"
            />
          )}

          <button onClick={handleExportLaporan} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors shadow-lg">
            <FileSpreadsheet className="h-4 w-4" />
            <span>Export Laporan</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
          <Loader2 className="animate-spin h-8 w-8 mb-4 text-primary" />
          <p>Memuat rekapitulasi keuangan...</p>
        </div>
      ) : (
        <>
          {/* Card Statistik Utama */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-2">
              <div className="flex justify-between items-center text-zinc-400 text-xs font-medium">
                <span>TOTAL OMZET</span>
                <TrendingUp className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-zinc-100">{formatRupiah(totalOmzet)}</div>
              <div className="flex gap-2 text-[11px] text-zinc-500">
                <span>Resto: {formatRupiah(totalOmzetResto)}</span> • 
                <span>Inap: {formatRupiah(totalOmzetInap)}</span>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-2">
              <div className="flex justify-between items-center text-zinc-400 text-xs font-medium">
                <span>TOTAL BELANJA / PENGELUARAN</span>
                <TrendingDown className="h-4 w-4 text-red-400" />
              </div>
              <div className="text-2xl font-bold text-zinc-100">{formatRupiah(totalBelanja)}</div>
              <p className="text-[11px] text-zinc-500">{filteredPurchases.length} transaksi belanja tercatat</p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-2">
              <div className="flex justify-between items-center text-zinc-400 text-xs font-medium">
                <span>LABA BERSIH (NET PROFIT)</span>
                <DollarSign className="h-4 w-4 text-primary" />
              </div>
              <div className={`text-2xl font-bold ${netProfit >= 0 ? 'text-primary' : 'text-red-400'}`}>
                {formatRupiah(netProfit)}
              </div>
              <p className="text-[11px] text-zinc-500">Omzet dikurangi pengeluaran belanja</p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-2">
              <div className="flex justify-between items-center text-zinc-400 text-xs font-medium">
                <span>TOTAL TRANSAKSI</span>
                <BarChart3 className="h-4 w-4 text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-zinc-100">{filteredOrders.length} Order</div>
              <p className="text-[11px] text-zinc-500">Restoran & Penginapan aktif</p>
            </div>

          </div>

          {/* Rincian Tabel Transaksi & Pengeluaran */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Tabel Penjualan */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="p-5 border-b border-zinc-800">
                <h3 className="font-bold text-zinc-100 text-sm">Rincian Penjualan ({filteredOrders.length})</h3>
              </div>
              <div className="divide-y divide-zinc-800 max-h-96 overflow-y-auto">
                {filteredOrders.length === 0 ? (
                  <div className="p-10 text-center text-zinc-500 text-xs">Tidak ada data penjualan pada periode ini.</div>
                ) : (
                  filteredOrders.map(o => (
                    <div key={o.id} className="p-4 flex justify-between items-center hover:bg-zinc-800/30">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-zinc-100 text-xs">{o.order_number}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] uppercase font-semibold bg-zinc-950 text-zinc-400 border border-zinc-800">{o.order_type}</span>
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-0.5">Tamu: {o.guests?.name || 'Umum'} • {new Date(o.created_at).toLocaleDateString('id-ID')}</p>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-primary text-xs">{formatRupiah(o.total_amount)}</div>
                        <span className="text-[10px] uppercase text-zinc-500">{o.payment_method}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Tabel Pengeluaran Belanja */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="p-5 border-b border-zinc-800">
                <h3 className="font-bold text-zinc-100 text-sm">Rincian Pengeluaran Belanja ({filteredPurchases.length})</h3>
              </div>
              <div className="divide-y divide-zinc-800 max-h-96 overflow-y-auto">
                {filteredPurchases.length === 0 ? (
                  <div className="p-10 text-center text-zinc-500 text-xs">Tidak ada data belanja pada periode ini.</div>
                ) : (
                  filteredPurchases.map(p => (
                    <div key={p.id} className="p-4 flex justify-between items-center hover:bg-zinc-800/30">
                      <div>
                        <span className="font-bold text-zinc-100 text-xs">{p.item_name} ({p.qty} {p.unit})</span>
                        <p className="text-[11px] text-zinc-400 mt-0.5">Supplier: {p.supplier || '-'} • {new Date(p.purchase_date).toLocaleDateString('id-ID')}</p>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-red-400 text-xs">{formatRupiah(p.total_price)}</div>
                        <span className="text-[10px] uppercase text-zinc-500">{p.payment_method}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </>
      )}

    </div>
  );
}