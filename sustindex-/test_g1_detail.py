"""Print full G1 structure to debug P/I/M/R layers."""
import sys, os, types, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

# Stub Django
for mod_name in ["django", "django.core", "django.core.management",
                  "django.core.management.base", "django.db",
                  "django.db.transaction", "questionnaire", "questionnaire.models"]:
    sys.modules[mod_name] = types.ModuleType(mod_name)

class BaseCommand: pass
class CommandError(Exception): pass
sys.modules["django.core.management.base"].BaseCommand = BaseCommand
sys.modules["django.core.management.base"].CommandError = CommandError

class _atomic:
    def __enter__(self): return self
    def __exit__(self,*a): pass
sys.modules["django.db.transaction"].atomic = _atomic

q_models = sys.modules["questionnaire.models"]
q_models.Survey = None
q_models.Category = None
q_models.Question = None
q_models.Choice = None

cmd_path = os.path.join(os.path.dirname(__file__),
    "questionnaire/management/commands/load_gri_bank.py")
ns = {}
exec(open(cmd_path).read(), ns)

lines_from_file     = ns["lines_from_file"]
parse_core_criteria = ns["parse_core_criteria"]
CORE_SECTIONS       = ns["CORE_SECTIONS"]
DEFAULT_FILE        = ns["DEFAULT_FILE"]

lines = lines_from_file(DEFAULT_FILE)

# Parse Governance (G1-G16)
label, code_pattern, start, end, survey_id = CORE_SECTIONS[0]  # Governance
criteria = parse_core_criteria(lines, start, end, code_pattern)

# Print first 3 criteria in detail
for c in criteria[:3]:
    print("=" * 70)
    print(f"CODE: {c['code']}  |  has_gate={c.get('has_gate')}  |  max_pts={c.get('max_pts')}")
    print(f"  Gate text: {c.get('gate_text','(none)')}")
    print(f"  Layers: {list(c.get('layers', {}).keys())}")
    for layer_code, lv in c.get("layers", {}).items():
        print(f"\n  [{layer_code}] {lv.get('layer_name','')}  q_type={lv.get('question_type','?')}  max_pts={lv.get('max_pts')}")
        print(f"       text: {lv.get('text_tr','')[:100]}")
        choices = lv.get("choices", [])
        print(f"       choices ({len(choices)}):")
        for ch in choices:
            print(f"         - {ch.get('text_tr','')[:60]}  score={ch.get('score')}")
        thresholds = lv.get("numerical_thresholds", [])
        if thresholds:
            print(f"       numerical_thresholds ({len(thresholds)}):")
            for t in thresholds:
                print(f"         {t['range']} → {t['score']}")
        cond = lv.get("conditional")
        if cond:
            print(f"       conditional: {cond}")

print("\n\n=== All G criteria with layer summary ===")
for c in criteria:
    layers = list(c.get("layers", {}).keys())
    gate = "GATE" if c.get("has_gate") else "    "
    print(f"  {c['code']:6s} {gate}  layers={layers}  pts={c.get('max_pts')}")
