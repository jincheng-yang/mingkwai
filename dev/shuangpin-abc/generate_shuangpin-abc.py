"""Generate Intelligent ABC double-pinyin char/key1/key2 codes in GB2312 order.

Readings come from dev/gb2312/zipin.csv, with pypinyin filling missing readings.
Distinct alternate codes are kept as separate rows. Install the supplement with:
python3 -m pip install pypinyin==0.55.0

Key assignments checked against Rime's Intelligent ABC schema (version 0.17):
https://github.com/rime/rime-double-pinyin/blob/master/double_pinyin_abc.schema.yaml
The upstream schema is GPL-3.0; this encoder uses its published layout facts,
without copying the schema's transformation implementation.
"""

import csv
from pathlib import Path
import re
import unicodedata


INITIAL_KEYS = {"zh": "a", "ch": "e", "sh": "v"}
FINAL_KEYS = {
    "a": "a", "o": "o", "e": "e", "i": "i", "u": "u", "v": "v",
    "ai": "l", "ei": "q", "ao": "k", "ou": "b", "an": "j", "en": "f",
    "ang": "h", "eng": "g", "ong": "s", "ia": "d", "ie": "x", "iao": "z",
    "iu": "r", "ian": "w", "in": "c", "iang": "t", "ing": "y", "iong": "s",
    "ua": "d", "uo": "o", "uai": "c", "ui": "m", "uan": "p", "un": "n",
    "uang": "t", "ue": "m", "ve": "m", "er": "r",
}
ZERO_INITIAL_FINALS = {"a", "o", "e", "ai", "ei", "ao", "ou", "an", "en",
                       "ang", "eng", "ong", "er"}


def abc_code(raw):
    syllable = unicodedata.normalize("NFD", raw.strip().lower().replace("u:", "v"))
    syllable = syllable.replace("u\u0308", "v")
    syllable = "".join(char for char in syllable
                       if not unicodedata.combining(char))
    syllable = re.sub(r"[1-5]$", "", syllable)
    if not re.fullmatch(r"[a-z]+", syllable):
        raise ValueError(f"Invalid single-syllable pinyin: {raw!r}")
    if syllable.startswith(("a", "o", "e")):
        if syllable not in ZERO_INITIAL_FINALS:
            raise ValueError(f"Unsupported zero-initial syllable: {raw!r}")
        return "o" + FINAL_KEYS[syllable]
    initial = next((key for key in INITIAL_KEYS if syllable.startswith(key)), syllable[0])
    final = syllable[len(initial):]
    if initial not in INITIAL_KEYS and initial not in "bpmfdtnlgkhjqxrzcswy":
        raise ValueError(f"Unsupported initial: {raw!r}")
    if final not in FINAL_KEYS or final == "er":
        raise ValueError(f"Unsupported final: {raw!r}")
    return INITIAL_KEYS.get(initial, initial) + FINAL_KEYS[final]


def reading_codes(readings):
    codes = []
    for reading in readings:
        try:
            code = abc_code(reading)
        except ValueError:
            # Match the Xiaohe generator: skip malformed or nonstandard
            # alternatives such as ge1ge, ng, and hng.
            continue
        if code not in codes:
            codes.append(code)
    return codes


def generate_code_table():
    scheme_dir = Path(__file__).resolve().parent
    character_path = scheme_dir.parent / "gb2312.txt"
    reading_path = scheme_dir.parent / "gb2312" / "zipin.csv"
    output_path = scheme_dir / "shuangpin-abc-code.csv"
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
        raise ValueError(f"Missing encodable ABC readings: {''.join(missing)}")

    with output_path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.writer(stream, lineterminator="\n")
        writer.writerow(("char", "key1", "key2"))
        writer.writerows(rows)
    return output_path, len(rows)


if __name__ == "__main__":
    path, count = generate_code_table()
    print(f"Wrote {count} character codes to {path}")
