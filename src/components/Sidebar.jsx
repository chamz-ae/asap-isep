import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getNavigation } from '../config/navigation';

export default function Sidebar() {
  const { profile } = useAuth();
  const navItems = getNavigation(profile?.role);

  return (
    <aside className="hidden md:flex flex-col w-64 bg-zinc-900 border-r border-zinc-800 h-full">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-primary tracking-tight">ASAP ISEP</h1>
        <p className="text-xs text-zinc-400 mt-1 uppercase tracking-widest font-semibold">Management & POS</p>
      </div>
      
      <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${
                  isActive
                    ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}