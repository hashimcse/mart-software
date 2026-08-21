import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Catalog from './pages/Catalog';
import Pos from './pages/Pos';
import Inventory from './pages/Inventory';
import Purchases from './pages/Purchases';
import Customers from './pages/Customers';
import SettingsPage from './pages/Settings';
import ComingSoon from './pages/ComingSoon';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/products" element={<Catalog />} />
              <Route path="/pos" element={<Pos />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/purchases" element={<Purchases />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/reports" element={<ComingSoon title="Reports" />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
