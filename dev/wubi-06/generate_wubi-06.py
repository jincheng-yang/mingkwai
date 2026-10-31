"""Generate a char/key1/key2 CSV from the shared character list and Wubi tables."""

import csv
from pathlib import Path
import re


def generate_code_table():
    scheme_dir = Path(__file__).resolve().parent
    character_path = scheme_dir.parent / "gb2312.txt"
    output_path = scheme_dir / "wubi-06-code.csv"
    characters = character_path.read_text(encoding="utf-8-sig").splitlines()
    if not characters or any(len(char) != 1 for char in characters):
        raise ValueError(f"Expected one character per line in {character_path}")
    wanted = set(characters)
    if len(wanted) != len(characters):
        raise ValueError(f"Duplicate characters in {character_path}")

    # Match the notebook: prefer the first entry in the short-code table,
    # then use the full-code table for characters not already found.
    codes = {}
    for name in ("wmwbh06jm.dat.txt", "wmwbh06qm.dat.txt"):
        with (scheme_dir / name).open(encoding="utf-16", newline="") as stream:
            for row in csv.DictReader(stream, delimiter="\t"):
                char = row["words"]
                if char not in wanted or char in codes:
                    continue
                # csv preserves the valid Wubi code "nan" for 屉 as a string.
                code = row["keys"].strip().lower()
                if not re.fullmatch(r"[a-z]{1,4}", code):
                    raise ValueError(f"Invalid Wubi code for {char!r} in {name}: {code!r}")
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
