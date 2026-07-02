#!/usr/bin/env python3
"""Phase 4: downstream bye-format updates as new results arrive."""

from __future__ import annotations

import runpy
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Reuse phase 2/3 repairs — idempotent regeneration of all bye-format draws.
PHASE_SCRIPTS = [
    ROOT / "scripts" / "phase2-bye-draws.py",
    ROOT / "scripts" / "phase3-bye-draws.py",
]


def main() -> int:
    for script in PHASE_SCRIPTS:
        print(f"Running {script.relative_to(ROOT)}...")
        subprocess.run([sys.executable, str(script)], check=True)
    print("Phase 4 draw regeneration complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
