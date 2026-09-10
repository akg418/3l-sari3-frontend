import { useEffect, useRef, useState } from 'react';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { EMPTY_FILTERS } from '../../context/ChannelsContext.jsx';

const TYPE_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'public', label: '# Public' },
  { value: 'private', label: '🔒 Private' },
];

/**
 * Search and filter controls for a channel list.
 *
 * The text inputs are debounced, so typing stays responsive while the query
 * behind it fires once; the visibility buttons apply immediately, since a
 * click is already a deliberate act.
 */
export const ChannelFilters = ({ filters, onChange, resultCount, isLoading }) => {
  const [search, setSearch] = useState(filters.search);
  const [owner, setOwner] = useState(filters.owner);

  const debouncedSearch = useDebouncedValue(search, 300);
  const debouncedOwner = useDebouncedValue(owner, 300);

  // Read through refs so the effect can depend on the debounced values alone.
  // Depending on `filters` or `onChange` would re-fire the effect with the very
  // change it just caused.
  const latest = useRef({ filters, onChange });
  latest.current = { filters, onChange };

  const lastEmitted = useRef({ search: filters.search, owner: filters.owner });

  useEffect(() => {
    const { search: lastSearch, owner: lastOwner } = lastEmitted.current;
    if (debouncedSearch === lastSearch && debouncedOwner === lastOwner) return;

    lastEmitted.current = { search: debouncedSearch, owner: debouncedOwner };
    latest.current.onChange({
      ...latest.current.filters,
      search: debouncedSearch,
      owner: debouncedOwner,
    });
  }, [debouncedSearch, debouncedOwner]);

  const isFiltered = Boolean(filters.search || filters.owner || filters.type);

  const clear = () => {
    setSearch('');
    setOwner('');
    lastEmitted.current = { search: '', owner: '' };
    onChange(EMPTY_FILTERS);
  };

  return (
    <div className="filters" role="search">
      <div className="filters__field filters__field--grow">
        <span className="filters__icon" aria-hidden="true">
          🔍
        </span>
        <label className="visually-hidden" htmlFor="channel-search">
          Search channels by name
        </label>
        <input
          id="channel-search"
          className="input filters__input"
          type="search"
          value={search}
          placeholder="Search channels…"
          autoComplete="off"
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="filters__field">
        <span className="filters__icon" aria-hidden="true">
          @
        </span>
        <label className="visually-hidden" htmlFor="channel-owner">
          Filter by owner username
        </label>
        <input
          id="channel-owner"
          className="input filters__input"
          type="search"
          value={owner}
          placeholder="Owner…"
          autoComplete="off"
          onChange={(event) => setOwner(event.target.value)}
        />
      </div>

      <div className="filters__types" role="group" aria-label="Filter by visibility">
        {TYPE_OPTIONS.map((option) => (
          <button
            key={option.value || 'all'}
            type="button"
            className="filters__type"
            aria-pressed={filters.type === option.value}
            onClick={() => onChange({ ...filters, type: option.value })}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="filters__status">
        {isLoading ? (
          <span className="subtle">Searching…</span>
        ) : (
          isFiltered && (
            <>
              <span className="subtle">
                {resultCount === 0 ? 'No matches' : `${resultCount} shown`}
              </span>
              <button type="button" className="filters__clear" onClick={clear}>
                Clear
              </button>
            </>
          )
        )}
      </div>
    </div>
  );
};
