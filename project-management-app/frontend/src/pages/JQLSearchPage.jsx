import { Save } from 'lucide-react';
import { useEffect, useState } from 'react';

import IssueExportMenu from '../components/import-export/IssueExportMenu';
import JQLSearchBar from '../components/search/JQLSearchBar';
import SavedFiltersPanel from '../components/search/SavedFiltersPanel';
import FormField from '../components/shared/FormField';
import Modal from '../components/shared/Modal';
import { useVirtualRows } from '../logic/hooks/useVirtualRows';
import { getApiErrorMessage } from '../logic/services/api';
import {
  createSavedFilter,
  deleteSavedFilter,
  favoriteSavedFilter,
  getSavedFilters,
  runSavedFilter,
  searchJql,
} from '../logic/services/jqlApi';
import { useUiStore } from '../store/uiStore';

const initialSaveForm = {
  name: '',
  description: '',
  jql_query: '',
  is_shared: false,
  is_favorite: false,
};

function JQLSearchPage() {
  const [filters, setFilters] = useState([]);
  const [results, setResults] = useState({ issues: [], total: 0, limit: 100, offset: 0 });
  const [currentJql, setCurrentJql] = useState('status != Done ORDER BY priority DESC');
  const [loading, setLoading] = useState(false);
  const [filtersLoading, setFiltersLoading] = useState(true);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveForm, setSaveForm] = useState(initialSaveForm);
  const showToast = useUiStore((state) => state.showToast);

  const fetchFilters = async () => {
    setFiltersLoading(true);

    try {
      setFilters(await getSavedFilters());
    } catch (err) {
      showToast({ type: 'error', message: getApiErrorMessage(err) });
    } finally {
      setFiltersLoading(false);
    }
  };

  useEffect(() => {
    fetchFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSearch = async (jql = currentJql, offset = 0) => {
    setLoading(true);
    setCurrentJql(jql);

    try {
      setResults(await searchJql({ jql, limit: 100, offset }));
    } catch (err) {
      showToast({ type: 'error', message: getApiErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  const openSaveModal = (jql) => {
    setSaveForm({ ...initialSaveForm, jql_query: jql });
    setSaveModalOpen(true);
  };

  const handleSaveFilter = async (event) => {
    event.preventDefault();

    if (!saveForm.name.trim()) {
      showToast({ type: 'error', message: 'Masukkan nama filter.' });
      return;
    }

    try {
      await createSavedFilter({
        ...saveForm,
        name: saveForm.name.trim(),
        description: saveForm.description.trim() || null,
      });
      setSaveModalOpen(false);
      await fetchFilters();
      showToast({ type: 'success', message: 'Filter disimpan.' });
    } catch (err) {
      showToast({ type: 'error', message: getApiErrorMessage(err) });
    }
  };

  const handleRunFilter = async (filter) => {
    setLoading(true);
    setCurrentJql(filter.jql_query);

    try {
      setResults(await runSavedFilter(filter.id, { limit: 100, offset: 0 }));
    } catch (err) {
      showToast({ type: 'error', message: getApiErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFilter = async (filter) => {
    if (!window.confirm(`Delete saved filter "${filter.name}"?`)) {
      return;
    }

    try {
      await deleteSavedFilter(filter.id);
      await fetchFilters();
      showToast({ type: 'success', message: 'Filter dihapus.' });
    } catch (err) {
      showToast({ type: 'error', message: getApiErrorMessage(err) });
    }
  };

  const handleFavoriteFilter = async (filter) => {
    try {
      await favoriteSavedFilter(filter.id, !filter.is_favorite);
      await fetchFilters();
    } catch (err) {
      showToast({ type: 'error', message: getApiErrorMessage(err) });
    }
  };

  const canPrevious = Number(results.offset || 0) > 0;
  const canNext = Number(results.offset || 0) + Number(results.limit || 100) < Number(results.total || 0);
  const loadAllSearchResultsForExport = async () => {
    const exportResult = await searchJql({ jql: currentJql, limit: Math.min(Number(results.total || 1000), 1000), offset: 0 });
    return exportResult.issues || [];
  };
  const resultRows = useVirtualRows(results.issues || [], {
    enabled: (results.issues || []).length > 50,
    estimatedRowHeight: 76,
    overscan: 8,
  });

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="page-kicker">Search</p>
          <h1 className="page-title">Advanced Search</h1>
          <p className="page-description">JQL search, paginated results, favorite filters, dan shared filters.</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <SavedFiltersPanel
          filters={filters}
          loading={filtersLoading}
          onDelete={handleDeleteFilter}
          onFavorite={handleFavoriteFilter}
          onRun={handleRunFilter}
        />

        <div className="space-y-4">
          <JQLSearchBar initialValue={currentJql} loading={loading} onSave={openSaveModal} onSearch={(jql) => runSearch(jql, 0)} />

          <div className="table-shell">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div>
                <h2 className="section-title">Results</h2>
                <p className="section-subtitle">{results.total || 0} issues found</p>
              </div>
              <div className="action-row">
                <IssueExportMenu
                  currentIssues={results.issues || []}
                  disabled={loading || !results.issues?.length}
                  fileNamePrefix="jql-issues"
                  onLoadAllIssues={loadAllSearchResultsForExport}
                />
                <button className="btn-secondary" disabled={!canPrevious || loading} type="button" onClick={() => runSearch(currentJql, Math.max(0, Number(results.offset || 0) - Number(results.limit || 100)))}>
                  Previous
                </button>
                <button className="btn-secondary" disabled={!canNext || loading} type="button" onClick={() => runSearch(currentJql, Number(results.offset || 0) + Number(results.limit || 100))}>
                  Next
                </button>
              </div>
            </div>
            <div
              ref={resultRows.containerRef}
              className="table-scroll"
              style={resultRows.isVirtualized ? { maxHeight: '68vh' } : undefined}
              onScroll={resultRows.onScroll}
            >
              <table className="data-table min-w-[960px]">
                <thead>
                  <tr>
                    <th>Key</th>
                    <th>Summary</th>
                    <th>Project</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Assignee</th>
                    <th>SP</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td className="text-text-muted" colSpan="7">Searching...</td></tr>
                  ) : results.issues?.length ? (
                    <>
                      {resultRows.topPadding ? (
                        <tr aria-hidden="true">
                          <td colSpan="7" style={{ border: 0, height: resultRows.topPadding, padding: 0 }} />
                        </tr>
                      ) : null}
                      {resultRows.virtualRows.map(({ item: issue }) => (
                        <tr key={issue.id}>
                          <td className="font-bold">{issue.issue_key || issue.id}</td>
                          <td>
                            <p className="font-semibold">{issue.title}</p>
                            <p className="text-xs text-text-muted">{issue.issue_type_name || 'Issue'} {issue.epic_name ? `- ${issue.epic_name}` : ''}</p>
                          </td>
                          <td>{issue.project_name}</td>
                          <td><span className="badge bg-slate-100 text-slate-700">{issue.workflow_state_name || issue.status}</span></td>
                          <td>{issue.priority}</td>
                          <td>{issue.assignee_name || '-'}</td>
                          <td className="font-semibold">{issue.story_points || 0}</td>
                        </tr>
                      ))}
                      {resultRows.bottomPadding ? (
                        <tr aria-hidden="true">
                          <td colSpan="7" style={{ border: 0, height: resultRows.bottomPadding, padding: 0 }} />
                        </tr>
                      ) : null}
                    </>
                  ) : (
                    <tr><td className="text-text-muted" colSpan="7">Belum ada hasil.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <Modal
        footer={
          <>
            <button className="btn-secondary" type="button" onClick={() => setSaveModalOpen(false)}>Cancel</button>
            <button className="btn-primary" form="saved-filter-form" type="submit">
              <Save className="h-4 w-4" />
              Save Filter
            </button>
          </>
        }
        open={saveModalOpen}
        title="Save Filter"
        onClose={() => setSaveModalOpen(false)}
      >
        <form id="saved-filter-form" noValidate onSubmit={handleSaveFilter}>
          <div className="grid gap-4">
            <FormField htmlFor="saved-filter-name" label="Name" required>
              <input className="field mt-1" id="saved-filter-name" value={saveForm.name} onChange={(event) => setSaveForm((current) => ({ ...current, name: event.target.value }))} />
            </FormField>
            <FormField htmlFor="saved-filter-description" label="Description">
              <input className="field mt-1" id="saved-filter-description" value={saveForm.description} onChange={(event) => setSaveForm((current) => ({ ...current, description: event.target.value }))} />
            </FormField>
            <FormField htmlFor="saved-filter-jql" label="JQL">
              <textarea className="field mt-1 min-h-24 resize-y font-mono" id="saved-filter-jql" value={saveForm.jql_query} onChange={(event) => setSaveForm((current) => ({ ...current, jql_query: event.target.value }))} />
            </FormField>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold">
                <input checked={saveForm.is_favorite} type="checkbox" onChange={(event) => setSaveForm((current) => ({ ...current, is_favorite: event.target.checked }))} />
                Favorite
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold">
                <input checked={saveForm.is_shared} type="checkbox" onChange={(event) => setSaveForm((current) => ({ ...current, is_shared: event.target.checked }))} />
                Shared
              </label>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default JQLSearchPage;
