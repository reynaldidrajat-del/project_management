import { Navigate, useLocation } from 'react-router-dom';

import AppRouter from './router';
import MainLayout from '../components/layout/MainLayout';
import LoginPage from '../pages/LoginPage';
import { useUiStore } from '../store/uiStore';

// Komponen utama aplikasi: membungkus semua halaman dengan layout yang sama.
function App() {
  const location = useLocation();
  const currentUser = useUiStore((state) => state.currentUser);

  if (!currentUser) {
    if (location.pathname === '/login') {
      return <LoginPage />;
    }

    return <Navigate replace state={{ from: location }} to="/login" />;
  }

  if (location.pathname === '/login') {
    return <Navigate replace to="/" />;
  }

  return (
    <MainLayout>
      <AppRouter />
    </MainLayout>
  );
}

export default App;
