# Implementation Plan: GRI Questionnaire Flow

## Overview

This implementation plan covers the complete GRI data seeding pipeline, scoring validation, and sector integration. The approach is incremental: first build the Excel parser module, then the idempotent loader, then the management command that orchestrates them, followed by scoring validation tests and sector integration verification. All work targets the existing Django `questionnaire` app — no new models or API endpoints are needed.

## Tasks

- [ ] 1. Create the Excel parser module
  - [ ] 1.1 Create `_gri_parser.py` with dataclasses and parsing logic
    - Create file at `sustindex-/questionnaire/management/commands/_gri_parser.py`
    - Define `ParsedChoice` and `ParsedQuestion` dataclasses with all metadata fields (criterion_code, layer, text_tr, text_en, question_type, is_gate, choices, numerical_thresholds, conditional_on_code, conditional_on_layer, conditional_on_min_score, bonus_points, sector)
    - Implement `parse_gri_excel(filepath)` that reads the structured Excel file using openpyxl
    - Parse each sheet (GRI1, GRI2, GRI3, GRI4, SECTOR) into a dict of `list[ParsedQuestion]`
    - Handle numerical threshold parsing from cell format into `[{min, max, score}]` dicts
    - Handle multi-choice parsing where multiple options exist per question row
    - _Requirements: 1.1, 2.1, 3.1, 3.2, 3.4, 4.1, 6.1_

  - [ ]* 1.2 Write unit tests for the Excel parser
    - Create test file at `sustindex-/questionnaire/tests/test_gri_parser.py`
    - Test parsing of gate questions returns `is_gate=True`, `layer='GATE'`, `question_type='binary'`
    - Test parsing of numerical thresholds produces valid `[{min, max, score}]` structure
    - Test parsing of multi-select questions sets correct choice scores
    - Test parsing of conditional metadata (conditional_on_code, conditional_on_min_score)
    - Test parsing of sector questions assigns correct sector codes
    - _Requirements: 2.1, 3.2, 3.4, 4.1, 6.2_

- [ ] 2. Create the GRI Loader class
  - [ ] 2.1 Implement survey and category configuration constants
    - Create file at `sustindex-/questionnaire/management/commands/_gri_constants.py`
    - Define `SURVEY_CONFIG` dict with all 5 surveys (GRI1-4 + SECTOR) including names, max_scores, orders
    - Define `GATE_CRITERIA` dict listing gated criteria per survey
    - Define `CROSS_CRITERION_LINKS` dict for G10→G11 linkage
    - Define `SECTOR_MAX_SCORES` dict with per-sector maximums
    - Define `LAYER_MAX_POINTS` dict (P=4, I=6, M=6, R=4)
    - Define order offset constants (GATE=0, P=10, I=20, CONDITIONAL=25, M=30, R=40)
    - _Requirements: 1.2, 1.3, 2.2, 2.3, 2.4, 2.5, 5.1, 6.5_

  - [ ] 2.2 Implement the `GRILoader` class with idempotent CRUD operations
    - Create file at `sustindex-/questionnaire/management/commands/_gri_loader.py`
    - Implement `load_survey(key, config)` using `get_or_create` to prevent duplicates
    - Implement `load_category(survey, config)` using `get_or_create` with `max_score` update
    - Implement `load_question(survey, category, parsed, order)` using `criterion_code + layer + survey` as unique key
    - Implement `load_choices(question, parsed_choices)` that syncs choices (delete removed, create new, update existing)
    - Implement `link_conditionals(survey, questions)` for resolving conditional FK references in a second pass
    - Implement `link_cross_criteria(questions)` for G10→G11 linkage in a third pass
    - Track stats (created/updated counts) for summary reporting
    - Set `allow_multiple=True` for `question_type='multi'` questions
    - _Requirements: 1.5, 2.6, 2.7, 3.3, 3.5, 3.6, 3.7, 4.1, 4.4, 4.5, 5.1, 5.2, 12.1, 12.2, 12.3_

  - [ ]* 2.3 Write unit tests for the GRILoader class
    - Add tests in `sustindex-/questionnaire/tests/test_gri_seeder.py`
    - Test `load_survey` creates survey with correct name and max_score
    - Test `load_survey` second call does not create duplicate
    - Test `load_question` creates question with correct metadata (is_gate, layer, criterion_code)
    - Test `load_choices` creates correct number of choices with correct scores
    - Test `link_conditionals` sets FK correctly
    - Test `link_cross_criteria` links G11 questions to G10 gate
    - _Requirements: 12.1, 12.2, 12.3, 5.1, 5.2_

