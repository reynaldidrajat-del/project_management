import { Check, ChevronDown, Search } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

function normalizeOption(option) {
  const value = option?.value == null ? '' : String(option.value);
  const label = option?.label == null ? value : String(option.label);
  const searchText = option?.searchText == null ? label : `${label} ${option.searchText}`;

  return {
    value,
    label,
    searchText: searchText.toLowerCase(),
  };
}

function SearchableSelect({
  value = '',
  options = [],
  onChange,
  placeholder = 'Select option',
  searchPlaceholder = 'Search options',
  noResultsLabel = 'No options found',
  disabled = false,
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const rootRef = useRef(null);
  const searchInputRef = useRef(null);
  const listboxId = useId();

  const normalizedValue = value == null ? '' : String(value);
  const normalizedOptions = useMemo(() => options.map(normalizeOption), [options]);
  const selectedOption = normalizedOptions.find((option) => option.value === normalizedValue);
  const displayLabel = selectedOption?.label || placeholder;

  const filteredOptions = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    if (!query) {
      return normalizedOptions;
    }

    return normalizedOptions.filter((option) => option.searchText.includes(query));
  }, [normalizedOptions, searchTerm]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);

    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const focusTimer = window.setTimeout(() => searchInputRef.current?.focus(), 0);

    return () => window.clearTimeout(focusTimer);
  }, [isOpen]);

  const closeDropdown = () => {
    setIsOpen(false);
    setSearchTerm('');
  };

  const selectOption = (option) => {
    if (option.value !== normalizedValue) {
      onChange?.(option.value);
    }

    closeDropdown();
  };

  const handleButtonKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setIsOpen(true);
    }
  };

  const handleSearchKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDropdown();
    }
  };

  return (
    <div className={`relative w-full ${className}`} ref={rootRef}>
      <button
        aria-controls={listboxId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className="field flex min-h-11 items-center justify-between gap-2 text-left"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen((current) => !current);
          }
        }}
        onKeyDown={handleButtonKeyDown}
        type="button"
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {isOpen ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-50 overflow-hidden rounded-lg border border-border bg-white shadow-lg">
          <div className="relative border-b border-border p-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              aria-label="Search dropdown options"
              className="field h-9 pl-8"
              onChange={(event) => setSearchTerm(event.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={searchPlaceholder}
              ref={searchInputRef}
              value={searchTerm}
            />
          </div>

          <div className="max-h-60 overflow-y-auto py-1" id={listboxId} role="listbox">
            {filteredOptions.length ? (
              filteredOptions.map((option) => {
                const selected = option.value === normalizedValue;

                return (
                  <button
                    aria-selected={selected}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${
                      selected ? 'bg-blue-50 text-primary' : 'text-text-dark'
                    }`}
                    key={option.value || '__empty'}
                    onClick={() => selectOption(option)}
                    role="option"
                    type="button"
                  >
                    <span className="truncate">{option.label}</span>
                    {selected ? <Check className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-3 text-sm text-text-muted">{noResultsLabel}</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default SearchableSelect;
