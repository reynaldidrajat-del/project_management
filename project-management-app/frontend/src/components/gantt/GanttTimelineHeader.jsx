// Header timeline Gantt yang menampilkan label minggu atau bulan.
function GanttTimelineHeader({ height = 64, units = [], unitWidth = 112 }) {
  return (
    <div className="sticky top-0 z-10 flex border-b border-border bg-white" style={{ height }}>
      {units.map((unit) => (
        <div
          key={unit.date.toISOString()}
          className="flex shrink-0 flex-col items-center justify-center border-r border-border px-2 text-center text-[11px] font-bold uppercase leading-tight tracking-wide text-text-muted"
          style={{ width: unitWidth }}
        >
          <span className="whitespace-nowrap">{unit.label}</span>
          {unit.subLabel ? <span className="mt-0.5 whitespace-nowrap">{unit.subLabel}</span> : null}
        </div>
      ))}
    </div>
  );
}

export default GanttTimelineHeader;
