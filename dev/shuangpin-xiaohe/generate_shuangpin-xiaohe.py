"""Generate a char/key1/key2 Xiaohe CSV in the shared character-list order.

Readings come from dev/gb2312/zipin.csv, with pypinyin filling missing readings.
Distinct alternate codes are kept as separate rows, matching the Xiaohe notebook.
Install the supplement with: python3 -m pip install pypinyin==0.55.0
"""

import csv
from pathlib import Path
import re
import unicodedata


# Xiaohe layout, as used in mingkuai-shuangpin.ipynb and Rime's
# https://github.com/rime/rime-double-pinyin/blob/master/double_pinyin_flypy.schema.yaml
INITIAL_KEYS = {"zh": "v", "ch": "i", "sh": "u"}
FINAL_KEYS = {
    "a": "a", "o": "o", "e": "e", "i": "i", "u": "u", "v": "v",
    "ai": "d", "ei": "w", "ao": "c", "ou": "z", "an": "j", "en": "f",
    "ang": "h", "eng": "g", "ong": "s", "ia": "x", "ie": "p", "iao": "n",
    "iu": "q", "ian": "m", "in": "b", "iang": "l", "ing": "k", "iong": "s",
    "ua": "x", "uo": "o", "uai": "k", "ui": "v", "uan": "r", "un": "y",
    "uang": "l", "ue": "t", "ve": "t",
}


def xiaohe_code(raw):
    syllable = unicodedata.normalize("NFD", raw.strip().lower().replace("u:", "v"))
    syllable = syllable.replace("u\u0308", "v")
    syllable = "".join(char for char in syllable
                       if not unicodedata.combining(char))
    syllable = re.sub(r"[1-5]$", "", syllable)
    if not re.fullmatch(r"[a-z]+", syllable):
        raise ValueError(f"Invalid single-syllable pinyin: {raw!r}")
    if syllable in ("a", "o", "e"):
        return syllable * 2
    if syllable.startswith(("a", "o", "e")):
        if len(syllable) == 2:
            return syllable
        if syllable in ("ang", "eng", "ong"):
            return {"ang": "ah", "eng": "eg", "ong": "os"}[syllable]
        raise ValueError(f"Unsupported zero-initial syllable: {raw!r}")
    initial = next((key for key in INITIAL_KEYS if syllable.startswith(key)), syllable[0])
    final = syllable[len(initial):]
    if initial not in INITIAL_KEYS and initial not in "bpmfdtnlgkhjqxrzcswy":
        raise ValueError(f"Unsupported initial: {raw!r}")
    if final not in FINAL_KEYS:
        raise ValueError(f"Unsupported final: {raw!r}")
    return INITIAL_KEYS.get(initial, initial) + FINAL_KEYS[final]


def reading_codes(readings):
    codes = []
    for reading in readings:
        try:
            code = xiaohe_code(reading)
        except ValueError:
            # Match the notebook: omit nonstandard alternatives such as
            # "ge1ge", "ng", and "hng" rather than inventing a key mapping.
            continue
        if code not in codes:
            codes.append(code)
    return codes


def generate_code_table():
    scheme_dir = Path(__file__).resolve().parent
    character_path = scheme_dir.parent / "gb2312.txt"
    reading_path = scheme_dir.parent / "gb2312" / "zipin.csv"
    output_path = scheme_dir / "shuangpin-xiaohe-code.csv"
    characters = character_path.read_text(encoding="utf-8-sig").splitlines()
    if not characters or any(len(char) != 1 for char in characters):
        raise ValueError(f"Expected one character per line in {character_path}")
    if len(set(characters)) != len(characters):
        raise ValueError(f"Duplicate characters in {character_path}")

    with reading_path.open(encoding="utf-8", newline="") as stream:
        readings = {row["Character"]: row["Pinyin"].split("/")
                    for row in csv.DictReader(stream, delimiter="\t")}

    rows = []
    missing = []
    for char in characters:
        codes = reading_codes(readings.get(char, []))
        if not codes:
            try:
                from pypinyin import Style, pinyin
            except ImportError as error:
                raise ImportError("Install missing-reading support: python3 -m pip install pypinyin==0.55.0") from error
            codes = reading_codes(pinyin(char, style=Style.NORMAL, heteronym=True, errors=lambda _: [""])[0])
        if not codes:
            missing.append(char)
        rows.extend((char, code[0].upper(), code[1]) for code in codes)
    if missing:
        raise ValueError(f"Missing encodable Xiaohe readings: {''.join(missing)}")

    with output_path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.writer(stream, lineterminator="\n")
        writer.writerow(("char", "key1", "key2"))
        writer.writerows(rows)
    return output_path, len(rows)


if __name__ == "__main__":
    path, count = generate_code_table()
    print(f"Wrote {count} character codes to {path}")
