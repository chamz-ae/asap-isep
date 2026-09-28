import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { User, Camera, Save, Loader2, Shield, Mail } from 'lucide-react';

export default function Pengaturan() {
  const { user, profile, fetchProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [localPreview, setLocalPreview] = useState(null); // Preview instan dari galeri
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setAvatarUrl(profile.avatar_url || '');
    }
  }, [profile]);

  // Handler Upload Foto dari Galeri / Perangkat ke Supabase Storage
  const handleFileUpload = async (event) => {
    try {
      setUploading(true);
      if (!event.target.files || event.target.files.length === 0) return;
      const file = event.target.files[0];

      // 1. Tampilkan preview lokal seketika di UI
      setLocalPreview(URL.createObjectURL(file));

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      // 2. Upload ke Supabase Storage bucket 'avatars'
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        throw new Error(`Upload gagal: ${uploadError.message}. Pastikan bucket 'avatars' sudah dibuat & diset Public di Supabase Storage.`);
      }

      // 3. Ambil Public URL
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      setAvatarUrl(data.publicUrl);
      alert('Foto dari galeri berhasil diunggah! Klik "Simpan Perubahan" di bawah.');
    } catch (error) {
      alert(error.message);
      setLocalPreview(null);
    } finally {
      setUploading(false);
    }
  };

  // Simpan Perubahan Profil ke Database
  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          avatar_url: avatarUrl
        })
        .eq('id', user.id);

      if (error) throw error;

      if (fetchProfile) await fetchProfile();
      alert('Profil berhasil diperbarui! Top bar akan otomatis menampilkan foto baru.');
    } catch (error) {
      alert('Gagal memperbarui profil ke database: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-zinc-100 tracking-tight">Pengaturan Profil Admin</h2>
        <p className="text-sm text-zinc-400 mt-1">Ubah nama lengkap dan foto profil akun Anda.</p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-sm">
        <form onSubmit={handleSave} className="space-y-6">
          
          {/* Avatar & Upload Section */}
          <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-zinc-800">
            <div className="relative group">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-zinc-950 border-2 border-zinc-700 flex items-center justify-center">
                {(localPreview || avatarUrl) ? (
                  <img src={localPreview || avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="h-10 w-10 text-zinc-600" />
                )}
              </div>
              <label className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white text-xs font-medium">
                <Camera className="h-5 w-5 mb-1" />
                <span>Ganti Foto</span>
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>

            <div className="space-y-1 text-center sm:text-left">
              <h3 className="font-bold text-zinc-100 text-base">{fullName || 'Administrator'}</h3>
              <p className="text-xs text-zinc-400 flex items-center justify-center sm:justify-start gap-1">
                <Shield className="h-3.5 w-3.5 text-primary" /> Role: <span className="uppercase font-semibold text-zinc-200">{profile?.role || 'Admin'}</span>
              </p>
              <p className="text-xs text-zinc-500">Klik lingkaran foto untuk memilih gambar dari galeri perangkat Anda.</p>
              {uploading && <p className="text-xs text-primary animate-pulse font-medium">Sedang mengunggah foto ke storage...</p>}
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400 font-medium">Email Akun (Read-only)</label>
              <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-400 cursor-not-allowed">
                <Mail className="h-4 w-4 text-zinc-600" />
                <span>{user?.email || '-'}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400 font-medium">Nama Lengkap / Admin</label>
              <input 
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Masukkan nama Anda..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-800 flex justify-end">
            <button
              type="submit"
              disabled={saving || uploading}
              className="flex items-center gap-2 bg-primary hover:bg-amber-600 text-zinc-950 font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors shadow-lg shadow-amber-900/20 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              <Save className="h-4 w-4" />
              <span>Simpan Perubahan</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}