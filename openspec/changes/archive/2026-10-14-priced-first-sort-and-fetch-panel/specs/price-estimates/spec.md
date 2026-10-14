# Spec Delta

## Purpose

Makes title-guessed unit prices visible and verifiable so users can spot and double-check estimates before trusting the sort.

## ADDED Requirements

### Requirement: Guessed price tag on estimated tiles
Tiles whose unit price was estimated from the title SHALL display an inline `≈ $X/unit · est.` tag with a verify tooltip. Tiles priced from Walmart's displayed unit price SHALL get no tag.

#### Scenario: Estimated tile
- **WHEN** a tile sorts on a title-derived estimate
- **THEN** it shows the tag with a tooltip stating the value is estimated and should be verified

#### Scenario: Displayed-price tile
- **WHEN** a tile sorts on Walmart's own displayed unit price
- **THEN** no tag is added

### Requirement: Tags removed on restore
Restore SHALL remove all estimate tags, leaving tiles byte-identical to pre-sort.

#### Scenario: Restore with tagged tiles
- **WHEN** the user restores after a sort that added tags
- **THEN** no estimate tag remains in the grid
