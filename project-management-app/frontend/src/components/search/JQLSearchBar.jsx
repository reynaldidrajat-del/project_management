import { Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const DEFAULT_JQL = 'status != Done ORDER BY priority DESC';
const JQL_FIELD_NAMES = new Set(['project', 'status', 'assignee', 'priority', 'type', 'issueKey', 'key', 'sprint', 'epic', 'reporter', 'created', 'updated', 'due']);
const JQL_KEYWORDS = ['project', 'status', 'assignee', 'priority', 'type', 'issueKey', 'ORDER BY', 'AND', 'OR'];
const JQL_OPERATORS = new Set(['=', '!=', '~', '>', '<', '>=', '<=', '(', ')', ',']);
const JQL_RESERVED_WORDS = new Set(['AND', 'OR', 'ORDER', 'BY', 'ASC', 'DESC', 'IN', 'NOT', 'IS', 'EMPTY', 'NULL']);

const tokenizeJql = (value) => value.split(/(\s+|!=|>=|<=|=|~|>|<|\(|\)|,)/g).filter((token) => token.length > 0);

const getTokenClassName = (token) => {
  const upperToken = token.toUpperCase();

  if (/^\s+$/.test(token)) {
    return 'text-transparent';
  }

  if (JQL_OPERATORS.has(token)) {
    return 'text-rose-600';
  }

  if (JQL_RESERVED_WORDS.has(upperToken)) {
    return 'text-blue-700';
  }

  if (JQL_FIELD_NAMES.has(token)) {
    return 'text-emerald-700';
  }

  if (/^["'].*["']$/.test(token) || /^\d+$/.test(token)) {
    return 'text-amber-700';
  }

  return 'text-text-dark';
};

function JQLSearchBar({ initialValue = '', loading = false, onSearch, onSave }) {
  const [jql, setJql] = useState(initialValue || DEFAULT_JQL);
  const highlightedTokens = useMemo(() => tokenizeJql(jql || ' '), [jql]);

  useEffect(() => {
    setJql(initialValue || DEFAULT_JQL);
  }, [initialValue]);

  const handleSubmit = (event) => {
    event.preventDefault();
    onSearch?.(jql);
  };

  return (
    <form className="rounded-xl border border-border bg-white p-4 shadow-sm" onSubmit={handleSubmit}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="section-title">JQL Search</h2>
          <p className="section-subtitle">Cari issue dengan query Jira-style dan simpan filter untuk dipakai ulang.</p>
        </div>
        <div className="action-row">
          <button className="btn-secondary" type="button" onClick={() => onSave?.(jql)}>
            Save Filter
          </button>
          <button className="btn-primary" disabled={loading || !jql.trim()} type="submit">
            <Search className="h-4 w-4" />
            Search
          </button>
        </div>
      </div>
      <div className="relative min-h-28 rounded-lg border border-border bg-white focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
        <pre
          aria-hidden="true"
          className="pointer-events-none min-h-28 whitespace-pre-wrap break-words p-3 font-mono text-sm leading-6"
        >
          {highlightedTokens.map((token, index) => (
            <span key={`${token}-${index}`} className={getTokenClassName(token)}>
              {token}
            </span>
          ))}
        </pre>
        <textarea
          aria-label="JQL query"
          className="absolute inset-0 min-h-28 w-full resize-none rounded-lg border-0 bg-transparent p-3 font-mono text-sm leading-6 text-transparent caret-primary outline-none"
          spellCheck="false"
          value={jql}
          onChange={(event) => setJql(event.target.value)}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {JQL_KEYWORDS.map((keyword) => (
          <button
            key={keyword}
            className="badge bg-slate-100 text-slate-700 transition hover:bg-blue-100 hover:text-blue-700"
            type="button"
            onClick={() => setJql((current) => `${current.trim()} ${keyword}`.trim())}
          >
            {keyword}
          </button>
        ))}
      </div>
    </form>
  );
}

export default JQLSearchBar;
