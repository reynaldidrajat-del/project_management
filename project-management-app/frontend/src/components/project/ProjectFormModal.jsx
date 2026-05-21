import { useEffect, useState } from 'react';

import { PROJECT_STATUSES } from '../../logic/constants/status';
import { toDateInputValue } from '../../logic/helpers/dateHelper';
import FormField from '../shared/FormField';
import Modal from '../shared/Modal';

// Nilai awal form project sebelum user mengisi data.
const initialForm = {
  name: '',
  description: '',
  owner_id: '',
  member_ids: [],
  start_date: '',
  end_date: '',
  status: 'Planning',
};

// Modal form untuk membuat atau mengubah project dan membernya.
function ProjectFormModal({ open, project, users = [], onClose, onSubmit }) {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setErrors({});

    if (!project) {
      setForm(initialForm);
      return;
    }

    setForm({
      name: project.name || '',
      description: project.description || '',
      owner_id: project.owner_id || '',
      member_ids: (project.members || []).map((member) => String(member.id)),
      start_date: toDateInputValue(project.start_date),
      end_date: toDateInputValue(project.end_date),
      status: project.status || 'Planning',
    });
  }, [project, open]);

  if (!open) {
    return null;
  }

  // Menghapus pesan error untuk satu field setelah user memperbaikinya.
  const clearFieldError = (field) => {
    setErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors[field];
      return nextErrors;
    });
  };

  // Mengubah satu field form project.
  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    clearFieldError(field === 'start_date' ? 'end_date' : field);
  };

  // Mengubah owner project dan memastikan owner juga masuk daftar member.
  const updateOwner = (ownerId) => {
    setForm((current) => ({
      ...current,
      owner_id: ownerId,
      member_ids: ownerId ? Array.from(new Set([...current.member_ids, ownerId])) : current.member_ids,
    }));
  };

  // Menambah atau menghapus member project dari checkbox.
  const updateMember = (memberId, checked) => {
    setForm((current) => ({
      ...current,
      member_ids: checked
        ? Array.from(new Set([...current.member_ids, memberId]))
        : current.member_ids.filter((id) => String(id) !== String(memberId) || String(id) === String(current.owner_id)),
    }));
  };

  // Memastikan nama project wajib diisi dan tanggal tidak terbalik.
  const validateForm = () => {
    const nextErrors = {};

    if (!form.name.trim()) {
      nextErrors.name = 'Masukkan nama project.';
    }

    if (form.start_date && form.end_date && form.end_date < form.start_date) {
      nextErrors.end_date = 'End date tidak boleh lebih awal dari start date.';
    }

    setErrors(nextErrors);
    return !Object.keys(nextErrors).length;
  };

  // Mengirim payload project yang sudah dirapikan ke halaman parent.
  const handleSubmit = (event) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    onSubmit({
      ...form,
      name: form.name.trim(),
      description: form.description.trim(),
      owner_id: form.owner_id || null,
      member_ids: form.member_ids,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
    });
  };

  return (
    <Modal
      description="Project dapat melibatkan user lintas departemen. Department Gantt memakai user dan task assignment, bukan department tunggal di project."
      footer={
        <>
          <button className="btn-secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" form="project-form" type="submit">
            {project ? 'Save Changes' : 'Create Project'}
          </button>
        </>
      }
      open={open}
      size="lg"
      title={project ? 'Edit Project' : 'Tambah Project'}
      onClose={onClose}
    >
      <form id="project-form" noValidate onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField className="sm:col-span-2" error={errors.name} htmlFor="project-name" label="Name" required>
            <input
              className={`field mt-1 ${errors.name ? 'field-error' : ''}`}
              id="project-name"
              required
              value={form.name}
              onChange={(event) => updateField('name', event.target.value)}
            />
          </FormField>
          <FormField className="sm:col-span-2" htmlFor="project-description" label="Description">
            <textarea
              className="field mt-1 min-h-24"
              id="project-description"
              value={form.description}
              onChange={(event) => updateField('description', event.target.value)}
            />
          </FormField>
          <FormField htmlFor="project-owner" label="Owner">
            <select className="field mt-1" id="project-owner" value={form.owner_id} onChange={(event) => updateOwner(event.target.value)}>
              <option value="">No owner</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} {user.department_name ? `- ${user.department_name}` : ''}
                </option>
              ))}
            </select>
          </FormField>
          <FormField
            className="sm:col-span-2"
            hint="Pilih user lintas departemen yang terlibat. Owner otomatis ikut menjadi member."
            label="Project Members"
          >
            <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-border">
              {users.length ? (
                users.map((user) => {
                  const userId = String(user.id);
                  const checked = form.member_ids.map(String).includes(userId);
                  const isOwner = String(form.owner_id) === userId;

                  return (
                    <label key={user.id} className="flex items-center justify-between gap-3 border-b border-border px-3 py-2 last:border-b-0">
                      <span>
                        <span className="block text-sm font-semibold">{user.name}</span>
                        <span className="text-xs text-text-muted">{user.department_name || 'No department'}</span>
                      </span>
                      <input
                        checked={checked || isOwner}
                        disabled={isOwner}
                        type="checkbox"
                        value={user.id}
                        onChange={(event) => updateMember(userId, event.target.checked)}
                      />
                    </label>
                  );
                })
              ) : (
                <p className="px-3 py-2 text-sm text-text-muted">Belum ada user.</p>
              )}
            </div>
          </FormField>
          <FormField htmlFor="project-start-date" label="Start Date">
            <input
              className="field mt-1"
              id="project-start-date"
              type="date"
              value={form.start_date}
              onChange={(event) => updateField('start_date', event.target.value)}
            />
          </FormField>
          <FormField error={errors.end_date} htmlFor="project-end-date" label="End Date">
            <input
              className={`field mt-1 ${errors.end_date ? 'field-error' : ''}`}
              id="project-end-date"
              type="date"
              value={form.end_date}
              onChange={(event) => updateField('end_date', event.target.value)}
            />
          </FormField>
          <FormField htmlFor="project-status" label="Status">
            <select className="field mt-1" id="project-status" value={form.status} onChange={(event) => updateField('status', event.target.value)}>
              {PROJECT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </FormField>
        </div>
      </form>
    </Modal>
  );
}

export default ProjectFormModal;
