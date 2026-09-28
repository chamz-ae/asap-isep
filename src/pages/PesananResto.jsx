import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  BedDouble,
  Utensils,
  Users,
  DollarSign,
  TrendingUp,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  Package,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalOmzet: 0,
    totalCash: 0,
    totalQris: 0,
    totalTransfer: 0,
    totalVisitors: 0,
    activeOrdersResto: 0,
    activeOrdersInap: 0,
    meatStockGram: 0,
  });

  const [rooms, setRooms] = useState([]);
  const [tables, setTables] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [activeRestoOrders, setActiveRestoOrders] = useState([]);
  const [activeInapOrders, setActiveInapOrders] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [bookingSourceTable, setBookingSourceTable] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const formatRupiah = (num) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(Number(num) || 0);
  };

  const getDateKey = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const startOfDay = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const endOfDay = (date) => {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  };

  const normalizeBooking = (booking) => ({
    id: booking?.id,
    roomId:
      booking?.room_id ??
      booking?.roomId ??
      booking?.room?.id ??
      null,
    roomNumber:
      booking?.room_number ??
      booking?.roomNumber ??
      booking?.room?.room_number ??
      null,
    checkIn:
      booking?.check_in ??
      booking?.checkin ??
      booking?.start_date ??
      booking?.created_at ??
      null,
    checkOut:
      booking?.check_out ??
      booking?.checkout ??
      booking?.end_date ??
      null,
    guestName:
      booking?.guests?.name ??
      booking?.guest_name ??
      booking?.name ??
      'Tamu Inap',
    status: String(booking?.status ?? 'confirmed').toLowerCase(),
  });

  const isBookingActive = (booking) => {
    const inactiveStatuses = [
      'cancelled',
      'canceled',
      'void',
      'rejected',
      'expired',
      'completed',
      'checkout'
    ];

    return !inactiveStatuses.includes(booking.status);
  };

  const bookingOverlapsDate = (booking, date) => {
    if (!isBookingActive(booking) || !booking.checkIn) return false;

    const target = getDateKey(date);
    const checkIn = getDateKey(booking.checkIn);

    if (!booking.checkOut) {
      return target === checkIn;
    }

    const checkOut = getDateKey(booking.checkOut);

    return target >= checkIn && target < checkOut;
  };

  const getBookingsForDate = (date) => {
    return bookings.filter((booking) => bookingOverlapsDate(booking, date));
  };

  const getRoomBooking = (room, date) => {
    return bookings.find((booking) => {
      if (!bookingOverlapsDate(booking, date)) return false;

      if (booking.roomId && String(booking.roomId) === String(room.id)) {
        return true;
      }

      if (
        booking.roomNumber &&
        String(booking.roomNumber) === String(room.room_number)
      ) {
        return true;
      }

      return false;
    });
  };

  const fetchBookings = async () => {
    let combinedBookings = [];
    let source = null;

    const candidates = ['reservations', 'stays'];
    for (const tableName of candidates) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        source = tableName;
        combinedBookings = data.map(normalizeBooking);
        break;
      }
    }

    const { data: inapOrders } = await supabase
      .from('orders')
      .select('*, guests(name), rooms(room_number)')
      .eq('order_type', 'penginapan')
      .not('status', 'in', '("cancelled","completed","void")');

    if (inapOrders && inapOrders.length > 0) {
      const orderBookings = inapOrders.map(order => ({
        id: order.id,
        roomId: order.room_id,
        roomNumber: order.rooms?.room_number,
        checkIn: order.created_at,
        checkOut: null,
        guestName: order.guests?.name || 'Tamu Inap',
        status: order.status || 'processing'
      }));

      const existingIds = new Set(combinedBookings.map(b => String(b.id)));
      orderBookings.forEach(ob => {
        if (!existingIds.has(String(ob.id))) {
          combinedBookings.push(ob);
        }
      });

      if (!source) source = 'orders (penginapan)';
    }

    setBookingSourceTable(source);
    setBookings(combinedBookings);
    return source;
  };

  const fetchDashboardData = async (silent = false) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const todayStart = startOfDay(new Date());
      const todayEnd = endOfDay(new Date());

      // 1. Fetch Transaksi Hari Ini
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*, guests(name, phone), rooms(room_number), tables(table_number)')
        .neq('status', 'cancelled')
        .gte('created_at', todayStart.toISOString())
        .lte('created_at', todayEnd.toISOString())
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      const todayOrders = ordersData || [];

      // Hitung Omzet
      const omzet = todayOrders.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0);
      const cash = todayOrders
        .filter((order) => String(order.payment_method || '').toLowerCase() === 'cash')
        .reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0);
      const qris = todayOrders
        .filter((order) => String(order.payment_method || '').toLowerCase() === 'qris')
        .reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0);
      const transfer = todayOrders
        .filter((order) => ['transfer', 'transfer bank', 'bank transfer'].includes(String(order.payment_method || '').toLowerCase()))
        .reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0);

      // 2. Fetch Pesanan Resto & Inap Aktif (Resto yang BELUM 'completed' atau 'cancelled')
      const { data: allActiveOrders } = await supabase
        .from('orders')
        .select('*, guests(name), tables(table_number), rooms(room_number)')
        .not('status', 'in', '("completed","paid","cancelled","void","checkout")');

      const activeRestoList = (allActiveOrders || []).filter(o => o.order_type === 'restoran');
      const activeInapList = (allActiveOrders || []).filter(o => o.order_type === 'penginapan');

      setActiveRestoOrders(activeRestoList);
      setActiveInapOrders(activeInapList);

      // Hitung Tamu Unik Hari Ini
      const uniqueVisitors = new Set();
      todayOrders.forEach((order) => {
        if (order.guest_id) {
          uniqueVisitors.add(String(order.guest_id));
        } else if (order.guests?.name) {
          uniqueVisitors.add(order.guests.name.trim().toLowerCase());
        }
      });

      // 3. Fetch Master Rooms, Tables, Inventory
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .order('room_number');

      if (roomError) throw roomError;

      const { data: tableData, error: tableError } = await supabase
        .from('tables')
        .select('*')
        .order('table_number');

      if (tableError) throw tableError;

      const { data: invData, error: inventoryError } = await supabase
        .from('inventory')
        .select('*');

      if (inventoryError) throw inventoryError;

      const totalMeat = (invData || []).reduce((sum, item) => sum + (Number(item.stock_gram) || 0), 0);

      // 4. Fetch Bookings Kalender
      await fetchBookings();

      setRooms(roomData || []);
      setTables(tableData || []);

      setStats({
        totalOmzet: omzet,
        totalCash: cash,
        totalQris: qris,
        totalTransfer: transfer,
        totalVisitors: uniqueVisitors.size || todayOrders.length,
        activeOrdersResto: activeRestoList.length,
        activeOrdersInap: activeInapList.length,
        meatStockGram: totalMeat,
      });

      setRecentOrders(todayOrders.slice(0, 8));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let active = true;
    let channel = null;

    const setup = async () => {
      await fetchDashboardData(false);

      if (!active) return;

      channel = supabase.channel(`dashboard-realtime-${Date.now()}`);

      const refresh = () => {
        fetchDashboardData(true);
      };

      // Subscribe ke seluruh tabel utama agar dashboard update live
      channel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, refresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, refresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, refresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, refresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_movements' }, refresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'guests' }, refresh);

      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeConnected(true);
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setRealtimeConnected(false);
        }
      });
    };

    setup();

    return () => {
      active = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  const goToPreviousMonth = () => {
    setCurrentDate((previous) => new Date(previous.getFullYear(), previous.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate((previous) => new Date(previous.getFullYear(), previous.getMonth() + 1, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDayIndex = new Date(year, month, 1).getDay();

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const selectedBookings = getBookingsForDate(selectedDate);
  const bookedRoomIds = new Set();

  selectedBookings.forEach((booking) => {
    if (booking.roomId) {
      bookedRoomIds.add(String(booking.roomId));
    }
    if (booking.roomNumber) {
      bookedRoomIds.add(`number:${String(booking.roomNumber)}`);
    }
  });

  const availableRooms = rooms.filter((room) => {
    const hasBookingById = bookedRoomIds.has(String(room.id));
    const hasBookingByNumber = bookedRoomIds.has(`number:${String(room.room_number)}`);
    const staticOccupied = ['booked', 'occupied', 'terisi'].includes(String(room.status || '').toLowerCase());

    return !hasBookingById && !hasBookingByNumber && !staticOccupied;
  }).length;

  const occupiedRooms = Math.max(rooms.length - availableRooms, 0);

  // Perhitungan Meja Terisi vs Kosong secara Realtime
  const occupiedTablesCount = tables.filter((table) => {
    const activeRestoOrder = activeRestoOrders.find(o => String(o.table_id) === String(table.id));
    const dbStatus = String(table.status || '').toLowerCase();
    return Boolean(activeRestoOrder) || ['occupied', 'terisi', 'booked'].includes(dbStatus);
  }).length;

  const availableTablesCount = Math.max(tables.length - occupiedTablesCount, 0);

  return (
    <div className="min-h-full bg-[#0c0b0a] text-[#f5f1ea]">
      <div className="mx-auto w-full max-w-[1600px] space-y-5">

        {/* HEADER */}
        <section className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-[#181614] via-[#141210] to-[#0f0e0d] p-5 shadow-[0_15px_45px_rgba(0,0,0,0.28)] sm:p-6">
          <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-orange-500/[0.08] blur-3xl" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#f08a3c] shadow-[0_0_10px_rgba(240,138,60,0.5)]" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8f877e]">
                  ASAP ISEP • Daging Asap
                </span>
              </div>

              <h2 className="text-2xl font-bold tracking-tight text-[#f5f1ea] sm:text-[28px]">
                Dashboard & Monitoring
              </h2>

              <p className="mt-1.5 max-w-2xl text-xs leading-5 text-[#8f877e] sm:text-sm">
                Pantau omzet, tamu, pesanan, ketersediaan kamar, meja, dan stok daging secara realtime.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start rounded-xl border border-white/[0.08] bg-black/20 px-3.5 py-2.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  realtimeConnected
                    ? 'animate-pulse bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                    : 'bg-amber-500'
                }`}
              />

              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#6f675f]">
                  Status Sistem
                </p>
                <p className="text-xs font-semibold text-[#d8d0c7]">
                  {realtimeConnected ? 'Realtime Aktif' : 'Memeriksa koneksi...'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => fetchDashboardData(true)}
                title="Muat ulang data"
                className="ml-1 rounded-lg p-1.5 text-[#8f877e] transition hover:bg-white/5 hover:text-[#f5f1ea]"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="rounded-2xl border border-white/[0.07] bg-[#141210] py-24 text-center shadow-[0_10px_30px_rgba(0,0,0,0.2)]">
            <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-[#f08a3c]" />
            <p className="text-sm text-[#8f877e]">Memuat data dashboard...</p>
          </div>
        ) : (
          <>
            {/* SUMMARY CARDS */}
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-2xl border border-white/[0.07] bg-[#181614] p-4 shadow-[0_10px_25px_rgba(0,0,0,0.18)] sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#6f675f]">
                      Omzet Hari Ini
                    </p>
                    <p className="mt-2 text-lg font-bold tracking-tight text-[#f5f1ea] sm:text-2xl">
                      {formatRupiah(stats.totalOmzet)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/[0.06] p-2.5 text-emerald-400">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-2 text-[10px] text-[#6f675f]">Cash + QRIS + Transfer</p>
              </div>

              <div className="rounded-2xl border border-white/[0.07] bg-[#181614] p-4 shadow-[0_10px_25px_rgba(0,0,0,0.18)] sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#6f675f]">
                      Pengunjung Hari Ini
                    </p>
                    <p className="mt-2 text-2xl font-bold tracking-tight text-[#f5f1ea]">
                      {stats.totalVisitors}
                    </p>
                  </div>
                  <div className="rounded-xl border border-sky-500/10 bg-sky-500/[0.06] p-2.5 text-sky-400">
                    <Users className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-2 text-[10px] text-[#6f675f]">Berdasarkan transaksi hari ini</p>
              </div>

              <div className="rounded-2xl border border-white/[0.07] bg-[#181614] p-4 shadow-[0_10px_25px_rgba(0,0,0,0.18)] sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#6f675f]">
                      Pesanan Aktif
                    </p>
                    <p className="mt-2 text-2xl font-bold tracking-tight text-[#f5f1ea]">
                      {stats.activeOrdersResto + stats.activeOrdersInap}
                    </p>
                  </div>
                  <div className="rounded-xl border border-orange-500/10 bg-orange-500/[0.06] p-2.5 text-[#f08a3c]">
                    <Utensils className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2 flex gap-3 text-[10px] text-[#6f675f]">
                  <span>Resto: {stats.activeOrdersResto}</span>
                  <span>Inap: {stats.activeOrdersInap}</span>
                </div>
              </div>

              <div className="rounded-2xl border border-orange-500/10 bg-gradient-to-br from-[#211814] to-[#181210] p-4 shadow-[0_10px_25px_rgba(0,0,0,0.18)] sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#8f7767]">
                      Stok Daging Realtime
                    </p>
                    <p className="mt-2 text-2xl font-bold tracking-tight text-[#f08a3c]">
                      {Math.round(stats.meatStockGram).toLocaleString('id-ID')}
                      <span className="ml-1 text-sm font-medium">g</span>
                    </p>
                  </div>
                  <div className="rounded-xl border border-orange-500/10 bg-orange-500/[0.07] p-2.5 text-[#f08a3c]">
                    <Package className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-2 text-[10px] text-[#8f7767]">Sinkron dengan inventory</p>
              </div>
            </section>

            {/* PAYMENT SUMMARY */}
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/[0.06] bg-[#141210] px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.12em] text-[#6f675f]">Cash</p>
                    <p className="mt-1 text-sm font-bold text-[#d8d0c7]">{formatRupiah(stats.totalCash)}</p>
                  </div>
                  <DollarSign className="h-4 w-4 text-[#8f877e]" />
                </div>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-[#141210] px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.12em] text-[#6f675f]">QRIS</p>
                    <p className="mt-1 text-sm font-bold text-[#d8d0c7]">{formatRupiah(stats.totalQris)}</p>
                  </div>
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                </div>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-[#141210] px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.12em] text-[#6f675f]">Transfer</p>
                    <p className="mt-1 text-sm font-bold text-[#d8d0c7]">{formatRupiah(stats.totalTransfer)}</p>
                  </div>
                  <Clock className="h-4 w-4 text-sky-400" />
                </div>
              </div>
            </section>

            {/* MAIN GRID */}
            <section className="grid grid-cols-1 gap-5 xl:grid-cols-12">

              {/* CALENDAR */}
              <div className="xl:col-span-7">
                <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#141210] shadow-[0_10px_30px_rgba(0,0,0,0.22)]">

                  <div className="border-b border-white/[0.06] p-4 sm:p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="rounded-lg border border-orange-500/10 bg-orange-500/[0.06] p-2 text-[#f08a3c]">
                            <CalendarIcon className="h-4 w-4" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-[#f5f1ea] sm:text-base">
                              Kalender & Booking Kamar
                            </h3>
                            <p className="mt-0.5 text-[10px] text-[#6f675f]">
                              Pilih tanggal untuk melihat okupansi tamu inap.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={goToPreviousMonth}
                          className="rounded-lg border border-white/[0.07] bg-[#0f0e0d] p-2 text-[#8f877e] transition hover:border-white/[0.12] hover:text-[#f5f1ea]"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>

                        <div className="min-w-[140px] rounded-lg border border-white/[0.07] bg-[#0f0e0d] px-3 py-2 text-center">
                          <p className="text-xs font-bold text-[#e6ded5]">
                            {monthNames[month]} {year}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={goToNextMonth}
                          className="rounded-lg border border-white/[0.07] bg-[#0f0e0d] p-2 text-[#8f877e] transition hover:border-white/[0.12] hover:text-[#f5f1ea]"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={goToToday}
                          className="rounded-lg border border-orange-500/10 bg-orange-500/[0.05] px-3 py-2 text-[10px] font-semibold text-[#f08a3c] transition hover:bg-orange-500/[0.10]"
                        >
                          Hari Ini
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto p-3 sm:p-4">
                    <div className="min-w-[620px]">
                      <div className="grid grid-cols-7 gap-1.5 text-center">
                        {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((day) => (
                          <div key={day} className="px-1 py-2 text-[9px] font-bold uppercase tracking-[0.12em] text-[#5f5953]">
                            {day}
                          </div>
                        ))}

                        {Array.from({ length: firstDayIndex }).map((_, i) => (
                          <div key={`blank-${i}`} className="h-[92px] rounded-xl border border-transparent" />
                        ))}

                        {Array.from({ length: daysInMonth }).map((_, i) => {
                          const dayNum = i + 1;
                          const cellDate = new Date(year, month, dayNum);
                          const isToday = getDateKey(cellDate) === getDateKey(new Date());
                          const isSelected = getDateKey(cellDate) === getDateKey(selectedDate);

                          const dayBookings = getBookingsForDate(cellDate);
                          const bookingCount = dayBookings.length;

                          return (
                            <button
                              key={dayNum}
                              type="button"
                              onClick={() => setSelectedDate(cellDate)}
                              className={`
                                group flex h-[92px] flex-col justify-between rounded-xl border p-2 text-left transition
                                ${
                                  isSelected
                                    ? 'border-orange-500/40 bg-orange-500/[0.08] shadow-[inset_0_0_0_1px_rgba(217,107,43,0.08)]'
                                    : 'border-white/[0.06] bg-[#0f0e0d] hover:border-white/[0.12] hover:bg-[#171513]'
                                }
                              `}
                            >
                              <div className="flex items-center justify-between">
                                <span className={`text-xs font-bold ${isSelected || isToday ? 'text-[#f08a3c]' : 'text-[#d4ccc4]'}`}>
                                  {dayNum}
                                </span>

                                {isToday && (
                                  <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-bold uppercase text-emerald-400">
                                    Hari Ini
                                  </span>
                                )}
                              </div>

                              <div className="space-y-1">
                                {bookingCount > 0 ? (
                                  <>
                                    <div className="flex items-center gap-1.5">
                                      <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                                      <span className="text-[9px] font-semibold text-red-300">
                                        {bookingCount} Tamu Inap
                                      </span>
                                    </div>
                                    <p className="truncate text-[8px] text-[#8f877e]">
                                      {dayBookings[0]?.guestName || 'Kamar Terisi'}
                                    </p>
                                  </>
                                ) : (
                                  <>
                                    <div className="flex items-center gap-1.5">
                                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                      <span className="text-[9px] font-semibold text-emerald-400">
                                        Tersedia
                                      </span>
                                    </div>
                                    <p className="truncate text-[8px] text-[#6f675f]">
                                      Belum ada booking
                                    </p>
                                  </>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-white/[0.06] bg-[#11100f] px-4 py-3">
                    <div className="flex flex-wrap items-center gap-4 text-[9px] font-medium text-[#6f675f]">
                      <span className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Tidak ada booking
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                        Ada booking / terisi
                      </span>
                      {bookingSourceTable && (
                        <span className="ml-auto text-[#8f877e]">
                          Sumber Data: {bookingSourceTable}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ROOM + TABLE STATUS */}
              <div className="space-y-5 xl:col-span-5">

                {/* STATUS KAMAR */}
                <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#141210] shadow-[0_10px_30px_rgba(0,0,0,0.22)]">
                  <div className="border-b border-white/[0.06] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="rounded-lg border border-sky-500/10 bg-sky-500/[0.06] p-2 text-sky-400">
                            <BedDouble className="h-4 w-4" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-[#f5f1ea]">
                              Status Kamar Realtime
                            </h4>
                            <p className="text-[9px] text-[#6f675f]">
                              {new Intl.DateTimeFormat('id-ID', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                              }).format(selectedDate)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="rounded-full border border-emerald-500/10 bg-emerald-500/[0.05] px-2.5 py-1 text-[9px] font-semibold text-emerald-400">
                          Tersedia {availableRooms}
                        </span>
                        <span className="rounded-full border border-red-500/10 bg-red-500/[0.05] px-2.5 py-1 text-[9px] font-semibold text-red-400">
                          Terisi {occupiedRooms}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4">
                    {rooms.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-white/[0.08] bg-[#0f0e0d] px-4 py-10 text-center">
                        <BedDouble className="mx-auto mb-2 h-6 w-6 text-[#514c47]" />
                        <p className="text-xs font-medium text-[#8f877e]">Belum ada master kamar.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {rooms.map((room) => {
                          const booking = getRoomBooking(room, selectedDate);
                          const activeInapOrder = activeInapOrders.find(o => String(o.room_id) === String(room.id));
                          
                          const staticOccupied = ['booked', 'occupied', 'terisi'].includes(
                            String(room.status || '').toLowerCase()
                          );

                          const isBooked = Boolean(booking) || Boolean(activeInapOrder) || staticOccupied;
                          const guestName = activeInapOrder?.guests?.name || booking?.guestName;

                          return (
                            <div
                              key={room.id}
                              className={`
                                rounded-xl border p-3 transition
                                ${
                                  isBooked
                                    ? 'border-red-500/15 bg-red-500/[0.05]'
                                    : 'border-emerald-500/15 bg-emerald-500/[0.04]'
                                }
                              `}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-[#eee6de]">
                                  {room.room_number}
                                </span>
                                <span
                                  className={`h-2 w-2 rounded-full ${
                                    isBooked ? 'animate-pulse bg-red-400' : 'bg-emerald-400'
                                  }`}
                                />
                              </div>

                              <p
                                className={`mt-2 text-[9px] font-semibold uppercase tracking-[0.08em] ${
                                  isBooked ? 'text-red-300' : 'text-emerald-400'
                                }`}
                              >
                                {isBooked ? 'Terisi / Booking' : 'Tersedia'}
                              </p>

                              {guestName && (
                                <p className="mt-1 truncate text-[9px] font-medium text-[#d8d0c7]">
                                  👤 {guestName}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* STATUS MEJA RESTORAN (REALTIME KOSONG / TERISI) */}
                <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#141210] shadow-[0_10px_30px_rgba(0,0,0,0.22)]">
                  <div className="flex items-center justify-between border-b border-white/[0.06] p-4">
                    <div className="flex items-center gap-2">
                      <div className="rounded-lg border border-orange-500/10 bg-orange-500/[0.06] p-2 text-[#f08a3c]">
                        <Utensils className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-[#f5f1ea]">
                          Status Meja Restoran Realtime
                        </h4>
                        <p className="text-[9px] text-[#6f675f]">
                          Status terhubung tombol Selesai Makan di POS.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-emerald-500/10 bg-emerald-500/[0.05] px-2.5 py-1 text-[9px] font-semibold text-emerald-400">
                        Tersedia {availableTablesCount}
                      </span>
                      <span className="rounded-full border border-orange-500/10 bg-orange-500/[0.05] px-2.5 py-1 text-[9px] font-semibold text-[#f08a3c]">
                        Terisi {occupiedTablesCount}
                      </span>
                    </div>
                  </div>

                  <div className="p-4">
                    {tables.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-white/[0.08] bg-[#0f0e0d] px-4 py-8 text-center">
                        <Utensils className="mx-auto mb-2 h-6 w-6 text-[#514c47]" />
                        <p className="text-xs font-medium text-[#8f877e]">Belum ada master meja.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {tables.map((table) => {
                          const activeRestoOrder = activeRestoOrders.find(o => String(o.table_id) === String(table.id));
                          const dbStatus = String(table.status || '').toLowerCase();
                          const isOccupied = Boolean(activeRestoOrder) || ['occupied', 'terisi', 'booked'].includes(dbStatus);

                          return (
                            <div
                              key={table.id}
                              className={`
                                rounded-xl border p-2.5 text-center transition
                                ${
                                  isOccupied
                                    ? 'border-orange-500/25 bg-orange-500/[0.08]'
                                    : 'border-emerald-500/15 bg-emerald-500/[0.04]'
                                }
                              `}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <p className="text-xs font-bold text-[#eee6de]">
                                  {table.table_number}
                                </p>
                                <span
                                  className={`h-2 w-2 rounded-full ${
                                    isOccupied ? 'animate-pulse bg-orange-400' : 'bg-emerald-400'
                                  }`}
                                />
                              </div>

                              <p
                                className={`mt-1 text-[8px] font-semibold uppercase ${
                                  isOccupied ? 'text-[#f08a3c]' : 'text-emerald-400'
                                }`}
                              >
                                {isOccupied ? 'Terisi' : 'Kosong'}
                              </p>

                              {isOccupied && activeRestoOrder?.guests?.name && (
                                <p className="mt-1 truncate text-[8px] text-[#a0988e]">
                                  👤 {activeRestoOrder.guests.name}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </section>

            {/* RECENT ORDERS */}
            <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#141210] shadow-[0_10px_30px_rgba(0,0,0,0.22)]">
              <div className="flex items-center justify-between border-b border-white/[0.06] p-4 sm:p-5">
                <div>
                  <h3 className="text-sm font-bold text-[#f5f1ea] sm:text-base">
                    Aktivitas Transaksi Terbaru (Hari Ini)
                  </h3>
                  <p className="mt-0.5 text-[9px] text-[#6f675f]">
                    Semua transaksi resto dan penginapan.
                  </p>
                </div>

                <Clock className="h-4 w-4 text-[#6f675f]" />
              </div>

              {recentOrders.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <CheckCircle2 className="mx-auto mb-2 h-7 w-7 text-[#4f4944]" />
                  <p className="text-xs font-medium text-[#8f877e]">
                    Belum ada transaksi hari ini.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.05]">
                  {recentOrders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between gap-4 px-4 py-3.5 transition hover:bg-white/[0.018] sm:px-5"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-[#eee6de]">
                            {order.order_number || order.id?.slice(0, 8)}
                          </span>

                          <span className="rounded-md border border-white/[0.06] bg-[#0f0e0d] px-2 py-0.5 text-[8px] font-semibold uppercase text-[#8f877e]">
                            {order.order_type || '-'}
                          </span>

                          {order.rooms?.room_number && (
                            <span className="text-[9px] text-sky-400 font-semibold">
                              ({order.rooms.room_number})
                            </span>
                          )}

                          {order.tables?.table_number && (
                            <span className="text-[9px] text-orange-400 font-semibold">
                              ({order.tables.table_number})
                            </span>
                          )}
                        </div>

                        <p className="mt-1 truncate text-[9px] text-[#6f675f]">
                          {order.guests?.name || 'Tamu Umum'} •{' '}
                          {new Date(order.created_at).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-xs font-bold text-[#f08a3c] sm:text-sm">
                          {formatRupiah(order.total_amount)}
                        </p>

                        <span
                          className={`text-[8px] font-semibold uppercase ${
                            String(order.payment_status || '').toLowerCase() === 'lunas'
                              ? 'text-emerald-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {order.payment_status || 'Belum Lunas'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

          </>
        )}
      </div>
    </div>
  );
}