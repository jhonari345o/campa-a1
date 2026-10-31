"""Prepare a private, transactional Supabase import from the original handoff.
Usage: python3 scripts/ingest/prepare-infomedia.py SNAPSHOT --output /PRIVATE/import.sql
This tool does not connect to any service or publish source data.
"""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path


def prepare(source: Path, output: Path):
    repository = Path(__file__).resolve().parents[2]
    output = output.resolve()
    if output.is_relative_to(repository):
        raise ValueError("Save licensed data outside the repository.")
    raw = source.read_bytes()
    snapshot = json.loads(raw)
    categories = snapshot["categories"]
    if not isinstance(categories, dict) or not 1 <= len(categories) <= 1000:
        raise ValueError("Invalid category catalog.")
    digest = hashlib.sha256(raw).hexdigest()
    date = snapshot["dataThrough"]
    import datetime
    datetime.date.fromisoformat(date)
    def quote(value):
        return "'" + str(value).replace("'", "''") + "'"
    def validate(value):
        if isinstance(value, float) and not math.isfinite(value):
            raise ValueError("Non-finite source value.")
        if isinstance(value, dict):
            for item in value.values():
                validate(item)
        elif isinstance(value, list):
            for item in value:
                validate(item)
    sql = ["begin;", "-- Licensed source: private import only; never commit this file."]
    ids = set()
    periods = 0
    for key, category in sorted(categories.items()):
        category_id = "im_" + hashlib.sha256(key.encode()).hexdigest()[:24]
        if category_id in ids:
            raise ValueError("Duplicate category ID.")
        ids.add(category_id)
        source_periods = category["periods"]
        if not source_periods or len(source_periods) > 10:
            raise ValueError("Invalid periods.")
        if len({p["year"] for p in source_periods}) != len(source_periods):
            raise ValueError("Consolidate each year into one compatible period before import.")
        for period in source_periods:
            for field in ("year", "periodLabel", "sourceTarget", "totals", "mediaMix", "brands", "pressureContexts"):
                if field not in period:
                    raise ValueError("Missing source field: " + field)
            mix_total = sum(row["estimatedInvestment"] for row in period["mediaMix"])
            reported = period["totals"]["estimatedInvestment"]
            if abs(mix_total - reported) > max(1, reported * .00001):
                raise ValueError("Media total does not reconcile.")
        validate(source_periods)
        periods += len(source_periods)
        # Exclude raw paths, source metadata and the incompatible cross-media pressure index.
        payload = {"periods": [
            {field: period[field] for field in ("year", "periodLabel", "sourceTarget", "totals", "mediaMix", "brands", "pressureContexts")}
            for period in source_periods
        ]}
        label = category["displayName"].title()
        for token in ("Tv", "Gps", "Ups"):
            label = label.replace(token, token.upper())
        period_labels = [{"year": p["year"], "label": p["periodLabel"]} for p in sorted(source_periods, key=lambda p: p["year"], reverse=True)]
        sql.append("insert into public.infomedia_categories(id,label,periods) values (" + quote(category_id) + "," + quote(label) + "," + quote(json.dumps(period_labels, ensure_ascii=False)) + "::jsonb) on conflict(id) do update set label=excluded.label,periods=excluded.periods;")
        sql.append("insert into public.infomedia_research(category_id,data_through,payload,source_sha256) values (" + ",".join([
            quote(category_id), quote(date), quote(json.dumps(payload, ensure_ascii=False, separators=(",", ":"))) + "::jsonb", quote(digest)
        ]) + ") on conflict(category_id) do update set data_through=excluded.data_through,payload=excluded.payload,source_sha256=excluded.source_sha256,imported_at=now();")
    sql.append("commit;")
    output.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w") as file:
        file.write("\n".join(sql) + "\n")
    print(json.dumps({"categories": len(ids), "periods": periods, "dataThrough": date, "sourceSha256": digest, "bytes": output.stat().st_size}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("snapshot", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    prepare(args.snapshot, args.output)
