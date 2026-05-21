import { formatDate } from '../../logic/helpers/dateHelper';

// Tabel untuk menampilkan daftar tanggal libur dan hari kerja khusus.
function CalendarExceptionTable({ exceptions = [], onEdit, onDelete }) {
  if (!exceptions.length) {
    return <div className="empty-state">Belum ada calendar exception.</div>;
  }

  return (
    <div className="table-shell">
      <div className="table-scroll">
        <table className="data-table min-w-[720px]">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Type</th>
              <th>Nama</th>
              <th>Deskripsi</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {exceptions.map((exception) => (
              <tr key={exception.id}>
                <td className="font-semibold">{formatDate(exception.exception_date)}</td>
                <td>
                  <span className={exception.type === 'holiday' ? 'badge bg-red-100 text-red-700' : 'badge bg-green-100 text-green-700'}>
                    {exception.type}
                  </span>
                </td>
                <td>{exception.name}</td>
                <td className="text-text-muted">{exception.description || '-'}</td>
                <td>
                  <div className="action-row">
                    <button className="btn-secondary py-1" type="button" onClick={() => onEdit(exception)}>
                      Edit
                    </button>
                    <button className="btn-secondary py-1 text-danger" type="button" onClick={() => onDelete(exception.id)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default CalendarExceptionTable;
