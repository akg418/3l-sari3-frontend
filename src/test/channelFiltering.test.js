import { describe, expect, it } from 'vitest';
import { EMPTY_FILTERS, matchesFilters } from '../context/ChannelsContext.jsx';

const channel = (overrides = {}) => ({
  id: 'c1',
  name: 'general',
  type: 'public',
  createdBy: { id: 'u1', username: 'ada' },
  ...overrides,
});

/**
 * This predicate does two jobs: it filters "My Channels" in the browser, and
 * it decides whether a newly announced channel belongs on the directory page
 * the user is currently looking at. It has to agree with the server's query.
 */
describe('matchesFilters', () => {
  it('matches everything when no filter is set', () => {
    expect(matchesFilters(channel(), EMPTY_FILTERS)).toBe(true);
  });

  it.each([
    ['exact', 'general', true],
    ['partial', 'gene', true],
    ['different case', 'GENERAL', true],
    ['a fragment from the middle', 'ener', true],
    ['no match', 'random', false],
  ])('matches a name search that is %s', (_label, search, expected) => {
    expect(matchesFilters(channel(), { ...EMPTY_FILTERS, search })).toBe(expected);
  });

  it.each([
    ['exact owner', 'ada', true],
    ['partial owner', 'ad', true],
    ['different case', 'ADA', true],
    ['another owner', 'grace', false],
  ])('matches an owner filter that is %s', (_label, owner, expected) => {
    expect(matchesFilters(channel(), { ...EMPTY_FILTERS, owner })).toBe(expected);
  });

  it('matches on visibility', () => {
    expect(matchesFilters(channel(), { ...EMPTY_FILTERS, type: 'public' })).toBe(true);
    expect(matchesFilters(channel(), { ...EMPTY_FILTERS, type: 'private' })).toBe(false);
    expect(matchesFilters(channel({ type: 'private' }), { ...EMPTY_FILTERS, type: 'private' })).toBe(true);
  });

  it('requires every filter to hold at once', () => {
    const filters = { search: 'gen', owner: 'ada', type: 'public' };
    expect(matchesFilters(channel(), filters)).toBe(true);
    expect(matchesFilters(channel(), { ...filters, owner: 'grace' })).toBe(false);
    expect(matchesFilters(channel(), { ...filters, type: 'private' })).toBe(false);
  });

  it('ignores surrounding whitespace in a filter', () => {
    expect(matchesFilters(channel(), { ...EMPTY_FILTERS, search: '  gen  ' })).toBe(true);
  });

  it('treats a search term literally, matching the server', () => {
    // The server escapes the term before it becomes a regex; this must not
    // behave like a wildcard either, or the two would disagree.
    expect(matchesFilters(channel(), { ...EMPTY_FILTERS, search: '.*' })).toBe(false);
    expect(matchesFilters(channel({ name: 'a.b' }), { ...EMPTY_FILTERS, search: 'a.b' })).toBe(true);
  });

  it('does not match a channel that is missing', () => {
    expect(matchesFilters(undefined, EMPTY_FILTERS)).toBe(false);
  });

  it('survives a channel with no owner information', () => {
    expect(matchesFilters(channel({ createdBy: undefined }), { ...EMPTY_FILTERS, owner: 'ada' })).toBe(false);
  });
});
