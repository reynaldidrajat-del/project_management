import { Play, Star, Trash2 } from 'lucide-react';

function SavedFiltersPanel({ filters = [], loading = false, onDelete, onFavorite, onRun }) {
  return (
    <aside className="rounded-xl border border-border bg-white shadow-sm">
      <div className="border-b border-border px-4 py-3">
        <h2 className="section-title">Saved Filters</h2>
        <p className="section-subtitle">{filters.length} reusable filters</p>
      </div>
      <div className="max-h-[640px] divide-y divide-border overflow-y-auto">
        {loading ? <p className="p-4 text-sm text-text-muted">Loading filters...</p> : null}
        {!loading && filters.length ? (
          filters.map((filter) => (
            <div key={filter.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-bold text-text-dark">{filter.name}</p>
                  <p className="mt-1 line-clamp-2 font-mono text-xs text-text-muted">{filter.jql_query || filter.jql}</p>
                  {filter.is_shared ? <span className="badge mt-2 bg-blue-100 text-blue-700">Shared</span> : null}
                </div>
                <button className="text-amber-500" type="button" onClick={() => onFavorite?.(filter)}>
                  <Star className={filter.is_favorite ? 'h-4 w-4 fill-current' : 'h-4 w-4'} />
                </button>
              </div>
              <div className="mt-3 flex gap-2">
                <button className="btn-secondary flex-1 py-1" type="button" onClick={() => onRun?.(filter)}>
                  <Play className="h-3.5 w-3.5" />
                  Run
                </button>
                <button className="btn-secondary py-1 text-danger" type="button" onClick={() => onDelete?.(filter)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))
        ) : null}
        {!loading && !filters.length ? <p className="p-4 text-sm text-text-muted">Belum ada saved filter.</p> : null}
      </div>
    </aside>
  );
}

export default SavedFiltersPanel;
