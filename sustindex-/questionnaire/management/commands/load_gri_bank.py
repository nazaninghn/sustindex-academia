"""
Django management command: load_gri_bank
Parses the GRI question bank text file and loads all questions into the database.

Usage:
    python manage.py load_gri_bank
    python manage.py load_gri_bank --file /path/to/gri_full.txt
    python manage.py load_gri_bank --dry-run
"""

import re
import os
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

# ---------------------------------------------------------------------------
# Adjust this import to match your actual app / model locations
# ---------------------------------------------------------------------------
from questionnaire.models import Survey, Category, Question, Choice


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DEFAULT_FILE = r"C:/Users/UP/Downloads/gri_full.txt"

# Core-criteria sections: (label, code_pattern_re, start_line_1based, end_line_1based, survey_id)
CORE_SECTIONS = [
    ("Governance",   r"^G\d+$",   252,  991,  18),
    ("Environment",  r"^E\d+$",  1041, 1764,  19),
    ("Social",       r"^S\d+$",  1839, 3018,  20),
    ("Economic",     r"^EC\d+$", 3112, 3550,  21),
]

# Sector sections: (label, prefix, start_line_1based, end_line_1based, survey_id)
SECTOR_SECTIONS = [
    ("Agriculture",   "AG",  3551, 3739,  27),
    ("Energy",        "EN",  3739, 3937,  26),
    ("Financial",     "FIN", 3937, 4155,  24),
    ("Manufacturing", "MAN", 4155, 4352,  23),
    ("Construction",  "CON", 4352, 4554,  28),
    ("Healthcare",    "HLT", 4554, 4752,  25),
    ("Technology",    "TEC", 4752, 4945,  22),
    ("Retail",        "RET", 4945, 5137,  29),
]

# Layer label -> (layer code, order, name)
LAYER_MAP = {
    "P": ("P", 10, "Policy & Commitment"),
    "I": ("I", 20, "Implementation"),
    "M": ("M", 30, "Measurement & KPIs"),
    "R": ("R", 40, "Results & Improvement"),
}

# Lines to skip universally
SKIP_LINE_PATTERNS = [
    r"^Not:",
    r"^📎 Belge:",
    r"^Giriş birimi:",
    r"^Birim:",
    r"^Toplam max \d+ pt",
    r"^Dallanma mantığı:",
    r"^Cevap$",
    r"^Yönlendirme$",
    r'^"yes"$',
    r'^"no"$',
]
SKIP_COMPILED = [re.compile(p, re.UNICODE) for p in SKIP_LINE_PATTERNS]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def lines_from_file(filepath):
    """Read file and return list of stripped lines (0-based index)."""
    with open(filepath, encoding="utf-8") as fh:
        return [ln.rstrip("\n").strip() for ln in fh.readlines()]


def should_skip(line):
    """Return True if a line should be silently ignored."""
    for pat in SKIP_COMPILED:
        if pat.match(line):
            return True
    return False


def parse_choice_score(text):
    """
    Extract trailing score from a choice line.
    Patterns:
      →  4        (single-choice)
      →  2 pt     (multi-select)
      +1 pt       (bullet conditional)
      → 1 pt      (bullet conditional variant)
      +2          (rare)
    Returns (clean_text, score_int).
    """
    # Remove leading bullet markers like "• A." or "• B." or "A." etc.
    # (keep the text itself intact, just strip bullets for display)
    clean = text

    # Pattern: trailing "→  <N>" or "→  <N> pt"
    m = re.search(r'→\s+(\d+)\s*(?:pt)?\s*$', clean)
    if m:
        score = int(m.group(1))
        clean = clean[:m.start()].rstrip(" →").strip()
        return clean, score

    # Pattern: trailing "+<N> pt" or "+<N>"
    m = re.search(r'\+(\d+)\s*(?:pt)?\s*$', clean)
    if m:
        score = int(m.group(1))
        clean = clean[:m.start()].strip()
        return clean, score

    # No score found
    return clean.strip(), 0


def parse_max_pts(line):
    """Extract integer from lines like '6 pt max', '4 pt max'."""
    m = re.match(r'^(\d+)\s+pt\s+max$', line.strip())
    if m:
        return int(m.group(1))
    return None


def detect_question_type(line):
    """
    Detect question type from Turkish descriptor line.
    Returns one of: 'single', 'multi', 'binary', 'numerical', or None.
    """
    low = line.lower()
    if 'sayısal' in low:
        return 'numerical'
    if 'çok seçim' in low or 'çok seçimli' in low:
        return 'multi'
    if 'tek seçim' in low or 'tek seçimli' in low:
        return 'single'
    if 'ikili' in low:
        return 'binary'
    return None


def is_layer_header(line):
    """Return layer code if line is a standalone layer header (P/I/M/R)."""
    return line if line in LAYER_MAP else None


def is_core_code(line, pattern):
    """Return True if line is a standalone criterion code matching pattern."""
    return bool(re.match(pattern, line.strip()))


def is_arrow_line(line):
    """Return True if line is the conditional branch marker '↳'."""
    return line.strip() == '↳'


