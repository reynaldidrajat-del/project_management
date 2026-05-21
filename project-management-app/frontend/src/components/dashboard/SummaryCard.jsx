// Kartu angka ringkasan dashboard seperti total project atau task overdue.
function SummaryCard({ label, value, tone = 'blue', helper }) {
  const toneClass = {
    blue: 'bg-blue-50 text-primary',
    green: 'bg-green-50 text-success',
    amber: 'bg-amber-50 text-warning',
    red: 'bg-red-50 text-danger',
    slate: 'bg-slate-100 text-slate-700',
  }[tone];

  return (
    <div className="metric-card">
      <div className={`mb-3 inline-flex rounded-lg px-3 py-1.5 text-xs font-bold ${toneClass}`}>{label}</div>
      <div className="text-3xl font-bold tracking-tight text-text-dark">{value ?? 0}</div>
      {helper ? <p className="mt-1 text-sm text-text-muted">{helper}</p> : null}
    </div>
  );
}

export default SummaryCard;
