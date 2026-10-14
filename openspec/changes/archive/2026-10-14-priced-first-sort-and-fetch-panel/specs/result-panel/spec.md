# Spec Delta

## Purpose

Gives honest, persistent feedback and control over the sort: what happened, what it costs to get more, and how to undo it.

## ADDED Requirements

### Requirement: Honest outcome toast
After every sort the toast SHALL state priced count, unpriced-moved count, group count, and page count. It SHALL NOT claim a sort when zero tiles were priced.

#### Scenario: Partial pricing
- **WHEN** 43 tiles price and 27 do not
- **THEN** the toast reports both numbers and the group count

#### Scenario: Zero priced
- **WHEN** no tile resolves a unit price
- **THEN** the toast reports that nothing could be sorted

### Requirement: Expandable dashboard with restore
The toast SHALL expand into a panel showing per-group rows (dimension, count, cheapest pick), a page-cap stepper (1–20, default 1), fetch-more buttons, and a restore control that returns the grid byte-identical (order, badges, tags, hidden cells).

#### Scenario: Restore after sort and fetch-more
- **WHEN** the user restores after sorting and fetching extra pages
- **THEN** the grid matches its pre-sort state exactly and fetched tiles are removed

### Requirement: Persistent placement and reshow
The toast and panel SHALL persist until dismissed, superseded by a new sort, or hidden on navigation away from search/browse. Icon re-click on the same results SHALL reshow the toast with no re-sort; a new URL or reload SHALL fresh-sort.

#### Scenario: Dismiss then re-click
- **WHEN** the user dismisses the toast and clicks the icon on the same results
- **THEN** the toast reappears with the previous outcome and no network or DOM work occurs

### Requirement: Honest abort when no results grid is identified
When scan-scope filtering leaves zero sortable tiles, the toast SHALL state the results grid could not be identified instead of claiming success or empty results.

#### Scenario: All tiles filtered
- **WHEN** every tile is excluded as rail content
- **THEN** no DOM mutation occurs and the toast reports the grid was not identified