def is_threshold_header(line):
    """Return True if line is the 'Puanlama eşikleri:' header."""
    return line.strip().startswith('Puanlama eşikleri')


def is_threshold_skip_header(line):
    """Skip Aralık / Puan table header rows inside threshold blocks."""
    stripped = line.strip()
    return stripped in ('Aralık', 'Puan', 'Aralık / Eşik', 'Aralık*', 'Eşik', 'Puan*')


def looks_like_score_only(line):
    """Return True if the line is just a bare integer (threshold score row)."""
    return bool(re.match(r'^\d+$', line.strip()))


def extract_bonus_pts(line):
    """Extract bonus pts from '📎 Belge:' lines like '(+5 pt)'."""
    m = re.search(r'\(\+(\d+)\s*pt\)', line)
    if m:
        return int(m.group(1))
    return 0


# ---------------------------------------------------------------------------
# Core threshold parser
# ---------------------------------------------------------------------------

def parse_numerical_thresholds(lines, i):
    """
    Called right after 'Puanlama eşikleri:' line.
    Reads alternating range_text / score lines.
    Returns (thresholds_list, new_i).
    """
    thresholds = []
    end = len(lines)

    while i < end:
        line = lines[i]
        # Stop conditions
        if not line:
            i += 1
            # Allow one blank line inside table, but two blanks = done
            if i < end and not lines[i]:
                break
            continue
        if is_threshold_skip_header(line):
            i += 1
            continue
        if (is_layer_header(line) or is_arrow_line(line)
                or should_skip(line)):
            break
        # Is this a score-only line?  Then previous non-blank was the range.
        # Pattern: alternating pairs
        i_before_range = i          # remember position of range_text line
        range_text = line.strip()
        i += 1
        # Peek for score
        while i < end and not lines[i]:
            i += 1
        if i >= end:
            break
        score_line = lines[i].strip()
        if looks_like_score_only(score_line):
            thresholds.append({"range": range_text, "score": int(score_line)})
            i += 1
        else:
            # Not a score — restore to range_text line so caller can see it
            i = i_before_range
            break

    return thresholds, i


# ---------------------------------------------------------------------------
# Choice block parser
# ---------------------------------------------------------------------------

def parse_choices_block(lines, i, stop_patterns=None):
    """
    Parse letter-choice lines (A. B. C. D.) and bullet choices (• A.)
    until we hit a layer header, criterion code, ↳, or empty separator.
    Returns (choices_list, new_i).
    Each choice: {'text_tr': str, 'score': int, 'order': int}
    """
    choices = []
    order = 0
    end = len(lines)
    stop_patterns = stop_patterns or []

    while i < end:
        line = lines[i]

        if not line:
            # One blank is OK inside choices only if the next non-blank is another choice
            j = i + 1
            while j < end and not lines[j]:
                j += 1
            if j < end and (
                re.match(r'^[A-Z]\.\s', lines[j]) or
                re.match(r'^•\s', lines[j]) or
                re.match(r'^[A-Za-z]\.\s', lines[j])
            ):
                i = j
                continue
            break

        if should_skip(line):
            i += 1
            continue

        if is_layer_header(line):
            break
        if is_arrow_line(line):
            break

        # Check caller stop patterns (e.g. criterion codes)
        stop = False
        for pat in stop_patterns:
            if re.match(pat, line):
                stop = True
                break
        if stop:
            break

        # Koşullu soru marker
        if 'Koşullu soru' in line:
            break

        # Check for choice line patterns
        # Standard: "A. text  →  4" or "A. text  →"
        m_std = re.match(r'^([A-D])\.\s+(.+)$', line)
        # Bullet: "• A. text  +1 pt" or "• A. text  0 pt" or "• text"
        m_bullet = re.match(r'^•\s+(.+)$', line)

        if m_std:
            raw_text = m_std.group(1) + '. ' + m_std.group(2)
            text, score = parse_choice_score(raw_text)
            # Remove leading "A. " from text for cleaner storage
            text = re.sub(r'^[A-D]\.\s*', '', text).strip()
            choices.append({'text_tr': text, 'score': score, 'order': order})
            order += 1
            i += 1
        elif m_bullet:
            raw_text = m_bullet.group(1)
            # Bullet conditional choice: "+1 pt" or "0 pt" at end
            text, score = parse_choice_score(raw_text)
            # Strip leading letter if present "A. text"
            text = re.sub(r'^[A-Za-z]\.\s*', '', text).strip()
            choices.append({'text_tr': text, 'score': score, 'order': order})
            order += 1
            i += 1
        else:
            # Plain multi-select choice: "Text  →  N pt" or "Hiçbiri  →  0 pt"
            m_multi = re.match(r'^(.+?)\s+→\s+(\d+)\s+pt\s*$', line)
            if m_multi:
                text = m_multi.group(1).strip()
                score = int(m_multi.group(2))
                choices.append({'text_tr': text, 'score': score, 'order': order})
                order += 1
                i += 1
                continue
            # "Hiçbiri  →  0" (without "pt")
            if line.startswith('Hiçbiri'):
                m_h = re.search(r'(\d+)', line)
                score = int(m_h.group(1)) if m_h else 0
                choices.append({'text_tr': 'Hiçbiri', 'score': score, 'order': order})
                order += 1
                i += 1
                continue
            # Not a choice line — stop
            break

    return choices, i


