"""Generate char/key1/key2 CSV from the shared characters and local Wubi 98 table."""

import csv
from pathlib import Path
import re


def generate_code_table():
    scheme_dir = Path(__file__).resolve().parent
    character_path = scheme_dir.parent / "gb2312.txt"
    source_path = scheme_dir / "wubi-98-source.tsv"
    output_path = scheme_dir / "wubi-98-code.csv"
    characters = character_path.read_text(encoding="utf-8-sig").splitlines()
    if not characters or any(len(char) != 1 for char in characters):
        raise ValueError(f"Expected one character per line in {character_path}")
    wanted = set(characters)
    if len(wanted) != len(characters):
        raise ValueError(f"Duplicate characters in {character_path}")

    # Prefer a short code; keep upstream order when equally short codes exist.
    codes = {}
    with source_path.open(encoding="utf-8", newline="") as stream:
        reader = csv.DictReader(stream, delimiter="\t")
        if reader.fieldnames != ["char", "code"]:
            raise ValueError(f"Expected char/code columns in {source_path}")
        for row in reader:
            char = row["char"]
            if char not in wanted:
                continue
            # csv preserves the valid Wubi code "nan" for 屉 as a string.
            code = row["code"]
            if not re.fullmatch(r"[a-z]{1,4}", code):
                raise ValueError(f"Invalid Wubi code for {char!r}: {code!r}")
            if char not in codes or len(code) < len(codes[char]):
                codes[char] = code

    missing = [char for char in characters if char not in codes]
    if missing:
        raise ValueError(f"Missing Wubi codes: {''.join(missing)}")

    with output_path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.writer(stream, lineterminator="\n")
        writer.writerow(("char", "key1", "key2"))
        for char in characters:
            code = codes[char]
            writer.writerow((char, code[0].upper(), code[1] if len(code) > 1 else code[0]))
    return output_path, len(characters)


if __name__ == "__main__":
    path, count = generate_code_table()
    print(f"Wrote {count} character codes to {path}")