- [ ] 3. Checkpoint - Ensure parser and loader tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Create the management command
  - [ ] 4.1 Implement `load_gri_questionnaire` management command
    - Create file at `sustindex-/questionnaire/management/commands/load_gri_questionnaire.py`
    - Add arguments: `--file` (default path to Excel), `--dry-run`, `--force` (delete existing first)
    - Wrap entire execution in `transaction.atomic()` for rollback on error
    - Call `parse_gri_excel()` to get parsed data
    - Instantiate `GRILoader` and iterate: load surveys → categories → questions → choices
    - Assign order values using formula: `(criterion_index × 100) + layer_offset`
    - Call `link_conditionals()` and `link_cross_criteria()` in second/third passes
    - Output summary report (created/updated counts per entity type)
    - Handle `CommandError` for missing file, invalid format, missing sheets
    - _Requirements: 1.1, 1.4, 1.5, 7.1, 7.2, 12.4, 12.5_

  - [ ]* 4.2 Write unit tests for the management command
    - Add tests in `sustindex-/questionnaire/tests/test_gri_seeder.py`
    - Test `test_seeder_creates_5_surveys`: verify exactly 5 Survey records created
    - Test `test_seeder_creates_categories_with_correct_max_scores`: verify max_score values
    - Test `test_seeder_creates_gate_questions_for_all_specified_criteria`: verify all GATE_CRITERIA present
    - Test `test_seeder_creates_conditional_for_g1_criterion`: verify G1 conditional linkage
    - Test `test_g10_g11_cross_criterion_linkage`: verify G11 linked to G10 gate
    - Test `test_seeder_creates_96_sector_questions`: verify sector question count
    - Test `test_seeder_idempotent_second_run`: run twice, verify no duplicates
    - Test `test_seeder_transaction_rollback_on_error`: simulate error, verify rollback
    - _Requirements: 1.1, 1.2, 1.3, 2.2-2.5, 4.2, 5.1, 5.2, 6.1, 6.4, 12.1-12.5_

- [ ] 5. Checkpoint - Ensure seeder command works end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement scoring validation tests
  - [ ] 6.1 Write property-based tests for gate-skip scoring logic
    - Create file at `sustindex-/questionnaire/tests/test_gri_properties.py`
    - Install `hypothesis` if not present (add to requirements)
    - **Property 8: Gate-Skip Scoring Exclusion**
    - Generate random criterion structures with gate answers (score 0 or positive)
    - Verify: when gate=0, criterion excluded from both numerator and denominator
    - Verify: when gate>0, all layer questions included in both
    - Use `@settings(max_examples=100)`
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 5.3**
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ]* 6.2 Write property-based tests for numerical threshold scoring
    - Add to `sustindex-/questionnaire/tests/test_gri_properties.py`
    - **Property 9: Numerical Threshold First-Match Scoring**
    - Generate random threshold bands and numerical input values
    - Verify: score equals first matching band's score
    - Verify: no match → score = 0
    - Verify: max_possible equals highest band score
    - Use `@settings(max_examples=100)`
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4**
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [ ]* 6.3 Write property-based tests for multi-select additive scoring
    - Add to `sustindex-/questionnaire/tests/test_gri_properties.py`
    - **Property 10: Multi-Select Additive Scoring**
    - Generate random choice sets with scores and random selection subsets
    - Verify: computed score = sum of selected choice scores
    - Verify: max_possible = sum of all positive-scoring choices
    - Use `@settings(max_examples=100)`
    - **Validates: Requirements 10.1, 10.2, 10.3**
    - _Requirements: 10.1, 10.2, 10.3_

  - [ ]* 6.4 Write property-based tests for total score aggregation
    - Add to `sustindex-/questionnaire/tests/test_gri_properties.py`
    - **Property 13: Total Score Aggregation**
    - Generate random per-category scores and max_possible values
    - Verify: total_score = (sum of scores / sum of max_possible) × 100
    - Verify: handles zero denominator (all gate-skipped) → 0%
    - Use `@settings(max_examples=100)`
    - **Validates: Requirements 11.1, 11.2**
    - _Requirements: 11.1, 11.2_

  - [ ]* 6.5 Write property-based tests for seeder idempotency
    - Add to `sustindex-/questionnaire/tests/test_gri_properties.py`
    - **Property 1: Seeder Idempotency**
    - Run loader logic twice with same input data
    - Verify: record counts identical after run 1 and run 2
    - Verify: field values identical
    - Use `@settings(max_examples=50)` (slower DB tests)
    - **Validates: Requirements 1.5, 12.1, 12.2, 12.3**
    - _Requirements: 12.1, 12.2, 12.3_

  - [ ]* 6.6 Write property-based tests for sector filtering
    - Add to `sustindex-/questionnaire/tests/test_gri_properties.py`
    - **Property 12: Sector Question Filtering**
    - Generate random sector assignments and selected_sector values
    - Verify: filtered questions satisfy `sector='' OR sector=selected_sector`
    - Verify: no questions with different non-empty sector appear
    - Use `@settings(max_examples=100)`
    - **Validates: Requirements 13.2**
    - _Requirements: 13.2_