# ---------------------------------------------------------------------------
# Layer content parser
# ---------------------------------------------------------------------------

def parse_layer_content(lines, i, layer_code, layer_max_pts, stop_patterns=None):
    """
    Parse a single P/I/M/R layer block starting at the question descriptor line.
    Returns a list of question dicts (usually 1, sometimes 2 if there's a conditional).
    Each dict:
      {
        'text_tr': str,
        'question_type': str,
        'layer': str,
        'max_pts': int,
        'numerical_thresholds': list or None,
        'choices': list,
        'is_conditional': bool,
        'conditional_text': str (if conditional),
        'conditional_type': str (if conditional),
        'conditional_choices': list (if conditional),
        'conditional_thresholds': list (if conditional),
        'bonus_points': int,
      }
    new_i points to the start of the next layer or criterion.
    """
    questions = []
    end = len(lines)
    stop_patterns = stop_patterns or []

    # The first non-blank, non-skip line at i should be the question type / descriptor
    # Skip over the layer name line (e.g. "Policy & Commitment") and max pts
    while i < end:
        line = lines[i]
        if not line or parse_max_pts(line) is not None:
            i += 1
            continue
        if should_skip(line):
            i += 1
            continue
        break

    # Now i should point to the question descriptor line like:
    # "Tek seçim  —  Sürdürülebilirlik / ESG, YK charter..."
    # or "Sayısal  —  ..."
    # or "Çok seçim  —  ..."
    if i >= end:
        return questions, i

    desc_line = lines[i]
    q_type = detect_question_type(desc_line)
    if q_type is None:
        q_type = 'single'  # fallback

    # Extract question text (everything after the " — " separator if present)
    if '  —  ' in desc_line:
        q_text = desc_line.split('  —  ', 1)[1].strip()
    elif ' — ' in desc_line:
        q_text = desc_line.split(' — ', 1)[1].strip()
    else:
        q_text = desc_line.strip()

    i += 1
    bonus_points = 0

    main_q = {
        'text_tr': q_text,
        'question_type': q_type,
        'layer': layer_code,
        'max_pts': layer_max_pts,
        'numerical_thresholds': None,
        'choices': [],
        'is_conditional': False,
        'bonus_points': 0,
    }

    # Parse body: thresholds or choices
    while i < end:
        line = lines[i]

        if not line:
            i += 1
            continue

        if should_skip(line):
            # Check for bonus points in skip lines
            if '📎 Belge:' in line:
                bonus_points += extract_bonus_pts(line)
            i += 1
            continue

        # Stop at next layer or next criterion
        if is_layer_header(line):
            break
        stop = any(re.match(p, line) for p in stop_patterns)
        if stop:
            break

        # Conditional branch — do NOT consume ↳ here; let caller handle it
        if is_arrow_line(line):
            break

        # Threshold block
        if is_threshold_header(line):
            i += 1
            thresholds, i = parse_numerical_thresholds(lines, i)
            main_q['numerical_thresholds'] = thresholds
            continue

        # Choice lines: standard A/B/C/D, bullet •, or plain multi-select "text → N pt"
        if (re.match(r'^[A-D]\.\s+', line) or re.match(r'^•\s+', line)
                or re.search(r'→\s+\d+\s+pt\s*$', line)
                or line.startswith('Hiçbiri')):
            choices, i = parse_choices_block(lines, i, stop_patterns=stop_patterns)
            main_q['choices'] = choices
            continue

        # Informational lines (e.g. "Toplam max X pt. ...")
        if re.match(r'^Toplam max \d+', line):
            i += 1
            continue

        # Bonus document line
        if line.startswith('📎'):
            bonus_points += extract_bonus_pts(line)
            i += 1
            continue

        # Any other line — could be continuation text or extra descriptor
        i += 1

    main_q['bonus_points'] = bonus_points
    questions.append(main_q)
    return questions, i


# ---------------------------------------------------------------------------
# Criterion block parser (core criteria)
# ---------------------------------------------------------------------------

