import { LayoutDashboard, Users, UtensilsCrossed, ClipboardList, BarChart3, ShoppingCart, Archive, Settings, BedDouble, History as HistoryIcon } from 'lucide-react';

export const getNavigation = (role) => {
  const allMenus = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ['owner', 'admin', 'kasir', 'resepsionis', 'kitchen'] },
    { name: 'Tamu', path: '/tamu', icon: Users, roles: ['owner', 'admin', 'kasir', 'resepsionis'] },
    { name: 'Menu', path: '/menu', icon: UtensilsCrossed, roles: ['owner', 'admin'] },
    { name: 'Pesanan Resto', path: '/pesanan-resto', icon: ClipboardList, roles: ['owner', 'admin', 'kasir', 'kitchen'] },
    { name: 'Pesanan Inap', path: '/pesanan-inap', icon: BedDouble, roles: ['owner', 'admin', 'kasir', 'resepsionis', 'kitchen'] },
    { name: 'Riwayat & Void', path: '/riwayat', icon: HistoryIcon, roles: ['owner', 'admin', 'kasir', 'resepsionis'] },
    { name: 'Belanja', path: '/belanja', icon: ShoppingCart, roles: ['owner', 'admin', 'kasir', 'resepsionis'] },
    { name: 'Stock', path: '/stock', icon: Archive, roles: ['owner', 'admin', 'kitchen'] },
    { name: 'Laporan', path: '/laporan', icon: BarChart3, roles: ['owner', 'admin'] },
    { name: 'Pengaturan', path: '/pengaturan', icon: Settings, roles: ['owner', 'admin'] },
  ];

  return allMenus.filter(menu => menu.roles.includes(role || 'kasir'));
};