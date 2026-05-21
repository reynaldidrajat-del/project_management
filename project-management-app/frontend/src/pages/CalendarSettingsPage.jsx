import { useState } from 'react';

import CalendarExceptionForm from '../components/calendar/CalendarExceptionForm';
import CalendarExceptionTable from '../components/calendar/CalendarExceptionTable';
import { useCalendar } from '../logic/hooks/useCalendar';
import { getApiErrorMessage } from '../logic/services/api';
import {
  createCalendarException,
  deleteCalendarException,
  importIndonesiaHolidays2026,
  updateCalendarException,
} from '../logic/services/calendarApi';
import { useUiStore } from '../store/uiStore';

// Halaman pengaturan kalender untuk mengelola libur dan hari kerja khusus.
function CalendarSettingsPage() {
  const [editingException, setEditingException] = useState(null);
  const [importingIndonesiaHolidays, setImportingIndonesiaHolidays] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const { exceptions, loading, error, refetch } = useCalendar();
  const showToast = useUiStore((state) => state.showToast);

  // Menyimpan pengecualian kalender baru atau hasil edit.
  const handleSubmit = async (payload) => {
    try {
      if (editingException) {
        await updateCalendarException(editingException.id, payload);
        showToast({ type: 'success', message: 'Calendar exception diperbarui.' });
      } else {
        await createCalendarException(payload);
        showToast({ type: 'success', message: 'Calendar exception dibuat.' });
      }

      setEditingException(null);
      setModalOpen(false);
      refetch();
    } catch (err) {
      showToast({ type: 'error', message: getApiErrorMessage(err) });
    }
  };

  // Menghapus pengecualian kalender setelah user mengonfirmasi.
  const handleDelete = async (exceptionId) => {
    if (!window.confirm('Hapus calendar exception ini? Work days task akan dihitung ulang.')) {
      return;
    }

    try {
      await deleteCalendarException(exceptionId);
      showToast({ type: 'success', message: 'Calendar exception dihapus.' });
      refetch();
    } catch (err) {
      showToast({ type: 'error', message: getApiErrorMessage(err) });
    }
  };

  // Mengimport daftar libur nasional Indonesia 2026 dari backend.
  const handleImportIndonesiaHolidays = async () => {
    setImportingIndonesiaHolidays(true);

    try {
      const result = await importIndonesiaHolidays2026();
      showToast({ type: 'success', message: `${result.total} libur nasional Indonesia 2026 diimport.` });
      refetch();
    } catch (err) {
      showToast({ type: 'error', message: getApiErrorMessage(err) });
    } finally {
      setImportingIndonesiaHolidays(false);
    }
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="page-kicker">Calendar Rules</p>
          <h1 className="page-title">Working Calendar</h1>
          <p className="page-description">
            Default hari kerja adalah Senin-Jumat. Holiday menghapus hari kerja, working_day menambahkan hari kerja manual seperti Sabtu pengganti.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" disabled={importingIndonesiaHolidays} type="button" onClick={handleImportIndonesiaHolidays}>
            {importingIndonesiaHolidays ? 'Importing...' : 'Import Libur Indonesia 2026'}
          </button>
          <button
            className="btn-primary"
            type="button"
            onClick={() => {
              setEditingException(null);
              setModalOpen(true);
            }}
          >
            Tambah Exception
          </button>
        </div>
      </div>

      <div className="card grid gap-3 p-4 md:grid-cols-4">
        <div className="info-tile bg-blue-50">
          <p className="font-bold text-primary-dark">Default Working Days</p>
          <p className="text-sm text-text-muted">Monday to Friday</p>
        </div>
        <div className="info-tile bg-red-50">
          <p className="font-bold text-danger">Holiday</p>
          <p className="text-sm text-text-muted">Tanggal tidak dihitung work days.</p>
        </div>
        <div className="info-tile bg-green-50">
          <p className="font-bold text-success">Working Day</p>
          <p className="text-sm text-text-muted">Tanggal dihitung work days walaupun weekend.</p>
        </div>
        <div className="info-tile bg-slate-50">
          <p className="font-bold text-text-dark">Indonesia 2026</p>
          <p className="text-sm text-text-muted">Import 17 libur nasional agar tidak dihitung sebagai work days.</p>
        </div>
      </div>

      <CalendarExceptionForm
        open={modalOpen}
        exception={editingException}
        onClose={() => {
          setEditingException(null);
          setModalOpen(false);
        }}
        onSubmit={handleSubmit}
      />

      {loading ? <div className="card p-6 text-text-muted">Loading calendar exceptions...</div> : null}
      {error ? <div className="card p-6 text-danger">{error}</div> : null}
      <CalendarExceptionTable
        exceptions={exceptions}
        onDelete={handleDelete}
        onEdit={(exception) => {
          setEditingException(exception);
          setModalOpen(true);
        }}
      />
    </div>
  );
}

export default CalendarSettingsPage;
