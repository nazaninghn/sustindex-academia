# Requirements Document

## Introduction

This feature covers loading the complete GRI (Global Reporting Initiative) sustainability questionnaire data into the database via a management command/seed script, ensuring the sector selection flow works end-to-end, validating score calculation correctness for gate/conditional/N-A/numerical logic, and displaying per-section results breakdowns. The system already has Django models (`Survey`, `Category`, `Question`, `Choice`, `QuestionnaireAttempt`, `Answer`) with fields for `is_gate`, `criterion_code`, `layer`, `conditional_on_question`, `numerical_thresholds`, and `sector`. The frontend already handles gate/conditional navigation in `useQuestionnaire.ts`. The database is currently empty and needs to be populated with the full GRI question bank.

## Glossary

- **Seeder**: The Django management command (`load_gri_questionnaire`) that populates the database with all GRI questionnaire data
- **Survey**: A top-level assessment container grouping categories and questions (one Survey per GRI phase: GRI1, GRI2, GRI3, GRI4, plus one per sector)
- **Category**: A grouping of questions within a survey (e.g., "GRI 1 — Governance & Strategy")
- **Question**: An individual assessment item with type, scoring, layer, and branching metadata
- **Choice**: A selectable answer option for a question, carrying a score value
- **Criterion**: A thematic grouping identified by `criterion_code` (e.g., G1, E3, S12, EC7) containing up to 6 questions across layers
- **Layer**: The PDCA classification of a question within a criterion — one of GATE, P (Plan), I (Implement), CONDITIONAL, M (Monitor), R (Report)
- **Gate_Question**: A question with `is_gate=True` and `layer='GATE'` that determines whether the remaining questions in the criterion are shown or skipped
- **Conditional_Question**: A question with `layer='CONDITIONAL'` shown only when its parent question scores at or above `conditional_on_min_score`
- **Numerical_Thresholds**: A JSON list of `{min, max, score}` bands used to score numerical-input questions; first matching band wins
- **Sector**: An industry classification (agri, energy, finance, construction, manufacturing, health, tech, retail) used to filter sector-specific questions
- **Attempt**: A `QuestionnaireAttempt` record representing a user's in-progress or completed assessment
- **Score_Calculation**: The logic in `get_category_breakdown()` that computes per-category and total scores, respecting gate-skipped and N/A exclusions
- **Core_Points**: The maximum 1260 points available from the four core GRI sections (320 + 280 + 480 + 180)

## Requirements

### Requirement 1: Survey and Category Structure Creation

**User Story:** As a system administrator, I want the Seeder to create the correct Survey and Category hierarchy, so that the questionnaire data is properly organized for the 5-phase assessment journey.

#### Acceptance Criteria

1. WHEN the Seeder is executed, THE Seeder SHALL create exactly 5 core Survey records: one for GRI 1 (Governance & Strategy), one for GRI 2 (Environmental Performance), one for GRI 3 (Social Performance), one for GRI 4 (Economic & Reporting), and one combined sector survey
2. WHEN the Seeder is executed, THE Seeder SHALL create one Category per Survey with appropriate `name`, `name_en`, `name_tr`, and `max_score` fields populated
3. WHEN the Seeder is executed, THE Seeder SHALL set `max_score` to 320 for GRI 1, 280 for GRI 2, 480 for GRI 3, and 180 for GRI 4 categories
4. THE Seeder SHALL assign sequential `order` values to Categories so they display in the correct phase order (GRI 1 → GRI 2 → GRI 3 → GRI 4 → Sector)
5. THE Seeder SHALL be idempotent — running the Seeder multiple times SHALL NOT create duplicate Survey or Category records

### Requirement 2: Gate Question Data Loading

**User Story:** As a system administrator, I want all gate questions loaded with correct metadata, so that the frontend gate-skip navigation works for criteria that have conditional entry.

#### Acceptance Criteria

1. WHEN the Seeder is executed, THE Seeder SHALL create gate questions with `is_gate=True`, `layer='GATE'`, and `question_type='binary'` for every criterion that has a gate in the GRI specification
2. THE Seeder SHALL create gate questions for GRI 1 criteria G1, G3, G7, G10 and any other gated criteria defined in the document
3. THE Seeder SHALL create gate questions for GRI 2 criteria E2, E3, E5, E9, E10, E12, E14
4. THE Seeder SHALL create gate questions for GRI 3 criteria S7, S8, S15, S17, S18, S19, S20, S21, S22, S23, S24
5. THE Seeder SHALL create gate questions for GRI 4 criteria EC6, EC7
6. WHEN a gate question is created, THE Seeder SHALL create exactly two Choices: one with score > 0 (Yes/applicable) and one with score = 0 (No/not applicable)
7. THE Seeder SHALL assign the lowest `order` value within each criterion to the gate question, ensuring the gate is presented first

### Requirement 3: Layer Question Data Loading (P, I, M, R)

