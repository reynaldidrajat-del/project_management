import { useState } from 'react';

import FormField from '../components/shared/FormField';
import Modal from '../components/shared/Modal';
import { useLocations } from '../logic/hooks/useLocations';
import { getApiErrorMessage } from '../logic/services/api';
import { createLocation, deleteLocation, updateLocation } from '../logic/services/locationApi';
import { useUiStore } from '../store/uiStore';

// Halaman master lokasi untuk mengelola bisnis unit user.
function LocationsPage() {
  const { locations, loading, refetch } = useLocations();
  const [name, setName] = useState('');
  const [editingLocation, setEditingLocation] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [errors, setErrors] = useState({});
  const showToast = useUiStore((state) => state.showToast);

  const openCreateModal = () => {
    setEditingLocation(null);
    setName('');
    setErrors({});
    setModalOpen(true);
  };

  const openEditModal = (location) => {
    setEditingLocation(location);
    setName(location.name || '');
    setErrors({});
    setModalOpen(true);
  };

  const closeModal = () => {
    setEditingLocation(null);
    setName('');
    setErrors({});
    setModalOpen(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!name.trim()) {
      setErrors({ name: 'Masukkan nama lokasi.' });
      return;
    }

    try {
      if (editingLocation) {
        await updateLocation(editingLocation.id, { name: name.trim() });
        showToast({ type: 'success', message: 'Lokasi diperbarui.' });
      } else {
        await createLocation({ name: name.trim() });
        showToast({ type: 'success', message: 'Lokasi dibuat.' });
      }

      closeModal();
      refetch();
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    }
  };

  const handleDelete = async (locationId) => {
    if (!window.confirm('Hapus lokasi ini? User terkait akan menjadi tanpa lokasi.')) {
      return;
    }

    try {
      await deleteLocation(locationId);
      showToast({ type: 'success', message: 'Lokasi dihapus.' });
      refetch();
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    }
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="page-kicker">Master Data</p>
          <h1 className="page-title">Lokasi</h1>
          <p className="page-description">Lokasi merepresentasikan bisnis unit tempat user bekerja dan menjadi filter Project, Task List, dan Department Gantt.</p>
        </div>
        <button className="btn-primary" type="button" onClick={openCreateModal}>
          Tambah Lokasi
        </button>
      </div>

      <div className="table-shell">
        <div className="table-scroll">
          <table className="data-table min-w-[560px]">
            <thead>
              <tr>
                <th>Nama Lokasi / Bisnis Unit</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="text-text-muted" colSpan="2">
                    Loading lokasi...
                  </td>
                </tr>
              ) : (
                locations.map((location) => (
                  <tr key={location.id}>
                    <td className="font-semibold">{location.name}</td>
                    <td>
                      <div className="action-row">
                        <button className="btn-secondary py-1" type="button" onClick={() => openEditModal(location)}>
                          Edit
                        </button>
                        <button className="btn-secondary py-1 text-danger" type="button" onClick={() => handleDelete(location.id)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && !locations.length ? <div className="empty-state">Belum ada lokasi.</div> : null}

      <Modal
        description="Lokasi dipakai sebagai bisnis unit user dan menjadi filter lintas project/task."
        footer={
          <>
            <button className="btn-secondary" type="button" onClick={closeModal}>
              Cancel
            </button>
            <button className="btn-primary" form="location-form" type="submit">
              {editingLocation ? 'Save Changes' : 'Create Location'}
            </button>
          </>
        }
        open={modalOpen}
        size="sm"
        title={editingLocation ? 'Edit Lokasi' : 'Tambah Lokasi'}
        onClose={closeModal}
      >
        <form id="location-form" noValidate onSubmit={handleSubmit}>
          <FormField error={errors.name} htmlFor="location-name" label="Nama Lokasi" required>
            <input
              className={`field mt-1 ${errors.name ? 'field-error' : ''}`}
              id="location-name"
              required
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setErrors({});
              }}
            />
          </FormField>
        </form>
      </Modal>
    </div>
  );
}

export default LocationsPage;
