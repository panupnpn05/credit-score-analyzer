"""SOP store: parse, score, and persist the manual points-based scoring guideline.

docs/SCORING_SOP.md is the single source of truth. Only the '## Points Tables'
section is machine-editable; everything else (worked example, appendices) is
preserved byte-for-byte when saving.

Canonical data format (also the API/JSON format):

    {
        "base_score": 100.0,
        "categorical": [{"field": str, "value": str, "baseline": bool,
                         "points": float | None}, ...],
        "numeric":     [{"field": str, "band": str,
                         "points": float | None}, ...],
        "grades":      [{"grade": str, "min": float, "max": float}, ...],
        "decision":    [{"grade": str, "decision": str}, ...],
    }
"""

import math
import os
import tempfile
import threading

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOP_PATH = os.path.join(PROJECT_ROOT, "docs", "SCORING_SOP.md")

POINTS_SECTION_HEADING = "## Points Tables"

_lock = threading.Lock()


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------

def _clean_cell(cell):
    return cell.strip().replace("−", "-")  # normalize unicode minus


def _parse_points(cell):
    cell = _clean_cell(cell)
    if not cell:
        return None  # blank = unassigned
    try:
        return float(cell)
    except ValueError:
        return None


def _parse_band(label):
    """Return (kind, lo, hi) for a band label like '<12', '12-24', '>48', '1'."""
    label = _clean_cell(label)
    if label.startswith("<"):
        return ("lt", -math.inf, float(label[1:]))
    if label.startswith(">"):
        return ("gt", float(label[1:]), math.inf)
    if "-" in label[1:]:
        lo, hi = label.split("-", 1)
        return ("range", float(lo), float(hi))
    return ("eq", float(label), float(label))


def _band_matches(kind, lo, hi, value):
    if kind == "lt":
        return value < hi
    if kind == "gt":
        return value > lo
    if kind == "range":
        return lo <= value <= hi
    return value == lo


def _split_rows(line):
    return [_clean_cell(c) for c in line.strip().strip("|").split("|")]


def parse_sop(path=SOP_PATH):
    """Parse the editable points tables from the SOP markdown file."""
    with open(path, encoding="utf-8") as f:
        lines = f.read().splitlines()

    # Extract the '## Points Tables' section (up to the next level-2 heading)
    try:
        start = next(i for i, l in enumerate(lines) if l.startswith(POINTS_SECTION_HEADING))
    except StopIteration:
        raise ValueError(f"Section '{POINTS_SECTION_HEADING}' not found in {path}")
    end = next((i for i in range(start + 1, len(lines)) if lines[i].startswith("## ")), len(lines))
    section = lines[start + 1:end]

    sop = {
        "base_score": None,
        "categorical": [],  # {"field", "value", "baseline", "points"}
        "numeric": [],      # {"field", "band", "points"}
        "grades": [],       # {"grade", "min", "max"}
        "decision": [],     # {"grade", "decision"}
    }

    i = 0
    while i < len(section):
        if not section[i].strip().startswith("|"):
            i += 1
            continue
        block = []
        while i < len(section) and section[i].strip().startswith("|"):
            block.append(section[i])
            i += 1
        rows = [_split_rows(r) for r in block]
        header, data = rows[0], rows[2:]  # row 1 is the |---|---| separator
        if not data:
            continue

        if header == ["Parameter", "Value"]:
            for r in data:
                if r[0].lower() == "base score":
                    sop["base_score"] = float(r[1])
        elif header == ["Field", "Value", "Points"]:
            for r in data:
                value, baseline = r[1], False
                if value.endswith("*"):
                    value, baseline = value[:-1].strip(), True
                sop["categorical"].append({
                    "field": r[0], "value": value, "baseline": baseline,
                    "points": _parse_points(r[2]),
                })
        elif header == ["Field", "Band", "Points"]:
            for r in data:
                sop["numeric"].append({
                    "field": r[0], "band": r[1], "points": _parse_points(r[2]),
                })
        elif header == ["Grade", "Min score", "Max score"]:
            for r in data:
                sop["grades"].append({"grade": r[0], "min": float(r[1]), "max": float(r[2])})
        elif header == ["Grade", "Decision"]:
            for r in data:
                sop["decision"].append({"grade": r[0], "decision": r[1]})

    if sop["base_score"] is None:
        raise ValueError("Base score parameter not found in SOP")
    return sop


# ---------------------------------------------------------------------------
# Serialization (tables only; all other file content is preserved)
# ---------------------------------------------------------------------------

def _fmt_num(x):
    if x is None:
        return ""
    return str(int(x)) if float(x) == int(x) else str(x)


def _table_rows_for(header, sop):
    """Regenerate data rows for a known table header, in sop's row order."""
    if header == ["Parameter", "Value"]:
        return [["Base score", _fmt_num(sop["base_score"])]]
    if header == ["Field", "Value", "Points"]:
        return [[r["field"], r["value"] + (" *" if r.get("baseline") else ""),
                 _fmt_num(r["points"])] for r in sop["categorical"]]
    if header == ["Field", "Band", "Points"]:
        return [[r["field"], r["band"], _fmt_num(r["points"])] for r in sop["numeric"]]
    if header == ["Grade", "Min score", "Max score"]:
        return [[r["grade"], _fmt_num(r["min"]), _fmt_num(r["max"])] for r in sop["grades"]]
    if header == ["Grade", "Decision"]:
        return [[r["grade"], r["decision"]] for r in sop["decision"]]
    return None


