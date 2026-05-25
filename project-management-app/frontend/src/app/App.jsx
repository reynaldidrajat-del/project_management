import { Navigate, useLocation } from 'react-router-dom';

import AppRouter from './router';
import MainLayout from '../components/layout/MainLayout';
import RealtimeBridge from '../components/realtime/RealtimeBridge';
import LoginPage from '../pages/LoginPage';
import { useUiStore } from '../store/uiStore';

// Komponen utama aplikasi: membungkus semua halaman dengan layout yang sama.
function App() {
  const location = useLocation();
  const authToken = useUiStore((state) => state.authToken);
  const currentUser = useUiStore((state) => state.currentUser);

  if (!currentUser || !authToken) {
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
      <RealtimeBridge />
      <AppRouter />
    </MainLayout>
  );
}

export default App;
