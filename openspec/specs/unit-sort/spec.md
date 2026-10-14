# Unit Sort Specification

## Purpose

Orders listing results so the genuinely cheapest options surface first: priced items lead, unpriced items trail without disturbing each other.

## Requirements

### Requirement: Priced tiles sort before unpriced tiles
Tiles with a resolved unit price SHALL appear before all tiles without one. Unpriced tiles SHALL keep their original relative order, carry no badge, and carry no unit-price marker.

#### Scenario: Mixed priced and unpriced results
- **WHEN** a sort completes with some tiles priced and some unpriced
- **THEN** every priced tile precedes every unpriced tile and unpriced tiles retain their pre-sort relative order

#### Scenario: All tiles unpriced
- **WHEN** no tile resolves a unit price
- **THEN** the grid order is unchanged and the outcome is reported as unsorted rather than sorted

### Requirement: Groups order largest-first
Comparable unit groups SHALL be ordered by descending tile count. Ties SHALL keep first-seen dimension order. Within a group tiles SHALL ascend by unit price with exactly one best-value badge on the cheapest.

#### Scenario: Multiple dimensions present
- **WHEN** weight has 30 tiles and count has 10
- **THEN** all weight tiles precede all count tiles and each group ascends internally

#### Scenario: Single group
- **WHEN** all priced tiles share one dimension
- **THEN** the grid is one ascending run with one badge

### Requirement: Rail and carousel tiles are excluded
Tiles inside carousel or rail structures (carousel containers, slide items, horizontal scrollers) SHALL be excluded before grid identification, moves, stamps, badges, and counts. Positional hooks (stack index, numeric ids) SHALL NOT be used to identify rails.

#### Scenario: Buy-it-again rail present
- **WHEN** the page contains a headed horizontal rail of product tiles alongside the results grid
- **THEN** rail tiles are never moved, stamped, badged, or counted, and the grid-ancestor vote ignores them

#### Scenario: Rail outnumbers grid
- **WHEN** rail tiles outnumber grid tiles
- **THEN** the results grid is still identified and rail tiles are still excluded