def parse_criterion_block(lines, i, code_pattern):
    """
    Parse one criterion block starting at position i (the criterion code line).
    Returns (criterion_dict, new_i).

    criterion_dict keys:
      code, name, gri_ref, mandatory, max_pts,
      has_gate, gate_text,
      layers: {P: {text, type, thresholds, choices, bonus_points, conditional: {...}}, ...}
    """
    end = len(lines)
    code = lines[i].strip()
    i += 1

    criterion = {
        'code': code,
        'name': '',
        'gri_ref': '',
        'subcategory': '',
        'mandatory': True,
        'max_pts': 20,
        'has_gate': False,
        'gate_text': '',
        'gate_choices': [],
        'layers': {},
    }

    # ---- Header: name, gri_ref, optional subcategory, Zorunlu/Opsiyonel, max_pts ----
    header_done = False
    name_set = False
    while i < end and not header_done:
        line = lines[i]

        if not line:
            i += 1
            continue

        if should_skip(line):
            i += 1
            continue

        # Is this the criterion code of the NEXT criterion? Then we're done early.
        if is_core_code(line, code_pattern) and line != code:
            header_done = True
            break

        # Layer header = end of criterion header
        if is_layer_header(line) or line == 'GATE':
            header_done = True
            break

        # GRI reference
        if re.match(r'^GRI\s', line) or '/' in line and re.match(r'^GRI', line):
            criterion['gri_ref'] = line
            i += 1
            continue

        # Mandatory/optional
        if line in ('Zorunlu', 'Opsiyonel'):
            criterion['mandatory'] = (line == 'Zorunlu')
            i += 1
            continue

        # Max pts
        pts = parse_max_pts(line)
        if pts is not None:
            criterion['max_pts'] = pts
            i += 1
            continue

        # Check if it looks like a pt value directly (e.g. "20 pt")
        if re.match(r'^\d+ pt$', line):
            criterion['max_pts'] = int(line.split()[0])
            i += 1
            continue

        # Criterion name (first non-empty line after code)
        if not name_set:
            criterion['name'] = line
            name_set = True
            i += 1
            continue

        # Subcategory (second descriptive line, not GRI/Zorunlu/pts)
        if not criterion['subcategory']:
            criterion['subcategory'] = line
            i += 1
            continue

        i += 1

    # ---- GATE block ----
    if i < end and lines[i].strip() == 'GATE':
        i += 1
        criterion['has_gate'] = True
        # Next non-blank line is the gate question text
        while i < end and not lines[i]:
            i += 1
        if i < end:
            gate_line = lines[i]
            if '  —  ' in gate_line:
                criterion['gate_text'] = gate_line.split('  —  ', 1)[1].strip()
            elif 'Gate soru' in gate_line:
                criterion['gate_text'] = re.sub(r'^Gate soru\s*[—–-]+\s*', '', gate_line).strip()
            else:
                criterion['gate_text'] = gate_line
            i += 1

        # Skip gate choices line ("Seçenekler: Evet  |  Hayır ...") and branch info
        while i < end:
            line = lines[i]
            if not line:
                i += 1
                continue
            if is_layer_header(line):
                break
            if should_skip(line):
                i += 1
                continue
            # "Seçenekler:" line — skip
            if line.startswith('Seçenekler:'):
                i += 1
                continue
            # "Hayır → ..." branch line — skip
            if re.match(r'^(Hayır|Evet)\s*→', line):
                i += 1
                continue
            # If it looks like a layer header we stop
            break

    # ---- PDCA layers ----
    while i < end:
        line = lines[i]

        if not line:
            i += 1
            continue

        if should_skip(line):
            i += 1
            continue

        # Next criterion code = done
        if is_core_code(line, code_pattern) and line != code:
            break

        layer_code = is_layer_header(line)
        if layer_code:
            i += 1  # consume layer header
            # Consume optional layer name (e.g. "Policy & Commitment")
            while i < end and not lines[i]:
                i += 1
            if i < end and lines[i] in [v[2] for v in LAYER_MAP.values()]:
                i += 1  # skip layer name

            # Consume max pts line
            layer_max_pts = 0
            while i < end:
                pts = parse_max_pts(lines[i])
                if pts is not None:
                    layer_max_pts = pts
                    i += 1
                    break
                if not lines[i]:
                    i += 1
                    continue
                if should_skip(lines[i]):
                    i += 1
                    continue
                break

            # Parse the main question
            layer_questions, i = parse_layer_content(
                lines, i, layer_code, layer_max_pts,
                stop_patterns=[code_pattern]
            )

            # Check if next line is ↳ (conditional)
            conditional_q = None
            while i < end and not lines[i]:
                i += 1

            if i < end and is_arrow_line(lines[i]):
                i += 1  # consume ↳
                # Skip blank and the condition description line
                while i < end and not lines[i]:
                    i += 1
                if i < end and 'Koşullu soru' in lines[i]:
                    i += 1  # skip condition description

                # The next line is the conditional question descriptor
                while i < end and not lines[i]:
                    i += 1

                if i < end:
                    cond_line = lines[i]
                    cond_type = detect_question_type(cond_line) or 'single'

                    # Extract text
                    # Format: "Tek seçim → Toplantı çıktıları ..."
                    # or: "Sayısal  →  TRIR değeri"
                    # or: "İkili  →  ..."
                    cond_text = ''
                    if '→' in cond_line:
                        cond_text = cond_line.split('→', 1)[1].strip()
                    elif '  —  ' in cond_line:
                        cond_text = cond_line.split('  —  ', 1)[1].strip()
                    else:
                        cond_text = cond_line
                    i += 1

                    conditional_q = {
                        'text_tr': cond_text,
                        'question_type': cond_type,
                        'layer': 'CONDITIONAL',
                        'max_pts': 0,
                        'numerical_thresholds': None,
                        'choices': [],
                        'bonus_points': 0,
                    }

                    # Parse conditional body
                    while i < end:
                        ln = lines[i]
                        if not ln:
                            i += 1
                            continue
                        if should_skip(ln):
                            i += 1
                            continue
                        if is_layer_header(ln):
                            break
                        if is_core_code(ln, code_pattern) and ln != code:
                            break
                        if is_threshold_header(ln):
                            i += 1
                            thresholds, i = parse_numerical_thresholds(lines, i)
                            conditional_q['numerical_thresholds'] = thresholds
                            continue
                        if re.match(r'^[A-D]\.\s+', ln) or re.match(r'^•\s+', ln):
                            choices, i = parse_choices_block(lines, i, stop_patterns=[code_pattern])
                            conditional_q['choices'] = choices
                            continue
                        if re.match(r'^Toplam max \d+', ln):
                            i += 1
                            continue
                        if ln.startswith('📎'):
                            conditional_q['bonus_points'] += extract_bonus_pts(ln)
                            i += 1
                            continue
                        # Informational
                        i += 1

            if layer_questions:
                main_layer_q = layer_questions[0]
                criterion['layers'][layer_code] = {
                    'text_tr': main_layer_q['text_tr'],
                    'question_type': main_layer_q['question_type'],
                    'max_pts': main_layer_q['max_pts'] or layer_max_pts,
                    'numerical_thresholds': main_layer_q['numerical_thresholds'],
                    'choices': main_layer_q['choices'],
                    'bonus_points': main_layer_q['bonus_points'],
                    'conditional': conditional_q,
                }

            continue  # back to while loop for next layer

        # Non-layer, non-criterion line in criterion body — skip
        i += 1

    return criterion, i


