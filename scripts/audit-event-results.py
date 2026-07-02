#!/usr/bin/env python3
"""Audit result completeness for all HRR events via local or deployed API."""

from __future__ import annotations

import json
import sys
import urllib.request

EVENTS = [
    "grand", "remenham", "lp", "bridge", "thames", "wargrave", "temple", "island",
    "pe", "prince-philip", "stewards", "town", "visitors", "wyfold", "queen-mother",
    "princess-grace", "pow", "princess-of-wales", "danesfield", "queen-victoria",
    "fawley", "diamond-jubilee", "britannia", "prince-albert", "goblets",
    "hambleden-pairs", "double-sculls", "stonor", "diamond", "princess-royal",
]


def main() -> int:
    base = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
    issues = 0

    print(f"Auditing result completeness from {base}\n")

    for event_id in EVENTS:
        url = f"{base.rstrip('/')}/api/bracket/{event_id}"
        try:
            with urllib.request.urlopen(url, timeout=120) as response:
                data = json.loads(response.read())
        except Exception as exc:  # noqa: BLE001
            print(f"[ERROR] {event_id}: {exc}")
            issues += 1
            continue

        audit = data.get("resultAudit") or {}
        if audit.get("isComplete", True):
            print(f"[OK] {event_id}: {audit.get('completeCount', 0)} complete")
            continue

        issues += 1
        print(f"[MISSING] {event_id}:")
        for warning in audit.get("warnings", []):
            print(f"  - {warning}")

    print(f"\nDone. Events with issues: {issues}")
    return 1 if issues else 0


if __name__ == "__main__":
    raise SystemExit(main())