**User Story:** As a system administrator, I want all PDCA layer questions loaded with correct types and scoring, so that each criterion has its full assessment depth.

#### Acceptance Criteria

1. WHEN the Seeder is executed, THE Seeder SHALL create questions for each layer (P, I, M, R) of every criterion with the correct `layer` field value
2. THE Seeder SHALL set `question_type` appropriately for each question: 'single' for single-choice, 'multi' for multi-select, 'numerical' for numerical-input, 'binary' for yes/no questions
3. THE Seeder SHALL set `allow_multiple=True` for all questions with `question_type='multi'`
4. WHEN a question has numerical scoring, THE Seeder SHALL populate `numerical_thresholds` as a JSON list of `{"min": <number>, "max": <number>, "score": <number>}` objects
5. THE Seeder SHALL create Choice records for every non-numerical question with correct `text`, `text_en`, `score`, and sequential `order` values
6. THE Seeder SHALL ensure that for P layers the maximum achievable score is 4, for I layers the maximum is 6, for M layers the maximum is 6, and for R layers the maximum is 4 (totaling 20 per criterion)
7. THE Seeder SHALL assign `order` values within each criterion following the sequence: GATE → P → I → CONDITIONAL → M → R

### Requirement 4: Conditional Question Data Loading

**User Story:** As a system administrator, I want conditional questions loaded with correct parent linkage and thresholds, so that follow-up questions appear only when the parent answer qualifies.

#### Acceptance Criteria

1. WHEN the Seeder creates a conditional question, THE Seeder SHALL set `layer='CONDITIONAL'`, `conditional_on_question` to the FK of the parent question, and `conditional_on_min_score` to the minimum score required to trigger display
2. THE Seeder SHALL create conditional questions for G1 (conditional on I layer, shown when board meeting count ≥ 1), G3, G4, G8, G10, G12, and all other criteria specified in the document as having COND layers
3. THE Seeder SHALL create conditional questions for Environmental criteria E1, E2, E4, E5, E6, E7, E8, E9, E11, E12, E13 as specified in the document
4. WHEN a conditional question awards extra credit, THE Seeder SHALL set the `bonus_points` field to the correct value
5. THE Seeder SHALL set `conditional_on_min_score` to the exact threshold value specified in the document for each conditional question

### Requirement 5: Cross-Criterion Gate Linkage (G10 → G11)

**User Story:** As a system administrator, I want the G10 gate to also control G11 visibility, so that when a company does not publish a sustainability report, both G10 and G11 layers are skipped.

#### Acceptance Criteria

1. WHEN the Seeder creates G11 layer questions (P, I, M, R), THE Seeder SHALL set `conditional_on_question` to the G10 gate question's FK
2. THE Seeder SHALL set `conditional_on_min_score=1` on all G11 layer questions so they are hidden when G10 gate scores 0
3. WHEN G10 gate is answered "No" (score 0), THE Score_Calculation SHALL exclude both G10 and G11 criterion scores from the numerator and denominator

### Requirement 6: Sector Question Data Loading

**User Story:** As a system administrator, I want sector-specific questions loaded with correct sector tagging, so that users only see questions relevant to their chosen industry.

#### Acceptance Criteria

1. WHEN the Seeder is executed, THE Seeder SHALL create exactly 12 questions per sector for each of the 8 sectors (96 sector questions total)
2. THE Seeder SHALL set the `sector` field to the correct sector code ('agri', 'energy', 'finance', 'construction', 'manufacturing', 'health', 'tech', 'retail') on each sector question
3. THE Seeder SHALL leave the `sector` field as empty string for all universal (core GRI) questions
4. THE Seeder SHALL create sector questions within a single sector Survey with a Category per sector, or within the sector survey with appropriate grouping
5. WHEN the Seeder is executed, THE Seeder SHALL create choices for sector questions with scores that sum to the correct sector maximum (Agriculture & Food = 123pt max, Energy & Utilities = 121pt, Financial Services = 121pt, Manufacturing & Industry = 114pt, Construction & Real Estate = 115pt, Healthcare & Pharma = 119pt, Technology & IT = 117pt, Retail & Trade = 123pt)

### Requirement 7: Question Ordering and Flow Correctness

**User Story:** As a system administrator, I want all questions ordered correctly, so that the assessment flows in the specified sequence within each criterion and across criteria.

#### Acceptance Criteria

1. THE Seeder SHALL assign globally sequential `order` values across all questions within each Survey, ensuring criteria are ordered G1 through G16, E1 through E14, S1 through S24, EC1 through EC9
2. WITHIN each criterion, THE Seeder SHALL order questions as: GATE (if present) → P → I → CONDITIONAL (after its parent) → M → R
3. WHEN questions are fetched by the frontend sorted by `order`, THE Question sequence SHALL match the flow diagram: GRI1 questions → GRI2 questions → GRI3 questions → GRI4 questions → Sector questions

### Requirement 8: Score Calculation Correctness for Gate-Skipped Criteria

