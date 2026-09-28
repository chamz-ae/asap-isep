import { useAuth } from '../context/AuthContext';
import { LogOut, User as UserIcon, Shield } from 'lucide-react';

export default function Topbar() {
  const { profile, logout } = useAuth();

  return (
    <header className="bg-zinc-900 border-b border-zinc-800 px-4 md:px-6 py-4 flex items-center justify-between shadow-sm z-10">
      {/* Logo hanya muncul di mobile (karena desktop sudah ada di Sidebar) */}
      <div className="md:hidden flex items-center">
         <h1 className="text-lg font-bold text-primary">ASAP ISEP</h1>
      </div>
      
      {/* Title area untuk desktop (opsional, dibiarkan kosong untuk estetika bersih) */}
      <div className="hidden md:flex items-center"></div>

      <div className="flex items-center space-x-3 md:space-x-4 ml-auto">
        {profile && (
          <div className="flex items-center space-x-2 md:space-x-3 bg-zinc-950 px-2 md:px-3 py-1.5 rounded-xl border border-zinc-800">
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold text-xs md:text-sm">
              {profile.full_name ? profile.full_name.charAt(0).toUpperCase() : <UserIcon className="w-4 h-4" />}
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-xs md:text-sm font-medium text-zinc-200">{profile.full_name || 'Staff'}</p>
              <p className="text-[10px] md:text-xs text-primary flex items-center gap-1 uppercase tracking-wider">
                <Shield className="w-3 h-3" /> {profile.role || 'Staff'}
              </p>
            </div>
          </div>
        )}

        <button
          onClick={logout}
          className="flex items-center justify-center bg-zinc-800 hover:bg-red-950 hover:text-red-300 text-zinc-300 p-2 md:px-3 md:py-2 rounded-xl text-sm transition-all border border-zinc-700 hover:border-red-800"
          title="Keluar"
        >
          <LogOut className="w-4 h-4 md:mr-2" />
          <span className="hidden md:inline">Keluar</span>
        </button>
      </div>
    </header>
  );
}