def _render_section(lines, sop):
    """Replace table data rows within the Points Tables section, keep all prose."""
    out = []
    i = 0
    in_section = False
    while i < len(lines):
        line = lines[i]
        if line.startswith("## "):
            in_section = line.startswith(POINTS_SECTION_HEADING)
            out.append(line)
            i += 1
            continue
        if in_section and line.strip().startswith("|"):
            header = _split_rows(line)
            new_rows = _table_rows_for(header, sop)
            out.append(line)  # header
            if i + 1 < len(lines) and lines[i + 1].strip().startswith("|"):
                out.append(lines[i + 1])  # separator
                i += 2
            else:
                i += 1
            if new_rows is not None:
                for r in new_rows:
                    line_r = "| " + " | ".join(r) + " |"
                    if line_r.endswith("|  |"):  # blank last cell: '| a | b | |'
                        line_r = line_r[:-3] + " |"
                    out.append(line_r)
                while i < len(lines) and lines[i].strip().startswith("|"):
                    i += 1  # drop old data rows
            continue
        out.append(line)
        i += 1
    return out


def validate_sop(sop):
    """Raise ValueError with a human-readable message if the data is invalid."""
    try:
        base = float(sop["base_score"])
    except (TypeError, ValueError):
        raise ValueError("Base score must be a number")
    sop["base_score"] = base

    for r in sop.get("categorical", []):
        if not r.get("field") or not r.get("value"):
            raise ValueError("Categorical rows need both 'field' and 'value'")
        r["points"] = _to_points(r.get("points"))

    for r in sop.get("numeric", []):
        if not r.get("field") or not r.get("band"):
            raise ValueError("Numeric rows need both 'field' and 'band'")
        try:
            _parse_band(r["band"])  # raises on malformed labels
        except ValueError:
            raise ValueError(f"Invalid band label '{r['band']}' for field '{r['field']}' "
                             "(use forms like '<12', '12-24', '>48' or '1')")
        r["points"] = _to_points(r.get("points"))

    for r in sop.get("grades", []):
        try:
            r["min"], r["max"] = float(r["min"]), float(r["max"])
        except (TypeError, ValueError):
            raise ValueError(f"Grade '{r.get('grade')}' has non-numeric min/max")
        if r["min"] > r["max"]:
            raise ValueError(f"Grade '{r['grade']}': min is greater than max")

    for r in sop.get("decision", []):
        if not r.get("grade") or not r.get("decision"):
            raise ValueError("Decision rows need both 'grade' and 'decision'")


def _to_points(v):
    if v is None or v == "":
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        raise ValueError(f"Points must be a number, got '{v}'")


# ---------------------------------------------------------------------------
# Load / save
# ---------------------------------------------------------------------------

def load_sop(path=SOP_PATH):
    return parse_sop(path)


def save_sop(sop, path=SOP_PATH):
    """Validate + persist. Rewrites only table rows inside the Points Tables
    section; the rest of the markdown is preserved. Atomic via os.replace."""
    validate_sop(sop)
    with _lock:
        with open(path, encoding="utf-8") as f:
            lines = f.read().splitlines()
        new_lines = _render_section(lines, sop)
        fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), suffix=".md")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                f.write("\n".join(new_lines) + "\n")
            os.replace(tmp, path)
        except BaseException:
            os.unlink(tmp)
            raise
    return load_sop(path)


# ---------------------------------------------------------------------------
# Manual scoring (SOP tables only)
# ---------------------------------------------------------------------------

def score_manual(applicant, sop):
    """Return (total, details, warnings) using only the SOP tables.

    applicant: dict of field -> value (pandas row .to_dict() works too)
    details:   [(field, display_value, points, note)]
    """
    details, warnings = [], []
    total = sop["base_score"]
    handled = set()

    for r in sop["categorical"]:
        field, value = r["field"], r["value"]
        if field in handled:
            continue
        if field not in applicant or _is_missing(applicant[field]):
            handled.add(field)
            warnings.append(f"'{field}' missing in applicant data -> 0 points")
            details.append((field, "-", 0.0, "missing"))
            continue
        if str(applicant[field]) == value:
            handled.add(field)
            pts = r["points"] if r["points"] is not None else 0.0
            if r["points"] is None:
                warnings.append(f"'{field}' = '{value}' has no points assigned -> 0")
            total += pts
            details.append((field, value, pts, ""))

    for r in sop["numeric"]:
        field = r["field"]
        if field in handled:
            continue
        if field not in applicant or _is_missing(applicant[field]):
            handled.add(field)
            warnings.append(f"'{field}' missing in applicant data -> 0 points")
            details.append((field, "-", 0.0, "missing"))
            continue
        value = float(applicant[field])
        kind, lo, hi = _parse_band(r["band"])
        if _band_matches(kind, lo, hi, value):
            handled.add(field)
            pts = r["points"] if r["points"] is not None else 0.0
            if r["points"] is None:
                warnings.append(f"'{field}' = {value:g} (band '{r['band']}') has no points assigned -> 0")
            total += pts
            details.append((field, f"{value:g} (band {r['band']})", pts, ""))

    # fields present in applicant but not in SOP tables (informational only)
    known = {r["field"] for r in sop["categorical"]} | {r["field"] for r in sop["numeric"]}
    for field in applicant:
        if field not in known and field not in ("applicant_id", "default") \
                and not _is_missing(applicant[field]):
            warnings.append(f"'{field}' not in SOP tables -> ignored")

    return total, details, warnings


def _is_missing(v):
    return v is None or (isinstance(v, float) and math.isnan(v))


def manual_grade(total, sop):
    for r in sop["grades"]:
        if r["min"] <= total <= r["max"]:
            return r["grade"]
    return "?"


def manual_decision(grade, sop):
    for r in sop["decision"]:
        if r["grade"] == grade:
            return r["decision"]
    return "?"
