import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { 
  BedDouble, Plus, Trash2, ShoppingBag, 
  X, Loader2, Edit3, Search, Scale, Calendar as CalendarIcon
} from 'lucide-react';

export default function PesananInap() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState([]);
  const [guests, setGuests] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentEditOrder, setCurrentEditOrder] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Search Tamu State
  const [guestSearch, setGuestSearch] = useState('');

  // Form State Inap Baru
  const [selectedGuest, setSelectedGuest] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('');
  const [pax, setPax] = useState('1');
  const [checkInDate, setCheckInDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [checkOutDate, setCheckOutDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [paymentMethod, setPaymentMethod] = useState('transfer');
  const [isDp, setIsDp] = useState(false);
  const [dpAmount, setDpAmount] = useState('');
  const [cart, setCart] = useState([]); 

  // Edit State
  const [editCart, setEditCart] = useState([]);
  const [editRoom, setEditRoom] = useState('');
  const [editCheckIn, setEditCheckIn] = useState('');
  const [editCheckOut, setEditCheckOut] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          guests(name, phone),
          rooms(room_number),
          order_items(*, menus(*, inventory(id, item_name, stock_gram)))
        `)
        .eq('order_type', 'penginapan')
        .order('created_at', { ascending: false });

      if (orderError) throw orderError;
      setOrders(orderData || []);

      const { data: guestData } = await supabase.from('guests').select('*').order('name');
      setGuests(guestData || []);

      const { data: roomData } = await supabase.from('rooms').select('*').order('room_number');
      setRooms(roomData || []);

      const { data: menuData } = await supabase
        .from('menus')
        .select('*, inventory(id, item_name, stock_gram)')
        .eq('category', 'penginapan')
        .eq('is_ready', true)
        .order('name');
      setMenus(menuData || []);

    } catch (error) {
      console.error('Error fetching lodging data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('pesanan_inap_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredGuests = guests.filter(g => 
    g.name.toLowerCase().includes(guestSearch.toLowerCase()) || 
    (g.phone && g.phone.includes(guestSearch))
  );

  const handleAddToCart = (menu, isEdit = false) => {
    const isMeat = menu.is_meat;
    const isNasiGoreng = menu.name.toLowerCase().includes('nasi goreng');
    const gramType = isMeat ? (isNasiGoreng ? 'fiks' : 'fleksibel') : 'none';
    const initialGram = isMeat ? (isNasiGoreng ? 30 : (menu.meat_gram || 100)) : 0;

    const targetCart = isEdit ? editCart : cart;
    const setCartFunc = isEdit ? setEditCart : setCart;

    const existingIndex = targetCart.findIndex(item => item.menuId === menu.id);
    if (existingIndex > -1) {
      const newCart = [...targetCart];
      newCart[existingIndex].qty += 1;
      setCartFunc(newCart);
    } else {
      setCartFunc([...targetCart, {
        menuId: menu.id,
        name: menu.name,
        price: menu.price,
        qty: 1,
        notes: '',
        isMeat: isMeat,
        inventoryId: menu.inventory_id,
        meatName: menu.inventory?.item_name || 'Daging',
        gramType: gramType,
        meatGram: initialGram
      }]);
    }
  };

  const handleUpdateQty = (index, delta, isEdit = false) => {
    const targetCart = isEdit ? editCart : cart;
    const setCartFunc = isEdit ? setEditCart : setCart;

    const newCart = [...targetCart];
    newCart[index].qty += delta;
    if (newCart[index].qty <= 0) {
      newCart.splice(index, 1);
    }
    setCartFunc(newCart);
  };

  const handleUpdateMeatGram = (index, gram, isEdit = false) => {
    const targetCart = isEdit ? editCart : cart;
    const setCartFunc = isEdit ? setEditCart : setCart;

    const newCart = [...targetCart];
    newCart[index].meatGram = parseFloat(gram) || 0;
    setCartFunc(newCart);
  };

  const calculateTotal = (isEdit = false) => {
    const targetCart = isEdit ? editCart : cart;
    const menuTotal = targetCart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const numPax = parseInt(pax) || 1;
    const lodgingTotal = numPax * 200000;
    return menuTotal + lodgingTotal;
  };

  // CREATE CHECK-IN INAP DENGAN DATES & SINKRONISASI KALENDER
  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (!selectedGuest || !selectedRoom) {
      alert('Silakan pilih Tamu dan Kamar terlebih dahulu.');
      return;
    }
    if (!checkInDate || !checkOutDate) {
      alert('Silakan pilih tanggal check-in dan check-out.');
      return;
    }

    setSubmitLoading(true);
    try {
      const totalAmount = calculateTotal(false);
      const orderNumber = 'ORD-INAP-' + Date.now().toString().slice(-6);
      const numPax = parseInt(pax) || 1;

      // 1. Simpan Order lengkap dengan check_in & check_out
      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert([{
          order_number: orderNumber,
          guest_id: selectedGuest,
          order_type: 'penginapan',
          room_id: selectedRoom,
          check_in: checkInDate,
          check_out: checkOutDate,
          status: 'processing',
          payment_status: isDp ? 'belum_lunas' : 'lunas',
          payment_method: paymentMethod,
          is_dp: isDp,
          dp_amount: isDp ? parseFloat(dpAmount) || 0 : 0,
          total_amount: totalAmount
        }])
        .select()
        .single();

      if (orderError) throw orderError;

      // 2. Simpan Items jika ada menu tambahan
      if (cart.length > 0) {
        const orderItemsPayload = cart.map(item => ({
          order_id: newOrder.id,
          menu_id: item.menuId,
          qty: item.qty,
          actual_meat_gram: item.isMeat ? item.meatGram * item.qty : 0,
          notes: `Pax: ${numPax} | ${item.notes || ''}`,
          subtotal: item.price * item.qty
        }));

        await supabase.from('order_items').insert(orderItemsPayload);

        // Potong stok daging jika ada
        for (const item of cart) {
          if (item.isMeat && item.inventoryId) {
            const totalUsageGrams = item.meatGram * item.qty;
            if (totalUsageGrams > 0) {
              const { data: currentInv } = await supabase.from('inventory').select('*').eq('id', item.inventoryId).single();
              if (currentInv) {
                const remainingStock = Math.max(0, (currentInv.stock_gram || 0) - totalUsageGrams);
                await supabase.from('inventory').update({ stock_gram: remainingStock }).eq('id', item.inventoryId);

                const roomObj = rooms.find(r => r.id === selectedRoom);
                await supabase.from('stock_movements').insert([{
                  inventory_id: item.inventoryId,
                  movement_type: 'usage',
                  gram_change: -totalUsageGrams,
                  remaining_gram: remainingStock,
                  operator_id: profile?.id,
                  notes: `Pesanan Inap ${orderNumber} (${roomObj?.room_number || 'Kamar'}) - ${item.name}`
                }]);
              }
            }
          }
        }
      }

      // Update status kamar
      await supabase.from('rooms').update({ status: 'booked' }).eq('id', selectedRoom);

      setIsModalOpen(false);
      setCart([]);
      setSelectedGuest('');
      setSelectedRoom('');
      setGuestSearch('');
      setPax('1');
      setIsDp(false);
      setDpAmount('');
      await fetchData();
      alert('Check-in kamar berhasil & rentang tanggal otomatis tercatat di Kalender Dashboard!');
    } catch (error) {
      alert('Gagal membuat pesanan penginapan: ' + error.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleOpenEdit = (order) => {
    setCurrentEditOrder(order);
    setEditRoom(order.room_id || '');
    setEditCheckIn(order.check_in ? order.check_in.split('T')[0] : new Date().toISOString().split('T')[0]);
    setEditCheckOut(order.check_out ? order.check_out.split('T')[0] : new Date().toISOString().split('T')[0]);

    const existingItems = order.order_items.map(item => {
      const menuObj = item.menus;
      return {
        menuId: item.menu_id,
        name: menuObj?.name || 'Menu',
        price: item.subtotal / item.qty,
        qty: item.qty,
        notes: item.notes || '',
        isMeat: menuObj?.is_meat || false,
        inventoryId: menuObj?.inventory_id || null,
        meatName: menuObj?.inventory?.item_name || 'Daging',
        meatGram: item.actual_meat_gram ? item.actual_meat_gram / item.qty : (menuObj?.meat_gram || 0)
      };
    });

    setEditCart(existingItems);
    setIsEditModalOpen(true);
  };

  const handleUpdateOrder = async (e) => {
    e.preventDefault();
    setSubmitLoading(true);
    try {
      const menuTotal = editCart.reduce((sum, item) => sum + (item.price * item.qty), 0);
      const numPax = parseInt(pax) || 1;
      const newTotal = menuTotal + (numPax * 200000);

      if (currentEditOrder.room_id && currentEditOrder.room_id !== editRoom) {
        await supabase.from('rooms').update({ status: 'available' }).eq('id', currentEditOrder.room_id);
        await supabase.from('rooms').update({ status: 'booked' }).eq('id', editRoom);
      }

      await supabase.from('orders').update({
        room_id: editRoom,
        check_in: editCheckIn,
        check_out: editCheckOut,
        total_amount: newTotal
      }).eq('id', currentEditOrder.id);

      await supabase.from('order_items').delete().eq('order_id', currentEditOrder.id);

      if (editCart.length > 0) {
        const newItemsPayload = editCart.map(item => ({
          order_id: currentEditOrder.id,
          menu_id: item.menuId,
          qty: item.qty,
          actual_meat_gram: item.isMeat ? item.meatGram * item.qty : 0,
          notes: item.notes,
          subtotal: item.price * item.qty
        }));
        await supabase.from('order_items').insert(newItemsPayload);
      }

      setIsEditModalOpen(false);
      setCurrentEditOrder(null);
      setEditCart([]);
      await fetchData();
      alert('Pesanan penginapan berhasil diperbarui!');
    } catch (error) {
      alert('Gagal memperbarui pesanan: ' + error.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteOrder = async (order) => {
    if (!confirm('Check-out tamu dan hapus pesanan inap ini? Kamar akan kembali tersedia.')) return;
    try {
      if (order.room_id) {
        await supabase.from('rooms').update({ status: 'available' }).eq('id', order.room_id);
      }
      await supabase.from('order_items').delete().eq('order_id', order.id);
      const { error } = await supabase.from('orders').delete().eq('id', order.id);
      if (error) throw error;
      await fetchData();
      alert('Check-out & hapus pesanan berhasil.');
    } catch (error) {
      alert('Gagal menghapus: ' + error.message);
    }
  };

  const formatRupiah = (num) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
  };

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-100 tracking-tight">Pesanan & Check-in Penginapan</h2>
          <p className="text-sm text-zinc-400 mt-1">Pilih tanggal inap, kelola kamar, dan sinkronkan dengan kalender dashboard.</p>
        </div>

        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm shadow-lg shadow-blue-900/20"
        >
          <Plus className="h-4 w-4" />
          <span>Check-in / Pesanan Inap Baru</span>
        </button>
      </div>

      {/* Daftar Tamu Menginap */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-zinc-800 flex justify-between items-center">
          <h3 className="font-bold text-zinc-100 flex items-center gap-2">
            <BedDouble className="h-5 w-5 text-blue-500" />
            Daftar Kamar & Tamu Menginap
          </h3>
          <span className="text-xs text-zinc-400 bg-zinc-950 px-3 py-1 rounded-full border border-zinc-800">
            Total: {orders.length} Transaksi
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
            <Loader2 className="animate-spin h-8 w-8 mb-4 text-blue-500" />
            <p>Memuat data penginapan...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500 text-center px-4">
            <ShoppingBag className="h-8 w-8 text-zinc-600 mb-2" />
            <p className="font-medium text-zinc-300">Belum ada tamu menginap</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {orders.map((order) => (
              <div key={order.id} className="p-5 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 hover:bg-zinc-800/30 transition-colors">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-zinc-100 text-base">{order.order_number}</span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      Kamar: {order.rooms?.room_number || 'Kamar'}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${order.payment_status === 'lunas' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                      {order.payment_status}
                    </span>
                  </div>

                  <p className="text-sm text-zinc-300">
                    Tamu: <strong className="text-zinc-100">{order.guests?.name || 'Tamu'}</strong> ({order.guests?.phone || '-'})
                  </p>

                  <div className="flex items-center gap-2 text-xs text-sky-400 bg-sky-500/10 px-3 py-1 rounded-lg border border-sky-500/20 w-fit">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    <span>Menginap: <strong>{formatDateDisplay(order.check_in || order.created_at)}</strong> s/d <strong>{formatDateDisplay(order.check_out || order.check_in || order.created_at)}</strong></span>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {order.order_items?.map((item, idx) => (
                      <span key={idx} className="text-xs bg-zinc-950 px-2.5 py-1 rounded-lg border border-zinc-800 text-zinc-300">
                        {item.menus?.name || 'Menu'} x{item.qty} {item.actual_meat_gram > 0 && <span className="text-blue-400 font-semibold">({item.actual_meat_gram}g)</span>}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-lg font-bold text-blue-400">{formatRupiah(order.total_amount)}</div>
                    <span className="text-xs text-zinc-500">Dibuat: {new Date(order.created_at).toLocaleDateString('id-ID')}</span>
                  </div>
                  <div className="flex items-center gap-1.5 border-l border-zinc-800 pl-3">
                    <button onClick={() => handleOpenEdit(order)} className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl" title="Edit Pesanan">
                      <Edit3 className="h-4 w-4 text-blue-400" />
                    </button>
                    <button onClick={() => handleDeleteOrder(order)} className="p-2 bg-zinc-800 hover:bg-red-950 text-red-400 rounded-xl" title="Check-out & Hapus">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Check-in Inap Baru */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-4xl shadow-2xl relative my-8 overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="bg-zinc-900 border-b border-zinc-800 p-5 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-zinc-100">Check-in Penginapan Baru</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Atur tanggal menginap tamu agar langsung muncul di Kalender Realtime Dashboard.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-xl">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden">
              <div className="lg:col-span-7 p-6 overflow-y-auto border-r border-zinc-800 space-y-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Pilih Menu Tambahan Kamar</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {menus.map((menu) => (
                    <div 
                      key={menu.id} 
                      onClick={() => handleAddToCart(menu, false)}
                      className="bg-zinc-950 border border-zinc-800 hover:border-blue-500/50 rounded-xl p-4 cursor-pointer transition-all flex flex-col justify-between space-y-3 group"
                    >
                      <div>
                        <h5 className="font-semibold text-zinc-100 text-sm group-hover:text-blue-400 transition-colors">{menu.name}</h5>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {menu.is_meat ? <span className="text-blue-400 font-medium">🥩 {menu.inventory?.item_name || 'Daging'}</span> : 'Non-Daging'}
                        </p>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-blue-400 text-sm">{formatRupiah(menu.price)}</span>
                        <span className="w-7 h-7 rounded-lg bg-zinc-900 group-hover:bg-blue-600 group-hover:text-white text-zinc-300 flex items-center justify-center transition-colors">
                          <Plus className="h-4 w-4" />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-5 p-6 bg-zinc-950/50 flex flex-col justify-between overflow-y-auto space-y-6">
                <form id="inapForm" onSubmit={handleCreateOrder} className="space-y-4">
                  
                  {/* Pencarian Tamu */}
                  <div className="space-y-2 bg-zinc-900 p-3 rounded-xl border border-zinc-800">
                    <label className="text-xs text-zinc-300 font-semibold flex items-center gap-1.5">
                      <Search className="h-3.5 w-3.5 text-blue-400" /> Cari & Pilih Tamu
                    </label>
                    <input 
                      type="text"
                      placeholder="Ketik nama atau no. telepon..."
                      value={guestSearch}
                      onChange={(e) => setGuestSearch(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:border-blue-500 focus:outline-none"
                    />
                    <select 
                      required 
                      value={selectedGuest} 
                      onChange={(e) => setSelectedGuest(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">-- Pilih Tamu ({filteredGuests.length}) --</option>
                      {filteredGuests.map(g => (
                        <option key={g.id} value={g.id}>{g.name} ({g.phone || '-'})</option>
                      ))}
                    </select>
                  </div>

                  {/* TANGGAL INAP (CHECK-IN & CHECK-OUT) */}
                  <div className="grid grid-cols-2 gap-3 bg-zinc-900 p-3 rounded-xl border border-zinc-800">
                    <div className="space-y-1">
                      <label className="text-xs text-zinc-300 font-semibold flex items-center gap-1">
                        <CalendarIcon className="h-3.5 w-3.5 text-blue-400" /> Check-in
                      </label>
                      <input 
                        type="date" 
                        required 
                        value={checkInDate} 
                        onChange={(e) => setCheckInDate(e.target.value)} 
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-blue-500" 
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-zinc-300 font-semibold flex items-center gap-1">
                        <CalendarIcon className="h-3.5 w-3.5 text-blue-400" /> Check-out
                      </label>
                      <input 
                        type="date" 
                        required 
                        value={checkOutDate} 
                        onChange={(e) => setCheckOutDate(e.target.value)} 
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-blue-500" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-zinc-400 font-medium">Nomor Kamar</label>
                      <select required value={selectedRoom} onChange={(e) => setSelectedRoom(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:border-blue-500 focus:outline-none">
                        <option value="">-- Pilih Kamar --</option>
                        {rooms.map(r => (<option key={r.id} value={r.id}>{r.room_number}</option>))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-zinc-400 font-medium">Jumlah Orang (Pax)</label>
                      <input type="number" min="1" required value={pax} onChange={(e) => setPax(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none font-bold text-blue-400" />
                    </div>
                  </div>

                  {cart.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-zinc-800">
                      <label className="text-xs text-zinc-400 font-medium">Menu Tambahan ({cart.length})</label>
                      <div className="space-y-2 max-h-36 overflow-y-auto">
                        {cart.map((item, idx) => (
                          <div key={idx} className="bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 space-y-1.5">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-semibold text-zinc-100">{item.name}</span>
                              <button type="button" onClick={() => handleUpdateQty(idx, -item.qty, false)} className="text-zinc-500 hover:text-red-400"><Trash2 className="h-3.5 w-3.5"/></button>
                            </div>
                            {item.isMeat && item.gramType !== 'fiks' && (
                              <div className="flex items-center gap-1 text-[11px] text-blue-400">
                                <Scale className="h-3 w-3" />
                                <input type="number" value={item.meatGram} onChange={(e) => handleUpdateMeatGram(idx, e.target.value, false)} className="w-14 bg-zinc-950 border border-zinc-700 rounded px-1 py-0.5 text-center font-bold text-white" /> gram ({item.meatName})
                              </div>
                            )}
                            <div className="flex justify-between text-xs pt-1">
                              <span className="font-bold text-blue-400">{formatRupiah(item.price * item.qty)}</span>
                              <div className="flex items-center gap-1.5 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 text-xs">
                                <button type="button" onClick={() => handleUpdateQty(idx, -1, false)}>-</button>
                                <span className="font-bold px-1">{item.qty}</span>
                                <button type="button" onClick={() => handleUpdateQty(idx, 1, false)}>+</button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 pt-2 border-t border-zinc-800">
                    <label className="text-xs text-zinc-400 font-medium">Metode Pembayaran</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['cash', 'qris', 'transfer'].map(method => (
                        <button key={method} type="button" onClick={() => setPaymentMethod(method)} className={`py-2 text-xs font-semibold rounded-xl uppercase border ${paymentMethod === method ? 'bg-blue-600 text-white border-blue-500' : 'bg-zinc-900 text-zinc-400 border-zinc-800'}`}>
                          {method}
                        </button>
                      ))}
                    </div>
                  </div>
                </form>

                <div className="pt-4 border-t border-zinc-800 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-400 font-medium">Total:</span>
                    <span className="text-xl font-bold text-blue-400">{formatRupiah(calculateTotal(false))}</span>
                  </div>

                  <button type="submit" form="inapForm" disabled={submitLoading} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm shadow-lg disabled:opacity-50 flex items-center justify-center gap-2">
                    {submitLoading && <Loader2 className="h-4 w-4 animate-spin"/>}
                    <span>Proses Check-in</span>
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Modal Edit Pesanan Inap */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-3xl shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-lg font-bold text-zinc-100">Edit Pesanan Inap: {currentEditOrder?.order_number}</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-zinc-400"><X className="h-5 w-5"/></button>
            </div>

            <form onSubmit={handleUpdateOrder} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-medium">Nomor Kamar</label>
                  <select required value={editRoom} onChange={(e) => setEditRoom(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none">
                    {rooms.map(r => (<option key={r.id} value={r.id}>{r.room_number}</option>))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-medium">Check-in</label>
                  <input type="date" required value={editCheckIn} onChange={(e) => setEditCheckIn(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-medium">Check-out</label>
                <input type="date" required value={editCheckOut} onChange={(e) => setEditCheckOut(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none" />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-zinc-400 font-medium">Menu Tambahan</label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {editCart.map((item, idx) => (
                    <div key={idx} className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 flex justify-between items-center">
                      <div>
                        <span className="font-semibold text-zinc-100 text-xs">{item.name}</span>
                        {item.meatGram > 0 && <span className="block text-[10px] text-blue-400">🥩 Custom Daging: {item.meatGram}g</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-blue-400 font-bold text-xs">{formatRupiah(item.price * item.qty)}</span>
                        <div className="flex items-center gap-1 bg-zinc-900 px-2 py-1 rounded border border-zinc-800 text-xs">
                          <button type="button" onClick={() => handleUpdateQty(idx, -1, true)}>-</button>
                          <span className="px-1 font-bold">{item.qty}</span>
                          <button type="button" onClick={() => handleUpdateQty(idx, 1, true)}>+</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-800 flex justify-between items-center">
                <span className="font-bold text-zinc-300">Total Baru: <strong className="text-blue-400">{formatRupiah(editCart.reduce((s, i) => s + (i.price * i.qty), 0) + (parseInt(pax) * 200000))}</strong></span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-sm text-zinc-300">Batal</button>
                  <button type="submit" disabled={submitLoading} className="px-5 py-2 text-sm font-semibold bg-blue-600 text-white rounded-xl">Simpan Perubahan</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}