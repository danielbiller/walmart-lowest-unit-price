# Spec Delta

## Purpose

Keeps result sets relevant and fast by fetching only the current page unless the user explicitly asks for more.

## ADDED Requirements

### Requirement: Default fetch is current page only
Activation SHALL sort the visible grid without fetching additional pages unless the user requests more.

#### Scenario: Fresh activation
- **WHEN** the user activates the extension on a listing
- **THEN** no page-2+ request fires and the outcome reports a single page

### Requirement: Incremental fetch-more
The user SHALL be able to fetch 5 more pages or all pages (hard ceiling 20 total). Fetching SHALL resume after the last fetched page, merge new tiles into the grid, and re-sort in place.

#### Scenario: Fetch five more
- **WHEN** the user requests five more pages after a 1-page sort
- **THEN** pages 2–6 are fetched sequentially, merged, and the grid re-sorts without losing the existing order snapshot

#### Scenario: Early end of results
- **WHEN** a fetched page yields zero tiles
- **THEN** fetching stops and the reported page count covers only pages that contributed tiles
