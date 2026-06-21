#!/usr/bin/env python3
"""Evaluate topic block label quality for #6 tuning loops.

Usage:
  python scripts/evaluate_topic_labels.py --video-id uP51LV8d7mw
  python scripts/evaluate_topic_labels.py --video-id uP51LV8d7mw --baseline out/before.json --output out/after.json
"""

from __future__ import annotations

import argparse
import json
import re
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.config import settings  # noqa: E402


def _split_tokens(label: str) -> list[str]:
    return [part.strip() for part in label.split("/") if part.strip()]


def _is_short_token(token: str) -> bool:
    return len(token) <= 2


def _is_symbol_only(token: str) -> bool:
    return bool(re.fullmatch(r"[\W_]+", token, flags=re.UNICODE))


def evaluate_labels(labels: list[str]) -> dict:
    tokens: list[str] = []
    for label in labels:
        tokens.extend(_split_tokens(label))

    if not tokens:
        return {
            "block_count": len(labels),
            "token_count": 0,
            "short_token_rate": 0.0,
            "symbol_only_rate": 0.0,
            "avg_token_length": 0.0,
            "avg_label_length": 0.0,
            "labels": labels,
        }

    short = sum(1 for t in tokens if _is_short_token(t))
    sym = sum(1 for t in tokens if _is_symbol_only(t))

    return {
        "block_count": len(labels),
        "token_count": len(tokens),
        "short_token_rate": round(short / len(tokens), 4),
        "symbol_only_rate": round(sym / len(tokens), 4),
        "avg_token_length": round(sum(len(t) for t in tokens) / len(tokens), 2),
        "avg_label_length": round(sum(len(l) for l in labels) / len(labels), 2),
        "labels": labels,
    }


def load_labels_from_db(video_id: str) -> list[str]:
    db_path = settings.database_path
    if not db_path.exists():
        raise FileNotFoundError(f"database not found: {db_path}")

    conn = sqlite3.connect(db_path)
    rows = conn.execute(
        """
        SELECT label FROM topic_blocks
        WHERE video_id = ?
        ORDER BY block_index ASC
        """,
        (video_id,),
    ).fetchall()
    conn.close()
    return [row[0] for row in rows]


def compare_metrics(baseline: dict, current: dict) -> dict:
    return {
        "short_token_rate_delta": round(
            current["short_token_rate"] - baseline["short_token_rate"], 4
        ),
        "avg_token_length_delta": round(
            current["avg_token_length"] - baseline["avg_token_length"], 2
        ),
        "improved": (
            current["short_token_rate"] < baseline["short_token_rate"]
            and current["avg_token_length"] >= baseline["avg_token_length"]
        ),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Evaluate topic block labels")
    parser.add_argument("--video-id", required=True)
    parser.add_argument("--baseline", type=Path, help="Previous metrics JSON for comparison")
    parser.add_argument("--output", type=Path, help="Write metrics JSON here")
    args = parser.parse_args()

    labels = load_labels_from_db(args.video_id)
    metrics = {
        "video_id": args.video_id,
        "evaluated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        **evaluate_labels(labels),
    }

    if args.baseline and args.baseline.exists():
        baseline = json.loads(args.baseline.read_text(encoding="utf-8"))
        metrics["comparison"] = compare_metrics(baseline, metrics)

    text = json.dumps(metrics, ensure_ascii=False, indent=2)
    print(text)

    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(text + "\n", encoding="utf-8")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
