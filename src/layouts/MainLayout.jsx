import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getNavigation } from '../config/navigation';
import { LogOut, Menu, X, User } from 'lucide-react';

export default function MainLayout() {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const role = profile?.role || 'kasir';
  const navigation = getNavigation(role);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      
      {/* Sidebar untuk Desktop & Mobile */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col transition-transform duration-300 md:static md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        {/* Logo / Brand */}
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-primary">ASAP ISEP</h1>
            <p className="text-xs text-zinc-500 mt-0.5">Smokehouse & Lodging POS</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-zinc-400 hover:text-zinc-100">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Menu Navigasi */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1.5">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${isActive ? 'bg-primary text-zinc-950 font-semibold shadow-lg shadow-amber-900/20' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}`}
              >
                <Icon className="h-5 w-5" />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>

        {/* User Info di Sidebar Bawah */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/50 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-950 border border-zinc-700 flex items-center justify-center shrink-0">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <User className="h-5 w-5 text-zinc-500" />
            )}
          </div>
          <div className="overflow-hidden flex-1">
            <p className="text-sm font-bold text-zinc-100 truncate">{profile?.full_name || 'Admin'}</p>
            <p className="text-[10px] uppercase font-semibold text-primary tracking-wider">{profile?.role || 'Staff'}</p>
          </div>
        </div>

      </aside>

      {/* Konten Utama */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Top Bar */}
        <header className="h-16 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-6 shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden text-zinc-400 hover:text-zinc-100">
            <Menu className="h-6 w-6" />
          </button>

          <div className="hidden md:block">
            <span className="text-xs text-zinc-400 font-medium">Sistem Manajemen Terpadu</span>
          </div>

          {/* Profil & Logout di Top Bar */}
          <div className="flex items-center gap-4 ml-auto">
            <div className="flex items-center gap-3 bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded-2xl">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-900 border border-zinc-700 flex items-center justify-center shrink-0">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-bold text-primary">
                    {profile?.full_name?.charAt(0).toUpperCase() || 'A'}
                  </span>
                )}
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-xs font-bold text-zinc-100 leading-tight">{profile?.full_name || 'Admin Utama'}</p>
                <p className="text-[10px] font-semibold text-primary uppercase tracking-wider">{profile?.role || 'OWNER'}</p>
              </div>
            </div>

            <button 
              onClick={handleLogout}
              className="flex items-center gap-1.5 bg-zinc-800 hover:bg-red-950/50 hover:text-red-400 text-zinc-300 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors border border-zinc-700 hover:border-red-900/50"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </header>

        {/* Area Halaman Aktif */}
        <main className="flex-1 overflow-y-auto p-6 bg-zinc-950">
          <Outlet />
        </main>

      </div>
    </div>
  );
}