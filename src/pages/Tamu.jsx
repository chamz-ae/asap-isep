import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Users, Search, PlusCircle, X, Utensils, BedDouble, 
  Phone, Loader2, Star, User, Edit
} from 'lucide-react';

export default function Tamu() {
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // State untuk Modal Form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formType, setFormType] = useState('restoran'); 
  const [submitLoading, setSubmitLoading] = useState(false);
  
  // State Edit Mode
  const [editingId, setEditingId] = useState(null);

  // State Input Form
  const [formData, setFormData] = useState({
    name: '', phone: '', notes: '', dp: '', is_returning: false,
    date: '', adults: '', teens: '', children: '',
    checkIn: '', checkOut: '', pax: '', rooms: ''
  });

  const fetchGuests = async () => {
    try {
      const { data, error } = await supabase
        .from('guests')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setGuests(data || []);
    } catch (error) {
      console.error('Error fetching guests:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuests();
  }, []);

  const filteredGuests = guests.filter(guest => 
    guest.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    guest.phone.includes(searchQuery)
  );

  const handleEditClick = (guest) => {
    setEditingId(guest.id);
    setFormData({
      ...formData,
      name: guest.name,
      phone: guest.phone,
      is_returning: guest.is_returning
    });
    setIsModalOpen(true);
  };

  const handleAddClick = () => {
    setEditingId(null);
    resetForm();
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitLoading(true);

    try {
      if (editingId) {
        // --- MODE EDIT ---
        const { error: updateError } = await supabase
          .from('guests')
          .update({ 
            name: formData.name, 
            phone: formData.phone,
            is_returning: formData.is_returning 
          })
          .eq('id', editingId);
          
        if (updateError) throw updateError;
        
      } else {
        // --- MODE TAMBAH BARU ---
        // Cek apakah nomor HP sudah terdaftar
        const { data: existingGuest } = await supabase
          .from('guests')
          .select('*')
          .eq('phone', formData.phone)
          .maybeSingle();

        if (existingGuest) {
          // Jika sudah ada, ubah status jadi Pelanggan Setia
          const { error: updateError } = await supabase
            .from('guests')
            .update({ is_returning: true, name: formData.name })
            .eq('id', existingGuest.id);
          if (updateError) throw updateError;
        } else {
          // Jika belum ada, masukkan data baru
          const { error: insertError } = await supabase
            .from('guests`') // (Pastikan nama tabel benar)
            .insert([{ name: formData.name, phone: formData.phone, is_returning: false }]);
          
          // Perbaikan query insert tanpa typo:
          const { error: properInsertError } = await supabase
            .from('guests')
            .insert([{ name: formData.name, phone: formData.phone, is_returning: false }]);

          if (properInsertError) throw properInsertError;
        }
      }

      // Ambil ulang data terbaru dari database secara langsung
      await fetchGuests();
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      alert('Gagal menyimpan tamu: ' + error.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '', phone: '', notes: '', dp: '', is_returning: false,
      date: '', adults: '', teens: '', children: '',
      checkIn: '', checkOut: '', pax: '', rooms: ''
    });
    setEditingId(null);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-100 tracking-tight">Manajemen Tamu</h2>
          <p className="text-sm text-zinc-400 mt-1">Kelola data tamu restoran dan penginapan.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Cari nama / no. HP..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-64 bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <button 
            onClick={handleAddClick}
            className="flex items-center justify-center gap-2 bg-primary hover:bg-amber-600 text-zinc-950 font-semibold px-4 py-2 rounded-xl transition-colors text-sm shadow-lg shadow-amber-900/20"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Tambah Tamu</span>
          </button>
        </div>
      </div>

      {/* Konten Utama (Tabel / Card) */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
            <Loader2 className="animate-spin h-8 w-8 mb-4 text-primary" />
            <p>Memuat data tamu...</p>
          </div>
        ) : filteredGuests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500 text-center px-4">
            <div className="w-16 h-16 bg-zinc-950 rounded-full flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-zinc-600" />
            </div>
            <p className="font-medium text-zinc-300">Belum ada data tamu</p>
            <p className="text-sm mt-1">Data tamu akan muncul di sini setelah ditambahkan.</p>
          </div>
        ) : (
          <>
            {/* View Desktop: Tabel */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm text-zinc-300">
                <thead className="bg-zinc-950/50 text-xs uppercase font-semibold text-zinc-400 border-b border-zinc-800">
                  <tr>
                    <th className="px-6 py-4">Nama Tamu</th>
                    <th className="px-6 py-4">Nomor HP</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {filteredGuests.map((guest) => (
                    <tr key={guest.id} className="hover:bg-zinc-800/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-zinc-100 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-primary font-bold">
                          {guest.name.charAt(0).toUpperCase()}
                        </div>
                        {guest.name}
                      </td>
                      <td className="px-6 py-4">
                        <span className="flex items-center gap-2"><Phone className="h-3 w-3 text-zinc-500"/> {guest.phone}</span>
                      </td>
                      <td className="px-6 py-4">
                        {guest.is_returning ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                            <Star className="h-3 w-3 fill-primary" /> Pelanggan Setia
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-zinc-800 text-zinc-300 border border-zinc-700">
                            <User className="h-3 w-3" /> Tamu Baru
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => handleEditClick(guest)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors text-xs font-medium border border-zinc-700"
                        >
                          <Edit className="h-3.5 w-3.5" /> Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* View Mobile: Card List */}
            <div className="md:hidden divide-y divide-zinc-800">
              {filteredGuests.map((guest) => (
                <div key={guest.id} className="p-4 flex flex-col gap-3 relative">
                  <div className="flex justify-between items-start pr-10">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-primary font-bold text-lg">
                        {guest.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-zinc-100">{guest.name}</p>
                        <p className="text-xs text-zinc-400 flex items-center gap-1 mt-0.5">
                          <Phone className="h-3 w-3"/> {guest.phone}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div>
                    {guest.is_returning ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-primary/10 text-primary border border-primary/20">
                        <Star className="h-3 w-3 fill-primary" /> Pelanggan Setia
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-zinc-800 text-zinc-300 border border-zinc-700">
                        Tamu Baru
                      </span>
                    )}
                  </div>
                  <button 
                    onClick={() => handleEditClick(guest)}
                    className="absolute top-4 right-4 p-2 bg-zinc-800 text-zinc-400 hover:text-zinc-100 rounded-lg border border-zinc-700"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* MODAL FORM */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl shadow-2xl relative my-8">
            
            <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 p-5 rounded-t-2xl flex justify-between items-center z-10">
              <div>
                <h3 className="text-lg font-bold text-zinc-100">
                  {editingId ? 'Edit Data Tamu' : 'Registrasi Tamu Baru'}
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  {editingId ? 'Perbarui informasi profil tamu' : 'Data form ini akan diteruskan ke sistem pesanan'}
                </p>
              </div>
              <button 
                onClick={() => { setIsModalOpen(false); resetForm(); }}
                className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-xl transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              
              {!editingId && (
                <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setFormType('restoran')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${formType === 'restoran' ? 'bg-primary text-zinc-950 shadow-md' : 'text-zinc-400 hover:text-zinc-200'}`}
                  >
                    <Utensils className="h-4 w-4" /> Tamu Restoran
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormType('penginapan')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${formType === 'penginapan' ? 'bg-blue-600 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-200'}`}
                  >
                    <BedDouble className="h-4 w-4" /> Tamu Penginapan
                  </button>
                </div>
              )}

              <form id="guestForm" onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider border-b border-zinc-800 pb-2">Informasi Tamu</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs text-zinc-400">Nama Lengkap</label>
                      <input type="text" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:border-primary focus:outline-none" placeholder="Masukkan nama..." />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-zinc-400">Nomor Handphone (WhatsApp)</label>
                      <input type="tel" required value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:border-primary focus:outline-none" placeholder="08..." />
                    </div>
                  </div>

                  {editingId && (
                    <div className="pt-2">
                      <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl border border-zinc-800 bg-zinc-950/50 hover:bg-zinc-800 transition-colors">
                        <div className="relative flex items-center">
                          <input 
                            type="checkbox" 
                            className="sr-only"
                            checked={formData.is_returning}
                            onChange={(e) => setFormData({...formData, is_returning: e.target.checked})}
                          />
                          <div className={`w-10 h-6 rounded-full transition-colors ${formData.is_returning ? 'bg-primary' : 'bg-zinc-700'}`}></div>
                          <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.is_returning ? 'translate-x-4' : 'translate-x-0'}`}></div>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-zinc-200">Tandai sebagai Pelanggan Setia</p>
                          <p className="text-xs text-zinc-500">Berikan lencana emas pada tamu ini.</p>
                        </div>
                      </label>
                    </div>
                  )}
                </div>

                {!editingId && formType === 'restoran' && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <h4 className="text-sm font-semibold text-primary uppercase tracking-wider border-b border-zinc-800 pb-2">Detail Reservasi Restoran</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs text-zinc-400">Tanggal Kunjungan</label>
                        <input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:border-primary focus:outline-none [color-scheme:dark]" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs text-zinc-400">Jumlah Orang (Pax)</label>
                        <div className="grid grid-cols-3 gap-2">
                          <input type="number" placeholder="Dewasa" value={formData.adults} onChange={(e) => setFormData({...formData, adults: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2 py-2.5 text-xs text-center text-zinc-100 focus:border-primary focus:outline-none" />
                          <input type="number" placeholder="Remaja" value={formData.teens} onChange={(e) => setFormData({...formData, teens: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2 py-2.5 text-xs text-center text-zinc-100 focus:border-primary focus:outline-none" />
                          <input type="number" placeholder="Anak" value={formData.children} onChange={(e) => setFormData({...formData, children: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2 py-2.5 text-xs text-center text-zinc-100 focus:border-primary focus:outline-none" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {!editingId && formType === 'penginapan' && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <h4 className="text-sm font-semibold text-blue-500 uppercase tracking-wider border-b border-zinc-800 pb-2">Detail Menginap</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs text-zinc-400">Check-in</label>
                        <input type="date" value={formData.checkIn} onChange={(e) => setFormData({...formData, checkIn: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none [color-scheme:dark]" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs text-zinc-400">Check-out</label>
                        <input type="date" value={formData.checkOut} onChange={(e) => setFormData({...formData, checkOut: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none [color-scheme:dark]" />
                      </div>
                    </div>
                  </div>
                )}
              </form>
            </div>

            <div className="sticky bottom-0 bg-zinc-900 border-t border-zinc-800 p-5 rounded-b-2xl flex justify-end gap-3 z-10">
              <button 
                type="button" 
                onClick={() => { setIsModalOpen(false); resetForm(); }}
                className="px-5 py-2.5 text-sm font-medium text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button 
                type="submit"
                form="guestForm"
                disabled={submitLoading}
                className={`px-5 py-2.5 text-sm font-semibold rounded-xl transition-colors flex items-center gap-2 shadow-lg ${
                  (!editingId && formType === 'penginapan')
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-900/20' 
                    : 'bg-primary hover:bg-amber-600 text-zinc-950 shadow-amber-900/20'
                } disabled:opacity-50`}
              >
                {submitLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {submitLoading ? 'Menyimpan...' : (editingId ? 'Update Data' : 'Simpan Data')}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}