# ---------------------------------------------------------------------------
# Core criteria section parser
# ---------------------------------------------------------------------------

def parse_core_criteria(lines, start, end, code_pattern):
    """
    Parse all criteria in [start, end) (1-based line numbers).
    Returns list of criterion dicts.
    """
    criteria = []
    i = start - 1  # convert to 0-based
    end_idx = min(end - 1, len(lines))  # 0-based exclusive

    while i < end_idx:
        line = lines[i]
        if not line or not is_core_code(line, code_pattern):
            i += 1
            continue
        try:
            criterion, i = parse_criterion_block(lines, i, code_pattern)
            criteria.append(criterion)
        except Exception as exc:
            print(f"  WARNING: Failed to parse criterion starting at line {i+1}: {exc}")
            i += 1

    return criteria


# ---------------------------------------------------------------------------
# Sector question parser
# ---------------------------------------------------------------------------

def parse_sector_questions(lines, start, end):
    """
    Parse sector module questions in [start, end) (1-based).
    Returns list of question dicts:
      {
        'number': int,
        'code': str,          e.g. 'AG-01'
        'text_tr': str,
        'topic': str,         e.g. 'Sertifikasyon | GRI 13.5'
        'question_type': str,
        'mandatory': bool,
        'max_pts': int,
        'choices': list,
        'numerical_thresholds': None,
        'bonus_points': int,
        'has_conditional': bool,
        'conditional': dict or None,
      }
    """
    questions = []
    i = start - 1  # 0-based
    end_idx = min(end - 1, len(lines))  # 0-based exclusive

    # Pattern for sector question numbers (standalone integer)
    number_pat = re.compile(r'^\d{1,2}$')
    # Pattern for sector codes like AG-01, EN-12, FIN-03, MAN-04, etc.
    code_pat = re.compile(r'^[A-Z]{2,4}-\d+$')

    while i < end_idx:
        line = lines[i]

        if not line:
            i += 1
            continue

        # Look for question number (standalone digit)
        if not number_pat.match(line):
            i += 1
            continue

        # Found a question number
        q_number = int(line)
        i += 1

        # Skip blanks
        while i < end_idx and not lines[i]:
            i += 1
        if i >= end_idx:
            break

        # Next line: sector code (e.g. AG-01)
        if not code_pat.match(lines[i]):
            # Not a sector question block — skip
            continue

        q_code = lines[i]
        i += 1

        # Next non-blank: question text
        while i < end_idx and not lines[i]:
            i += 1
        if i >= end_idx:
            break

        q_text = lines[i]
        i += 1

        q = {
            'number': q_number,
            'code': q_code,
            'text_tr': q_text,
            'topic': '',
            'question_type': 'single',
            'mandatory': True,
            'max_pts': 0,
            'choices': [],
            'numerical_thresholds': None,
            'bonus_points': 0,
            'has_conditional': False,
            'conditional': None,
        }

        try:
            # Parse question metadata and body
            while i < end_idx:
                ln = lines[i]

                if not ln:
                    i += 1
                    # Check if next non-blank is a new question number
                    j = i
                    while j < end_idx and not lines[j]:
                        j += 1
                    if j < end_idx and number_pat.match(lines[j]):
                        break
                    continue

                # Next question number = done
                if number_pat.match(ln):
                    break

                if should_skip(ln):
                    if '📎 Belge:' in ln:
                        q['bonus_points'] += extract_bonus_pts(ln)
                    i += 1
                    continue

                # Topic line (contains "|")
                if '|' in ln and not re.match(r'^[A-D]\.\s', ln) and not re.match(r'^•\s', ln):
                    if not q['topic']:
                        q['topic'] = ln
                        i += 1
                        continue

                # Question type
                qt = detect_question_type(ln)
                if qt:
                    q['question_type'] = qt
                    i += 1
                    continue

                # Mandatory
                if ln in ('Zorunlu', 'Opsiyonel'):
                    q['mandatory'] = (ln == 'Zorunlu')
                    i += 1
                    continue

                # Max pts
                if re.match(r'^\d+ pt$', ln):
                    q['max_pts'] = int(ln.split()[0])
                    i += 1
                    continue

                # "Toplam max X pt" info line for multi-select
                if re.match(r'^Toplam max \d+', ln):
                    i += 1
                    continue

                # Threshold block
                if is_threshold_header(ln):
                    i += 1
                    thresholds, i = parse_numerical_thresholds(lines, i)
                    q['numerical_thresholds'] = thresholds
                    continue

                # Conditional branch (↳)
                if is_arrow_line(ln):
                    i += 1
                    q['has_conditional'] = True
                    # Skip condition description
                    while i < end_idx and not lines[i]:
                        i += 1
                    if i < end_idx and 'Koşullu soru' in lines[i]:
                        i += 1

                    # Next non-blank: conditional question
                    while i < end_idx and not lines[i]:
                        i += 1

                    if i < end_idx:
                        cond_line = lines[i]
                        cond_type = detect_question_type(cond_line) or 'single'
                        cond_text = ''
                        if '→' in cond_line:
                            cond_text = cond_line.split('→', 1)[1].strip()
                        elif '  —  ' in cond_line:
                            cond_text = cond_line.split('  —  ', 1)[1].strip()
                        else:
                            cond_text = cond_line
                        i += 1

                        cond_q = {
                            'text_tr': cond_text,
                            'question_type': cond_type,
                            'choices': [],
                            'numerical_thresholds': None,
                            'bonus_points': 0,
                        }
                        # Parse conditional body
                        while i < end_idx:
                            cln = lines[i]
                            if not cln:
                                i += 1
                                continue
                            if number_pat.match(cln):
                                break
                            if should_skip(cln):
                                if '📎' in cln:
                                    cond_q['bonus_points'] += extract_bonus_pts(cln)
                                i += 1
                                continue
                            if is_threshold_header(cln):
                                i += 1
                                thresholds, i = parse_numerical_thresholds(lines, i)
                                cond_q['numerical_thresholds'] = thresholds
                                continue
                            if re.match(r'^[A-D]\.\s+', cln) or re.match(r'^•\s+', cln):
                                choices, i = parse_choices_block(lines, i)
                                cond_q['choices'] = choices
                                continue
                            if re.match(r'^Toplam max \d+', cln):
                                i += 1
                                continue
                            i += 1
                        q['conditional'] = cond_q
                    continue

                # "Seçenekler:" binary line
                if ln.startswith('Seçenekler:'):
                    # Parse inline Evet/Hayır from "Seçenekler: Evet  |  Hayır ..."
                    parts_raw = ln.replace('Seçenekler:', '').split('|')
                    q['choices'] = []
                    for idx, part in enumerate(parts_raw):
                        part = part.strip()
                        if part:
                            score = 1 if idx == 0 else 0
                            q['choices'].append({
                                'text_tr': part,
                                'score': score,
                                'order': idx
                            })
                    i += 1
                    continue

                # "Dallanma mantığı:" table — parse yes/no score rows
                # Format after "yes"/"no" rows:
                # "yes"\n"6 pt" or "0 pt"
                # handled as we skip header rows but read score cells
                # Typically these look like:
                #   "yes"  → score line or implied Evet 1 / Hayır 0
                # We handle these via binary default choices; skip the table rows
                if ln in ('"yes"', '"no"', 'yes', 'no'):
                    i += 1
                    continue

                # Score cell after "yes"/"no": "6 pt" or "0 pt — ..."
                if re.match(r'^\d+ pt', ln):
                    i += 1
                    continue

                # Choice lines
                if re.match(r'^[A-D]\.\s+', ln) or re.match(r'^•\s+', ln):
                    choices, i = parse_choices_block(lines, i)
                    q['choices'] = choices
                    continue

                i += 1

        except Exception as exc:
            print(f"  WARNING: Error parsing sector question {q_code}: {exc}")

        # Fill default binary choices if none parsed
        if q['question_type'] == 'binary' and not q['choices']:
            q['choices'] = [
                {'text_tr': 'Evet', 'score': 1, 'order': 0},
                {'text_tr': 'Hayır / Uygulanamaz', 'score': 0, 'order': 1},
            ]

        questions.append(q)

    return questions