- [ ] 7. Implement scoring edge-case unit tests
  - [ ] 7.1 Write unit tests for scoring edge cases
    - Add to `sustindex-/questionnaire/tests/test_scoring.py` (extend existing file)
    - Test `test_gate_skip_excludes_from_denominator`: G10 gate=0, verify G10+G11 excluded
    - Test `test_zero_division_safe_for_all_skipped_category`: all gates=0, verify 0% not error
    - Test `test_numerical_no_matching_band_scores_zero`: value outside all bands → score=0
    - Test `test_multi_select_zero_choices_scores_zero`: no selections → score=0, still in denominator
    - Test `test_conditional_with_deleted_parent_always_visible`: null FK → question visible
    - _Requirements: 8.4, 9.3, 10.1, 14.4_

- [ ] 8. Checkpoint - Ensure all scoring tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Implement sector integration validation
  - [ ] 9.1 Write integration tests for sector API filtering
    - Add to `sustindex-/questionnaire/tests/test_gri_seeder.py` or create `sustindex-/questionnaire/tests/test_gri_integration.py`
    - Test `test_sector_api_filter_returns_correct_subset`: create attempt with selected_sector, call questions API, verify only universal + matching sector returned
    - Test `test_complete_attempt_calculates_correct_esg_scores`: seed data, submit answers, complete attempt, verify `get_category_breakdown()` values
    - Test `test_results_api_includes_per_category_breakdown`: verify response includes per-section score/max_score/percentage
    - _Requirements: 13.1, 13.2, 11.1, 11.2, 11.3, 14.1, 14.2, 14.3_

  - [ ]* 9.2 Write property-based test for sector max score correctness
    - Add to `sustindex-/questionnaire/tests/test_gri_properties.py`
    - **Property 14: Sector Max Score Per Sector**
    - For each sector code, verify sum of max_possible across its 12 questions matches SECTOR_MAX_SCORES
    - **Validates: Requirements 6.5**
    - _Requirements: 6.5_

- [ ] 10. Wire together and validate data integrity
  - [ ] 10.1 Create a data validation utility for post-seed checks
    - Add a `--validate` flag to the `load_gri_questionnaire` command
    - Validate: all gate questions have exactly 2 choices (Property 2)
    - Validate: PDCA layers sum to 20 per criterion (Property 3)
    - Validate: layer ordering within each criterion is correct (Property 4)
    - Validate: all conditional questions have non-null `conditional_on_question` (Property 5)
    - Validate: multi-type questions have `allow_multiple=True` (Property 6)
    - Validate: numerical questions have valid thresholds (Property 7)
    - Validate: sector field empty for core GRI questions (Property 11)
    - Output validation report with pass/fail per check
    - _Requirements: 2.6, 3.3, 3.4, 3.6, 3.7, 4.1, 6.2, 6.3_

  - [ ]* 10.2 Write unit tests for the validation utility
    - Test each validation check with valid and invalid data
    - Test that validation report correctly identifies failures
    - _Requirements: 2.6, 3.6, 4.1, 6.3_

- [ ] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The project uses Django's `TestCase` with `transaction.atomic()` for test isolation
- Hypothesis library is required for property-based tests (`pip install hypothesis`)
- The Excel parser depends on `openpyxl` (`pip install openpyxl`)
- Existing files like `test_scoring.py` should be extended, not overwritten

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["1.2", "2.2"] },
    { "id": 2, "tasks": ["2.3", "4.1"] },
    { "id": 3, "tasks": ["4.2"] },
    { "id": 4, "tasks": ["6.1", "6.2", "6.3", "6.4", "6.5", "6.6", "7.1"] },
    { "id": 5, "tasks": ["9.1", "9.2"] },
    { "id": 6, "tasks": ["10.1"] },
    { "id": 7, "tasks": ["10.2"] }
  ]
}
```
