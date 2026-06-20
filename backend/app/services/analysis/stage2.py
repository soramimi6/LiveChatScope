import sqlite3


def _moving_average(values: list[int], window: int) -> list[float]:
    if not values:
        return []
    result: list[float] = []
    for idx in range(len(values)):
        start = max(0, idx - window + 1)
        chunk = values[start : idx + 1]
        result.append(sum(chunk) / len(chunk))
    return result


def _merge_candidates(candidates: list[dict], merge_window_sec: int) -> list[dict]:
    if not candidates:
        return []
    sorted_by_time = sorted(candidates, key=lambda c: c["bucket_start_sec"])
    clusters: list[list[dict]] = [[sorted_by_time[0]]]
    for candidate in sorted_by_time[1:]:
        last_cluster = clusters[-1]
        cluster_end = max(item["bucket_start_sec"] for item in last_cluster)
        if candidate["bucket_start_sec"] - cluster_end <= merge_window_sec:
            last_cluster.append(candidate)
        else:
            clusters.append([candidate])

    merged: list[dict] = []
    for cluster in clusters:
        peak = max(cluster, key=lambda c: (c["score"], c["count"]))
        merged.append(peak)
    return merged


def run_stage2_highlights(conn: sqlite3.Connection, video_id: str, params: dict) -> None:
    """Detect density spikes and persist highlight clip candidates."""
    global_cfg = params.get("global", {})
    stage2 = params.get("stage2", {})
    clip_padding_sec = int(global_cfg.get("clip_padding_sec", 30))
    top_n = int(stage2.get("highlight_top_n", 10))
    ma_buckets = int(stage2.get("highlight_moving_avg_buckets", 5))
    merge_window_sec = int(stage2.get("highlight_merge_window_sec", 120))
    min_score = float(stage2.get("highlight_min_score", 1.5))
    ma_floor = float(stage2.get("highlight_moving_avg_floor", 1.0))

    conn.execute("DELETE FROM highlights WHERE video_id = ?", (video_id,))

    rows = conn.execute(
        """
        SELECT bucket_start_sec, bucket_sec, count
        FROM density_buckets
        WHERE video_id = ?
        ORDER BY bucket_start_sec ASC
        """,
        (video_id,),
    ).fetchall()
    if not rows:
        return

    counts = [int(row["count"]) for row in rows]
    moving_avgs = _moving_average(counts, ma_buckets)
    candidates: list[dict] = []

    for row, moving_avg in zip(rows, moving_avgs):
        count = int(row["count"])
        denom = max(moving_avg, ma_floor)
        score = count / denom if denom > 0 else 0.0
        if score < min_score:
            continue
        bucket_sec = int(row["bucket_sec"])
        bucket_start = int(row["bucket_start_sec"])
        time_center = bucket_start + bucket_sec / 2.0
        candidates.append(
            {
                "bucket_start_sec": bucket_start,
                "bucket_sec": bucket_sec,
                "count": count,
                "score": score,
                "time_in_seconds": time_center,
            }
        )

    merged = _merge_candidates(candidates, merge_window_sec)
    merged.sort(key=lambda c: (-c["score"], c["bucket_start_sec"]))
    selected = merged[:top_n]

    for rank, item in enumerate(selected, start=1):
        time_sec = item["time_in_seconds"]
        clip_start = max(0, int(time_sec) - clip_padding_sec)
        clip_end = int(time_sec) + clip_padding_sec
        conn.execute(
            """
            INSERT INTO highlights (
                video_id, rank, time_in_seconds, score, clip_start_sec, clip_end_sec
            ) VALUES (?, ?, ?, ?, ?, ?)
            """,
            (video_id, rank, time_sec, item["score"], clip_start, clip_end),
        )