# ---------------------------------------------------------------------------
# DB loaders
# ---------------------------------------------------------------------------

def load_criteria_to_survey(criteria_list, survey_id, dry_run=False):
    """
    Delete existing Category/Question/Choice records for survey_id,
    then create new ones from criteria_list.
    Returns (n_criteria, n_questions, n_choices).
    """
    survey = Survey.objects.get(id=survey_id)

    if not dry_run:
        Category.objects.filter(survey=survey).delete()

    n_criteria = 0
    n_questions = 0
    n_choices = 0

    LAYER_ORDER = {'P': 10, 'I': 20, 'M': 30, 'R': 40}

    for crit in criteria_list:
        try:
            max_score = crit['max_pts']
            cat_name = crit['code']
            cat_name_en = crit['name']

            if not dry_run:
                category = Category.objects.create(
                    survey=survey,
                    name=cat_name,
                    name_en=cat_name_en,
                    order=n_criteria,
                    max_score=max_score,
                )
            n_criteria += 1

            q_count = 0
            c_count = 0

            # GATE question
            if crit['has_gate']:
                gate_text = crit['gate_text']
                if not dry_run:
                    gate_q = Question.objects.create(
                        survey=survey,
                        category=category,
                        text=gate_text,
                        text_tr=gate_text,
                        text_en='',
                        question_type='binary',
                        order=0,
                        is_gate=True,
                        criterion_code=crit['code'],
                        layer='GATE',
                        numerical_thresholds=None,
                        bonus_points=0,
                    )
                    # Gate choices: Evet=1, Hayır=0
                    Choice.objects.create(
                        question=gate_q,
                        text='Evet',
                        text_tr='Evet',
                        text_en='Yes',
                        score=1,
                        order=0,
                    )
                    Choice.objects.create(
                        question=gate_q,
                        text='Hayır',
                        text_tr='Hayır',
                        text_en='No',
                        score=0,
                        order=1,
                    )
                n_questions += 1
                n_choices += 2
                q_count += 1
                c_count += 2

            # PDCA layers
            for layer_code, layer_data in crit['layers'].items():
                order = LAYER_ORDER.get(layer_code, 50)
                q_type = layer_data['question_type']
                bonus = layer_data.get('bonus_points', 0)

                if not dry_run:
                    layer_q = Question.objects.create(
                        survey=survey,
                        category=category,
                        text=layer_data['text_tr'],
                        text_tr=layer_data['text_tr'],
                        text_en='',
                        question_type=q_type,
                        order=order,
                        is_gate=False,
                        criterion_code=crit['code'],
                        layer=layer_code,
                        numerical_thresholds=layer_data['numerical_thresholds'],
                        bonus_points=bonus,
                    )

                    # Choices
                    for ch in layer_data['choices']:
                        Choice.objects.create(
                            question=layer_q,
                            text=ch['text_tr'],
                            text_tr=ch['text_tr'],
                            text_en='',
                            score=ch['score'],
                            order=ch['order'],
                        )
                        n_choices += 1
                        c_count += 1

                else:
                    n_choices += len(layer_data['choices'])
                    c_count += len(layer_data['choices'])

                n_questions += 1
                q_count += 1

                # Conditional
                cond = layer_data.get('conditional')
                if cond:
                    cond_bonus = cond.get('bonus_points', 0)
                    if not dry_run:
                        cond_q = Question.objects.create(
                            survey=survey,
                            category=category,
                            text=cond['text_tr'],
                            text_tr=cond['text_tr'],
                            text_en='',
                            question_type=cond['question_type'],
                            order=order + 5,
                            is_gate=False,
                            criterion_code=crit['code'],
                            layer='CONDITIONAL',
                            numerical_thresholds=cond.get('numerical_thresholds'),
                            conditional_on_question=layer_q,
                            conditional_on_min_score=1,
                            bonus_points=cond_bonus,
                        )
                        for ch in cond.get('choices', []):
                            Choice.objects.create(
                                question=cond_q,
                                text=ch['text_tr'],
                                text_tr=ch['text_tr'],
                                text_en='',
                                score=ch['score'],
                                order=ch['order'],
                            )
                            n_choices += 1
                            c_count += 1
                    else:
                        n_choices += len(cond.get('choices', []))
                        c_count += len(cond.get('choices', []))

                    n_questions += 1
                    q_count += 1

            print(f"  {crit['code']} {crit['name']} — {q_count} questions, {c_count} choices")

        except Exception as exc:
            import traceback
            print(f"  ERROR loading criterion {crit.get('code', '?')}: {exc}")
            traceback.print_exc()

    return n_criteria, n_questions, n_choices


