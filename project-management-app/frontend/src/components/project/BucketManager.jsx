import { useState } from 'react';

import { getApiErrorMessage } from '../../logic/services/api';
import { createBucket, deleteBucket, updateBucket } from '../../logic/services/projectApi';
import { useUiStore } from '../../store/uiStore';
import FormField from '../shared/FormField';
import Modal from '../shared/Modal';

// Panel untuk membuat, mengedit, dan menghapus bucket dalam satu project.
function BucketManager({ projectId, buckets = [], onChanged }) {
  const [name, setName] = useState('');
  const [editingBucket, setEditingBucket] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [errors, setErrors] = useState({});
  const showToast = useUiStore((state) => state.showToast);

  // Membuka modal kosong untuk membuat bucket baru.
  const openCreateModal = () => {
    setEditingBucket(null);
    setName('');
    setErrors({});
    setModalOpen(true);
  };

  // Membuka modal dengan data bucket yang akan diedit.
  const openEditModal = (bucket) => {
    setEditingBucket(bucket);
    setName(bucket.name || '');
    setErrors({});
    setModalOpen(true);
  };

  // Menutup modal bucket dan membersihkan state form.
  const closeModal = () => {
    setModalOpen(false);
    setEditingBucket(null);
    setName('');
    setErrors({});
  };

  // Menyimpan bucket baru atau perubahan bucket.
  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!name.trim()) {
      setErrors({ name: 'Masukkan nama bucket.' });
      return;
    }

    try {
      if (editingBucket) {
        await updateBucket(editingBucket.id, {
          name: name.trim(),
          sort_order: editingBucket.sort_order || 0,
        });
        showToast({ type: 'success', message: 'Bucket diperbarui.' });
      } else {
        await createBucket({
          project_id: projectId,
          name: name.trim(),
          sort_order: buckets.length + 1,
        });
        showToast({ type: 'success', message: 'Bucket dibuat.' });
      }

      closeModal();
      onChanged?.();
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    }
  };

  // Menghapus bucket setelah user mengonfirmasi.
  const handleDelete = async (bucketId) => {
    if (!window.confirm('Hapus bucket ini? Task di bucket tersebut akan menjadi No Bucket.')) {
      return;
    }

    try {
      await deleteBucket(bucketId);
      showToast({ type: 'success', message: 'Bucket dihapus.' });
      onChanged?.();
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    }
  };

  return (
    <div className="card p-4">
      <div className="section-header">
        <div>
          <h2 className="section-title">Project Buckets</h2>
          <p className="section-subtitle">Bucket menjadi kolom saat Board memakai Group by Bucket.</p>
        </div>
        <button className="btn-primary" type="button" onClick={openCreateModal}>
          Tambah Bucket
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {buckets.map((bucket) => (
          <span key={bucket.id} className="inline-flex items-center gap-2 rounded-lg border border-border bg-slate-50 px-3 py-2 text-sm font-semibold">
            {bucket.name}
            <button className="text-primary" type="button" onClick={() => openEditModal(bucket)}>
              Edit
            </button>
            <button className="text-danger" type="button" onClick={() => handleDelete(bucket.id)}>
              Delete
            </button>
          </span>
        ))}
        {!buckets.length ? <p className="text-sm text-text-muted">Belum ada bucket untuk project ini.</p> : null}
      </div>

      <Modal
        description="Bucket dipakai sebagai kategori kerja dan kolom Board saat mode Group by Bucket aktif."
        footer={
          <>
            <button className="btn-secondary" type="button" onClick={closeModal}>
              Cancel
            </button>
            <button className="btn-primary" form="bucket-form" type="submit">
              {editingBucket ? 'Save Changes' : 'Create Bucket'}
            </button>
          </>
        }
        open={modalOpen}
        size="sm"
        title={editingBucket ? 'Edit Bucket' : 'Tambah Bucket'}
        onClose={closeModal}
      >
        <form id="bucket-form" noValidate onSubmit={handleSubmit}>
          <FormField error={errors.name} htmlFor="bucket-name" label="Bucket Name" required>
            <input
              className={`field mt-1 ${errors.name ? 'field-error' : ''}`}
              id="bucket-name"
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

export default BucketManager;
