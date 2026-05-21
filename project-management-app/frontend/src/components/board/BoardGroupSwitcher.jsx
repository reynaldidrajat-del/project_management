// Tombol pilihan untuk mengubah cara board dikelompokkan: status atau bucket.
function BoardGroupSwitcher({ value, onChange }) {
  return (
    <div className="segmented-control">
      {[
        { value: 'status', label: 'Group by Status' },
        { value: 'bucket', label: 'Group by Bucket' },
      ].map((option) => (
        <button
          key={option.value}
          type="button"
          className={[
            'segmented-control-button',
            value === option.value ? 'bg-primary text-white' : 'text-text-muted hover:bg-slate-100',
          ].join(' ')}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default BoardGroupSwitcher;
