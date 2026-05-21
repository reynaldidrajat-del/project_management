import { useState } from 'react';
import { Link } from 'react-router-dom';

import FormField from '../components/shared/FormField';
import Modal from '../components/shared/Modal';
import { useDepartments } from '../logic/hooks/useDepartments';
import { getApiErrorMessage } from '../logic/services/api';
import { createDepartment, deleteDepartment, updateDepartment } from '../logic/services/departmentApi';
import { useUiStore } from '../store/uiStore';

// Halaman settings untuk mengelola master data department.
function SettingsPage() {
  const { departments, loading, refetch } = useDepartments();
  const [name, setName] = useState('');
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [errors, setErrors] = useState({});
  const showToast = useUiStore((state) => state.showToast);

  // Membuka modal kosong untuk membuat department baru.
  const openCreateModal = () => {
    setEditingDepartment(null);
    setName('');
    setErrors({});
    setModalOpen(true);
  };

  // Membuka modal dengan data department yang akan diedit.
  const openEditModal = (department) => {
    setEditingDepartment(department);
    setName(department.name || '');
    setErrors({});
    setModalOpen(true);
  };

  // Menutup modal dan membersihkan state form.
  const closeModal = () => {
    setEditingDepartment(null);
    setName('');
    setErrors({});
    setModalOpen(false);
  };

  // Menyimpan department baru atau perubahan nama department.
  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!name.trim()) {
      setErrors({ name: 'Masukkan nama department.' });
      return;
    }

    try {
      if (editingDepartment) {
        await updateDepartment(editingDepartment.id, { name: name.trim() });
        showToast({ type: 'success', message: 'Department diperbarui.' });
      } else {
        await createDepartment({ name: name.trim() });
        showToast({ type: 'success', message: 'Department dibuat.' });
      }

      closeModal();
      refetch();
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    }
  };

  // Menghapus department setelah konfirmasi.
  const handleDelete = async (departmentId) => {
    if (!window.confirm('Hapus department ini? User terkait akan diset null sesuai schema.')) {
      return;
    }

    try {
      await deleteDepartment(departmentId);
      showToast({ type: 'success', message: 'Department dihapus.' });
      refetch();
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    }
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="page-kicker">Administration</p>
          <h1 className="page-title">Settings</h1>
          <p className="page-description">Master data sederhana untuk MVP: department, lokasi bisnis unit, user/PIC, dan bucket per project.</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="card p-4">
          <div className="section-header">
            <div>
              <h2 className="section-title">Department Master</h2>
              <p className="section-subtitle">Department dipakai untuk Team dan Department Gantt.</p>
            </div>
            <button className="btn-primary" type="button" onClick={openCreateModal}>
              Tambah Department
            </button>
          </div>

          {loading ? <p className="text-sm text-text-muted">Loading departments...</p> : null}
          <div className="space-y-2">
            {departments.map((department) => (
              <div key={department.id} className="info-tile flex items-center justify-between gap-3 bg-white">
                <span className="font-semibold">{department.name}</span>
                <div className="action-row">
                  <button
                    className="btn-secondary py-1"
                    type="button"
                    onClick={() => openEditModal(department)}
                  >
                    Edit
                  </button>
                  <button className="btn-secondary py-1 text-danger" type="button" onClick={() => handleDelete(department.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
          {!loading && !departments.length ? <p className="text-sm text-text-muted">Belum ada department.</p> : null}
        </div>

        <div className="space-y-4">
          <div className="card p-4">
            <h2 className="section-title">User / PIC</h2>
            <p className="mt-1 text-sm text-text-muted">Kelola PIC dan owner project di halaman Team.</p>
            <Link className="btn-primary mt-3 inline-block" to="/team">
              Open Team
            </Link>
          </div>
          <div className="card p-4">
            <h2 className="section-title">Lokasi</h2>
            <p className="mt-1 text-sm text-text-muted">Kelola bisnis unit user untuk filter project, task, dan Department Gantt.</p>
            <Link className="btn-primary mt-3 inline-block" to="/locations">
              Open Lokasi
            </Link>
          </div>
          <div className="card p-4">
            <h2 className="section-title">Buckets</h2>
            <p className="mt-1 text-sm text-text-muted">
              Bucket dibuat per project melalui API `/api/buckets` dan dipakai Board View untuk grouping kategori pekerjaan.
            </p>
          </div>
          <div className="card p-4">
            <h2 className="section-title">Import Excel</h2>
            <p className="mt-1 text-sm text-text-muted">
              Belum dibuat pada MVP, tetapi schema task, bucket, parent_task_id, dan calendar sudah siap untuk mapping import berikutnya.
            </p>
          </div>
        </div>
      </div>

      <Modal
        description="Department dipakai sebagai master data user. Department Gantt membaca department dari user/PIC yang terlibat di task dan project."
        footer={
          <>
            <button className="btn-secondary" type="button" onClick={closeModal}>
              Cancel
            </button>
            <button className="btn-primary" form="department-form" type="submit">
              {editingDepartment ? 'Save Changes' : 'Create Department'}
            </button>
          </>
        }
        open={modalOpen}
        size="sm"
        title={editingDepartment ? 'Edit Department' : 'Tambah Department'}
        onClose={closeModal}
      >
        <form id="department-form" noValidate onSubmit={handleSubmit}>
          <FormField error={errors.name} htmlFor="department-name" label="Department Name" required>
            <input
              className={`field mt-1 ${errors.name ? 'field-error' : ''}`}
              id="department-name"
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

export default SettingsPage;