**User Story:** As an assessment user, I want gate-skipped criteria to be excluded from both my score and the maximum possible, so that my percentage is not unfairly penalized for inapplicable criteria.

#### Acceptance Criteria

1. WHEN a gate question is answered with score 0 ("No"), THE Score_Calculation SHALL assign 0 points to all questions in that criterion
2. WHEN a gate question is answered with score 0, THE Score_Calculation SHALL exclude the entire criterion's maximum points from the `total_possible` denominator
3. WHEN a gate question is answered with a positive score ("Yes"), THE Score_Calculation SHALL include all layer questions of that criterion in both numerator and denominator
4. THE Score_Calculation SHALL handle the G10 → G11 cross-criterion skip correctly: when G10 gate = 0, both G10 and G11 criteria are excluded from the denominator

### Requirement 9: Score Calculation for Numerical Questions

**User Story:** As an assessment user, I want my numerical answers scored against threshold bands, so that my quantitative data translates to appropriate point values.

#### Acceptance Criteria

1. WHEN a numerical answer is submitted, THE Score_Calculation SHALL evaluate the value against the question's `numerical_thresholds` bands in order and assign the score from the first matching band
2. WHEN a numerical value falls between `min` and `max` (inclusive) of a threshold band, THE Score_Calculation SHALL assign that band's score
3. WHEN no threshold band matches the numerical value, THE Score_Calculation SHALL assign 0 points
4. THE Score_Calculation SHALL use the highest band score as the question's `max_possible_score` for denominator calculation

### Requirement 10: Score Calculation for Multi-Select Questions

**User Story:** As an assessment user, I want my multi-select answers scored additively with a cap, so that selecting more applicable options yields a higher score up to the layer maximum.

#### Acceptance Criteria

1. WHEN multiple choices are selected for a multi-select question, THE Score_Calculation SHALL sum the individual choice scores
2. THE Score_Calculation SHALL cap the summed score at the question's maximum possible score (sum of all positive-scoring choices)
3. THE Score_Calculation SHALL use the sum of all positive-scoring choices as the `max_possible_score` for multi-select questions in denominator calculation

### Requirement 11: Total Score Composition

**User Story:** As an assessment user, I want to see my total score composed of core GRI sections plus sector, so that I understand my full sustainability performance.

#### Acceptance Criteria

1. THE Score_Calculation SHALL compute the total core score as the sum across GRI 1, GRI 2, GRI 3, and GRI 4 category scores
2. THE Score_Calculation SHALL compute the total possible core points by summing the max_possible for each category (after gate and N/A exclusions)
3. WHEN a sector is selected, THE Score_Calculation SHALL add the sector category score and max_possible to the total
4. THE Results display SHALL show per-section breakdown for GRI 1, GRI 2, GRI 3, GRI 4, and the selected sector with score/max_score/percentage for each

### Requirement 12: Seeder Idempotency and Safety

**User Story:** As a system administrator, I want the Seeder to be safe to run multiple times, so that I can re-run it after updates without corrupting existing data.

#### Acceptance Criteria

1. THE Seeder SHALL use `get_or_create` or equivalent logic for Survey and Category creation to prevent duplicates
2. THE Seeder SHALL check for existing Questions by `criterion_code` + `layer` + `survey` before creating new ones
3. IF the Seeder detects existing data that matches, THEN THE Seeder SHALL update the existing records rather than create duplicates
4. THE Seeder SHALL output a summary report showing counts of created vs. updated records for Surveys, Categories, Questions, and Choices
5. IF the Seeder encounters an error mid-execution, THEN THE Seeder SHALL roll back the current transaction to prevent partial data corruption

### Requirement 13: Sector Selection Integration

**User Story:** As an assessment user, I want to select my industry sector before starting the sector phase, so that I only answer questions relevant to my business.

#### Acceptance Criteria

1. WHEN a user starts a sector-phase attempt, THE System SHALL store the selected sector in `attempt.selected_sector`
2. WHEN questions are fetched for an attempt with a `selected_sector`, THE System SHALL return only universal questions (sector='') and questions matching the selected sector
3. THE frontend surveys page SHALL display the sector picker UI before the user can start the sector phase (Phase 5)
4. WHEN no sector is selected, THE frontend SHALL disable the Start button for the sector phase

### Requirement 14: Results Display Per-Section Breakdown

**User Story:** As an assessment user, I want to see my results broken down by GRI section and sector, so that I can identify which sustainability areas need improvement.

#### Acceptance Criteria

1. THE Results page SHALL display a category performance row for each GRI section (GRI 1, GRI 2, GRI 3, GRI 4) showing score, max_score, and percentage
2. WHEN the user completed a sector assessment, THE Results page SHALL display an additional row for the sector category with score, max_score, and percentage
3. THE Results page SHALL display the overall total score as the sum of all category scores divided by total possible (expressed as percentage)
4. THE Results page SHALL correctly display 0% for categories where all criteria were gate-skipped (max_possible = 0 results in 0% rather than division error)
