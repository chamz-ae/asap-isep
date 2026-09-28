import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Tamu from './pages/Tamu';
import Menu from './pages/Menu';
import PesananResto from './pages/PesananResto';
import PesananInap from './pages/PesananInap';
import History from './pages/History';
import Belanja from './pages/Belanja';
import StockOpname from './pages/StockOpname';
import Laporan from './pages/Laporan';
import Pengaturan from './pages/Pengaturan';

const ComingSoon = ({ title }) => (
  <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center space-y-4">
    <div className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center mb-4">
      <span className="text-2xl">🚧</span>
    </div>
    <h2 className="text-2xl font-bold text-zinc-100">{title}</h2>
    <p className="text-zinc-500 max-w-sm">
      Halaman ini sedang dalam tahap pengembangan dan akan dibangun pada step berikutnya.
    </p>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<MainLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="tamu" element={<Tamu />} />
              <Route path="menu" element={<Menu />} />
              
              {/* Menangani rute lama maupun rute baru */}
              <Route path="pesanan" element={<PesananResto />} />
              <Route path="pesanan-resto" element={<PesananResto />} />
              <Route path="pesanan-inap" element={<PesananInap />} />
              <Route path="riwayat" element={<History />} />
              <Route path="belanja" element={<Belanja />} />
              <Route path="stock" element={<StockOpname />} />
              <Route path="laporan" element={<Laporan />} />
              <Route path="pengaturan" element={<Pengaturan />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;