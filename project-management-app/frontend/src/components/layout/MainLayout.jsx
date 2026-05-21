import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useUiStore } from '../../store/uiStore';

// Layout utama yang menampilkan sidebar, topbar, dan isi halaman.
function MainLayout({ children }) {
  const toast = useUiStore((state) => state.toast);
  const isSidebarHidden = useUiStore((state) => state.isSidebarHidden);

  return (
    <div className="flex min-h-screen bg-workspace text-text-dark">
      {isSidebarHidden ? null : <Sidebar />}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 px-4 py-5 lg:px-6">
          <div className={isSidebarHidden ? 'mx-auto w-full max-w-none' : 'mx-auto max-w-[1600px]'}>{children}</div>
        </main>
      </div>

      {toast ? (
        <div
          className={[
            'fixed bottom-5 right-5 z-50 rounded-xl px-4 py-3 text-sm font-semibold shadow-soft',
            toast.type === 'error' ? 'bg-danger text-white' : 'bg-success text-white',
          ].join(' ')}
        >
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}

export default MainLayout;
