import { useState } from 'react';

import FormField from '../components/shared/FormField';
import Modal from '../components/shared/Modal';
import { USER_ROLES } from '../logic/constants/roles';
import { useDepartments } from '../logic/hooks/useDepartments';
import { useLocations } from '../logic/hooks/useLocations';
import { useUsers } from '../logic/hooks/useUsers';
import { getApiErrorMessage } from '../logic/services/api';
import { createUser, deleteUser, updateUser } from '../logic/services/userApi';
import { useUiStore } from '../store/uiStore';

// Nilai awal form user sebelum user mengisi data.
const initialForm = {
  name: '',
  email: '',
  role: 'admin',
  department_id: '',
  location_id: '',
};

// Halaman Team untuk mengelola user/PIC dan department-nya.
function TeamPage() {
  const [form, setForm] = useState(initialForm);
  const [editingUser, setEditingUser] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [errors, setErrors] = useState({});
  const { users, loading, refetch } = useUsers();
  const { departments } = useDepartments();
  const { locations } = useLocations();
  const showToast = useUiStore((state) => state.showToast);

  // Mengubah satu field form dan menghapus error field tersebut.
  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors[field];
      return nextErrors;
    });
  };

  // Membuka modal kosong untuk membuat user baru.
  const openCreateModal = () => {
    setEditingUser(null);
    setForm(initialForm);
    setErrors({});
    setModalOpen(true);
  };

  // Membuka modal dengan data user yang akan diedit.
  const openEditModal = (user) => {
    setEditingUser(user);
    setForm({
      name: user.name || '',
      email: user.email || '',
      role: user.role || 'admin',
      department_id: user.department_id || '',
      location_id: user.location_id || '',
    });
    setErrors({});
    setModalOpen(true);
  };

  // Menutup modal dan mengembalikan form ke nilai awal.
  const closeModal = () => {
    setEditingUser(null);
    setForm(initialForm);
    setErrors({});
    setModalOpen(false);
  };

  // Memastikan data wajib user sudah diisi sebelum disimpan.
  const validateForm = () => {
    const nextErrors = {};

    if (!form.name.trim()) {
      nextErrors.name = 'Masukkan nama user.';
    }

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      nextErrors.email = 'Masukkan format email yang benar atau kosongkan field ini.';
    }

    setErrors(nextErrors);
    return !Object.keys(nextErrors).length;
  };

  // Menyimpan user baru atau perubahan user yang sedang diedit.
  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role || 'admin',
        department_id: form.department_id || null,
        location_id: form.location_id || null,
      };

      if (editingUser) {
        await updateUser(editingUser.id, payload);
        showToast({ type: 'success', message: 'User diperbarui.' });
      } else {
        await createUser(payload);
        showToast({ type: 'success', message: 'User dibuat.' });
      }

      closeModal();
      refetch();
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    }
  };

  // Menghapus user setelah user mengonfirmasi.
  const handleDelete = async (userId) => {
    if (!window.confirm('Hapus user ini?')) {
      return;
    }

    try {
      await deleteUser(userId);
      showToast({ type: 'success', message: 'User dihapus.' });
      refetch();
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    }
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="page-kicker">People</p>
          <h1 className="page-title">Team</h1>
          <p className="page-description">User dipakai sebagai akun login, PIC, owner project, lead approval, dan member lintas departemen.</p>
        </div>
        <button className="btn-primary" type="button" onClick={openCreateModal}>
          Tambah User
        </button>
      </div>

      <div className="table-shell">
        <div className="table-scroll">
          <table className="data-table min-w-[720px]">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Department</th>
                <th>Lokasi</th>
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="text-text-muted" colSpan="6">
                    Loading users...
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id}>
                    <td className="font-semibold">{user.name}</td>
                    <td>{user.email || '-'}</td>
                    <td>{user.department_name || '-'}</td>
                    <td>{user.location_name || '-'}</td>
                    <td>
                      <span className="badge bg-blue-100 text-blue-700">{user.role || 'admin'}</span>
                    </td>
                    <td>
                      <div className="action-row">
                        <button
                          className="btn-secondary py-1"
                          type="button"
                          onClick={() => openEditModal(user)}
                        >
                          Edit
                        </button>
                        <button className="btn-secondary py-1 text-danger" type="button" onClick={() => handleDelete(user.id)}>
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

      <Modal
        description="User baru otomatis memakai password default modern888 sampai fitur reset password ditambahkan."
        footer={
          <>
            <button className="btn-secondary" type="button" onClick={closeModal}>
              Cancel
            </button>
            <button className="btn-primary" form="user-form" type="submit">
              {editingUser ? 'Save Changes' : 'Create User'}
            </button>
          </>
        }
        open={modalOpen}
        size="md"
        title={editingUser ? 'Edit User' : 'Tambah User'}
        onClose={closeModal}
      >
        <form className="grid gap-4" id="user-form" noValidate onSubmit={handleSubmit}>
          <FormField error={errors.name} htmlFor="user-name" label="Name" required>
            <input
              className={`field mt-1 ${errors.name ? 'field-error' : ''}`}
              id="user-name"
              required
              value={form.name}
              onChange={(event) => updateField('name', event.target.value)}
            />
          </FormField>
          <FormField error={errors.email} htmlFor="user-email" label="Email">
            <input
              className={`field mt-1 ${errors.email ? 'field-error' : ''}`}
              id="user-email"
              type="email"
              value={form.email}
              onChange={(event) => updateField('email', event.target.value)}
            />
          </FormField>
          <FormField htmlFor="user-role" label="Role">
            <select className="field mt-1" id="user-role" value={form.role} onChange={(event) => updateField('role', event.target.value)}>
              {!USER_ROLES.includes(form.role) && form.role ? <option value={form.role}>{form.role}</option> : null}
              {USER_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </FormField>
          <FormField htmlFor="user-department" label="Department">
            <select className="field mt-1" id="user-department" value={form.department_id} onChange={(event) => updateField('department_id', event.target.value)}>
              <option value="">No department</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField htmlFor="user-location" label="Lokasi / Bisnis Unit">
            <select className="field mt-1" id="user-location" value={form.location_id} onChange={(event) => updateField('location_id', event.target.value)}>
              <option value="">No location</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </FormField>
        </form>
      </Modal>
    </div>
  );
}

export default TeamPage;
