"""Quick parse test — run from the project root with plain python (no Django needed)."""
import sys, os, re, types

# --------------- Stub out Django so imports don't fail ---------------
django_stub = types.ModuleType("django")
django_stub.setup = lambda: None
sys.modules["django"] = django_stub

core_stub = types.ModuleType("django.core")
mgmt_stub = types.ModuleType("django.core.management")
base_stub = types.ModuleType("django.core.management.base")
class BaseCommand:
    pass
class CommandError(Exception):
    pass
base_stub.BaseCommand = BaseCommand
base_stub.CommandError = CommandError
sys.modules["django.core"] = core_stub
sys.modules["django.core.management"] = mgmt_stub
sys.modules["django.core.management.base"] = base_stub

db_stub = types.ModuleType("django.db")
tx_stub = types.ModuleType("django.db.transaction")
class _atomic:
    def __enter__(self): return self
    def __exit__(self,*a): pass
tx_stub.atomic = _atomic
sys.modules["django.db"] = db_stub
sys.modules["django.db.transaction"] = tx_stub

q_stub = types.ModuleType("questionnaire")
q_models = types.ModuleType("questionnaire.models")
q_models.Survey = None
q_models.Category = None
q_models.Question = None
q_models.Choice = None
sys.modules["questionnaire"] = q_stub
sys.modules["questionnaire.models"] = q_models

# --------------- Load the command module ---------------
cmd_path = os.path.join(os.path.dirname(__file__),
    "questionnaire/management/commands/load_gri_bank.py")
ns = {}
exec(open(cmd_path).read(), ns)

lines_from_file    = ns["lines_from_file"]
parse_core_criteria = ns["parse_core_criteria"]
parse_sector_questions = ns["parse_sector_questions"]
CORE_SECTIONS      = ns["CORE_SECTIONS"]
SECTOR_SECTIONS    = ns["SECTOR_SECTIONS"]
DEFAULT_FILE       = ns["DEFAULT_FILE"]

# --------------- Run ---------------
print(f"Reading {DEFAULT_FILE} ...")
lines = lines_from_file(DEFAULT_FILE)
print(f"  {len(lines)} lines.\n")

print("=== Core sections ===")
for label, code_pattern, start, end, survey_id in CORE_SECTIONS:
    criteria = parse_core_criteria(lines, start, end, code_pattern)
    # Count questions and choices
    q_count = 0
    ch_count = 0
    for c in criteria:
        if c.get("has_gate"):
            q_count += 1
        for lv in c.get("layers", {}).values():
            if lv.get("text_tr"):
                q_count += 1
                ch_count += len(lv.get("choices", []))
    print(f"  {label:15s}  criteria={len(criteria):3d}  questions={q_count:4d}  choices={ch_count:4d}  [lines {start}–{end}]")
    # List missing
    expected = {"Governance": 16, "Environment": 14, "Social": 24, "Economic": 9}
    exp = expected.get(label)
    if exp and len(criteria) != exp:
        codes = [c["code"] for c in criteria]
        print(f"    *** Expected {exp}, got {len(criteria)}. Codes: {codes}")

print()
print("=== Sector sections ===")
for label, prefix, start, end, survey_id in SECTOR_SECTIONS:
    questions = parse_sector_questions(lines, start, end)
    ch_count = sum(len(q.get("choices", [])) for q in questions)
    print(f"  {label:15s}  questions={len(questions):3d}  choices={ch_count:4d}  [lines {start}–{end}]")
    if len(questions) != 12:
        codes = [q.get("code","?") for q in questions]
        print(f"    *** Expected 12, got {len(questions)}. Codes: {codes}")

print("\nDone.")