def load_sector_to_survey(questions_list, survey_id, dry_run=False):
    """
    Delete existing Category/Question/Choice for survey_id,
    then create a single Category for the sector and load all questions.
    Returns (n_questions, n_choices).
    """
    survey = Survey.objects.get(id=survey_id)

    if not dry_run:
        Category.objects.filter(survey=survey).delete()

    if not questions_list:
        return 0, 0

    # Compute max_score = sum of all question max_pt values
    total_max = sum(q.get('max_pts', 0) for q in questions_list)

    n_questions = 0
    n_choices = 0

    if not dry_run:
        category = Category.objects.create(
            survey=survey,
            name=survey.name,
            name_en=survey.name,
            order=0,
            max_score=total_max,
        )

    for q in questions_list:
        try:
            bonus = q.get('bonus_points', 0)
            if not dry_run:
                db_q = Question.objects.create(
                    survey=survey,
                    category=category,
                    text=q['text_tr'],
                    text_tr=q['text_tr'],
                    text_en='',
                    question_type=q['question_type'],
                    order=q['number'] * 10,
                    is_gate=False,
                    criterion_code=q['code'],
                    layer='',
                    numerical_thresholds=q.get('numerical_thresholds'),
                    bonus_points=bonus,
                )
                for ch in q.get('choices', []):
                    Choice.objects.create(
                        question=db_q,
                        text=ch['text_tr'],
                        text_tr=ch['text_tr'],
                        text_en='',
                        score=ch['score'],
                        order=ch['order'],
                    )
                    n_choices += 1

                # Conditional question
                if q.get('has_conditional') and q.get('conditional'):
                    cond = q['conditional']
                    cond_bonus = cond.get('bonus_points', 0)
                    cond_db = Question.objects.create(
                        survey=survey,
                        category=category,
                        text=cond['text_tr'],
                        text_tr=cond['text_tr'],
                        text_en='',
                        question_type=cond['question_type'],
                        order=q['number'] * 10 + 5,
                        is_gate=False,
                        criterion_code=q['code'],
                        layer='CONDITIONAL',
                        numerical_thresholds=cond.get('numerical_thresholds'),
                        conditional_on_question=db_q,
                        conditional_on_min_score=1,
                        bonus_points=cond_bonus,
                    )
                    for ch in cond.get('choices', []):
                        Choice.objects.create(
                            question=cond_db,
                            text=ch['text_tr'],
                            text_tr=ch['text_tr'],
                            text_en='',
                            score=ch['score'],
                            order=ch['order'],
                        )
                        n_choices += 1
                    n_questions += 1

            else:
                n_choices += len(q.get('choices', []))
                if q.get('has_conditional') and q.get('conditional'):
                    n_choices += len(q['conditional'].get('choices', []))
                    n_questions += 1

            n_questions += 1

        except Exception as exc:
            import traceback
            print(f"  ERROR loading sector question {q.get('code', '?')}: {exc}")
            traceback.print_exc()

    return n_questions, n_choices


