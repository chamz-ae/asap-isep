import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getNavigation } from '../config/navigation';

export default function MobileNav() {
  const { profile } = useAuth();
  const navItems = getNavigation(profile?.role);

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 z-50 px-2 py-1.5 flex justify-around items-center">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center w-full p-2 space-y-1 rounded-lg transition-all ${
                isActive ? 'text-primary' : 'text-zinc-500 hover:text-zinc-300'
              }`
            }
          >
            {/* FIX: Membungkus children dengan function agar bisa membaca isActive */}
            {({ isActive }) => (
              <>
                <div className={`${isActive ? 'bg-primary/10 p-1.5 rounded-lg' : 'p-1.5'}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-medium truncate">{item.name}</span>
              </>
            )}
          </NavLink>
        );
      })}
    </div>
  );
}