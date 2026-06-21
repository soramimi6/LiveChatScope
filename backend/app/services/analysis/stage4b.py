import sqlite3
from collections import defaultdict


def _detect_bursts(
    timeline_rows: list[sqlite3.Row],
    params: dict,
) -> list[dict]:
    """Detect keyword burst events from keyword_timeline rows."""
    stage4b = params.get("stage4b", {})
    min_peak_count = int(stage4b.get("burst_min_peak_count", 5))
    min_ratio = float(stage4b.get("burst_min_ratio", 3.0))
    baseline_buckets = int(stage4b.get("burst_baseline_buckets", 3))
    min_baseline = float(stage4b.get("burst_min_baseline", 1.0))
    top_n = int(stage4b.get("burst_top_n", 20))

    by_token: dict[str, list[tuple[int, int]]] = defaultdict(list)
    for row in timeline_rows:
        if hasattr(row, "keys"):
            token = row["token"]
            bucket_start = int(row["bucket_start_sec"])
            count = int(row["count"])
        else:
            token = row.token
            bucket_start = int(row.bucket_start_sec)
            count = int(row.count)
        by_token[token].append((bucket_start, count))

    candidates: list[dict] = []
    for token, series in by_token.items():
        series.sort(key=lambda item: item[0])
        for index, (bucket_start, peak_count) in enumerate(series):
            if index == 0 or peak_count < min_peak_count:
                continue

            previous_counts = [count for _, count in series[:index]]
            if previous_counts:
                window = previous_counts[-baseline_buckets:]
                baseline = sum(window) / len(window)
            else:
                baseline = 0.0

            baseline = max(baseline, min_baseline)
            ratio = peak_count / baseline
            if ratio < min_ratio:
                continue

            candidates.append(
                {
                    "token": token,
                    "peak_bucket_start_sec": bucket_start,
                    "peak_count": peak_count,
                    "baseline_count": round(baseline, 2),
                    "burst_ratio": round(ratio, 2),
                    "burst_score": round(peak_count * ratio, 2),
                }
            )

    candidates.sort(
        key=lambda item: (
            -item["burst_score"],
            -item["peak_count"],
            item["token"],
            item["peak_bucket_start_sec"],
        )
    )

    ranked = candidates[:top_n]
    for rank, item in enumerate(ranked, start=1):
        item["rank"] = rank
    return ranked


def run_stage4b_keyword_bursts(conn: sqlite3.Connection, video_id: str, params: dict) -> None:
    """Compute keyword burst events from keyword_timeline."""
    conn.execute("DELETE FROM keyword_bursts WHERE video_id = ?", (video_id,))

    timeline_rows = conn.execute(
        """
        SELECT bucket_start_sec, token, count
        FROM keyword_timeline
        WHERE video_id = ?
        ORDER BY token ASC, bucket_start_sec ASC
        """,
        (video_id,),
    ).fetchall()

    bursts = _detect_bursts(timeline_rows, params)
    if not bursts:
        return

    conn.executemany(
        """
        INSERT INTO keyword_bursts (
            video_id, token, peak_bucket_start_sec, peak_count,
            baseline_count, burst_ratio, burst_score, rank
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                video_id,
                burst["token"],
                burst["peak_bucket_start_sec"],
                burst["peak_count"],
                burst["baseline_count"],
                burst["burst_ratio"],
                burst["burst_score"],
                burst["rank"],
            )
            for burst in bursts
        ],
    )