# ---------------------------------------------------------------------------
# Management command
# ---------------------------------------------------------------------------

class Command(BaseCommand):
    help = "Parse the GRI question bank text file and load all questions into the database."

    def add_arguments(self, parser):
        parser.add_argument(
            '--file',
            default=DEFAULT_FILE,
            help=f'Path to gri_full.txt (default: {DEFAULT_FILE})',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            default=False,
            help='Parse only; do not write to the database.',
        )
        parser.add_argument(
            '--section',
            default=None,
            help=(
                'Load only a specific section. '
                'Options: governance, environment, social, economic, '
                'agriculture, energy, financial, manufacturing, '
                'construction, healthcare, technology, retail'
            ),
        )

    def handle(self, *args, **options):
        filepath = options['file']
        dry_run = options['dry_run']
        section_filter = (options['section'] or '').lower()

        if not os.path.exists(filepath):
            raise CommandError(f"File not found: {filepath}")

        # Disconnect auto-translation signals during bulk load to avoid SQLite locking
        from django.db.models.signals import post_save
        post_save.disconnect(dispatch_uid=None)
        # Disconnect all receivers so background threads don't race with our writes
        _saved_receivers = post_save.receivers[:]
        post_save.receivers = []

        self.stdout.write(f"Reading {filepath} ...")
        lines = lines_from_file(filepath)
        self.stdout.write(f"  {len(lines)} lines loaded.\n")

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN — no database changes will be made.\n"))

        total_criteria = 0
        total_questions = 0
        total_choices = 0

        # ---- Core criteria ----
        core_label_map = {
            'governance': 0,
            'environment': 1,
            'social': 2,
            'economic': 3,
        }

        for label, code_pattern, start, end, survey_id in CORE_SECTIONS:
            label_lower = label.lower()
            if section_filter and section_filter not in label_lower:
                continue

            self.stdout.write(f"Loading {label} (lines {start}–{end}, survey_id={survey_id})...")
            criteria = parse_core_criteria(lines, start, end, code_pattern)
            self.stdout.write(f"  Parsed {len(criteria)} criteria.")

            with transaction.atomic():
                nc, nq, nch = load_criteria_to_survey(criteria, survey_id, dry_run=dry_run)

            total_criteria += nc
            total_questions += nq
            total_choices += nch

        # ---- Sector modules ----
        for label, prefix, start, end, survey_id in SECTOR_SECTIONS:
            label_lower = label.lower()
            if section_filter and section_filter not in label_lower:
                continue

            self.stdout.write(f"Loading {label} sector (lines {start}–{end}, survey_id={survey_id})...")
            qs = parse_sector_questions(lines, start, end)
            self.stdout.write(f"  Parsed {len(qs)} questions.")

            with transaction.atomic():
                nq, nch = load_sector_to_survey(qs, survey_id, dry_run=dry_run)

            total_questions += nq
            total_choices += nch
            print(f"  {label}: {nq} questions, {nch} choices")

        # Restore signals
        post_save.receivers = _saved_receivers

        self.stdout.write(
            self.style.SUCCESS(
                f"\nDONE: {total_criteria} criteria, "
                f"{total_questions} questions, "
                f"{total_choices} choices loaded."
            )
        )
