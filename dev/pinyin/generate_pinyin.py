"""Build pinyin cards/rollers from Xiaohe codes without ambiguous paging hints.

Run from any directory with Python 3 (standard library only). The physical
36 x 28 x 8 grid stays unchanged. Character codes come from the existing Xiaohe
code table; only overflow placement differs from the double-pinyin scheme.
"""

import csv
from collections import Counter
from pathlib import Path
import runpy

HERE = Path(__file__).resolve().parent
XIAOHE = HERE.parent / "shuangpin-xiaohe"
ROW_KEYS = "GFDSA!HJKLM@TREWQ#YUIOP$NBVCX%^&*()Z"
COLUMN_KEYS = "qazwsxedcrfvtgbyhnujmik9ol0p"
PAGE_SIZE = 8
FINAL_KEYS = runpy.run_path(str(XIAOHE / "generate_shuangpin-xiaohe.py"))["FINAL_KEYS"]
ZERO_INITIAL_KEYS = {
    "a": "a", "ai": "i", "an": "n", "ang": "h", "ao": "o",
    "e": "e", "ei": "i", "en": "n", "eng": "g", "er": "r",
    "o": "o", "ou": "u", "ong": "s",
}


def continuation_edges():
    """A following literal letter must never also mean 'next overflow page'.

    Incomplete prefixes (io, ion, on) keep direct mechanical behavior, so their
    current physical column is the last literal key, until a complete final is
    recognized. Include the separate Xiaohe zero-initial spelling conventions.
    """
    forbidden = set()
    for spellings in (FINAL_KEYS, ZERO_INITIAL_KEYS):
        for sound in spellings:
            for length in range(1, len(sound)):
                prefix = sound[:length]
                current_column = spellings.get(prefix, prefix[-1])
                next_letter = sound[length]
                forbidden.add((current_column, next_letter))
    return frozenset(forbidden)


FORBIDDEN_COLUMN_EDGES = continuation_edges()
CONTINUATION_LETTERS = frozenset(target for _, target in FORBIDDEN_COLUMN_EDGES)
# Nonletter keys move the mechanism without touching the spelling buffer.
# A Z/C/S buffer can therefore still be pending on any symbol row; a buffered
# final can still be pending after moving to numeric column 9 or 0.
BUFFERED_INITIAL_ROWS = frozenset("ZCS" + "".join(row for row in ROW_KEYS if not row.isalpha()))


def paging_allowed(source, target):
    if source == target:
        return False
    if source[1] == target[1]:
        return not (source[0] in BUFFERED_INITIAL_ROWS and target[0] == "H")
    if source[0] == target[0]:
        if source[1] in "90" and target[1] in CONTINUATION_LETTERS:
            return False
        return (source[1], target[1]) not in FORBIDDEN_COLUMN_EDGES
    return False


def allocate(primary):
    positions = [(row, column) for row in ROW_KEYS for column in COLUMN_KEYS]
    order = {position: i for i, position in enumerate(positions)}
    cells = {position: primary.get(position, "") for position in positions}
    hints = {position: "" for position in positions}
    neighbors = {source: [target for target in positions if paging_allowed(source, target)]
                 for source in positions}

    def move(source, target):
        assert paging_allowed(source, target)
        assert len(cells[source]) > PAGE_SIZE and not hints[source]
        assert not hints[target]
        cells[target] += cells[source][PAGE_SIZE:]
        cells[source] = cells[source][:PAGE_SIZE]
        hints[source] = target[0] if source[0] != target[0] else target[1]

    # Split long lists into still-empty neighbors, favoring empty rows/columns
    # with most free cells. Unlike the notebook, every hop uses the same filter.
    while True:
        empty = {position for position in positions if not cells[position]}
        row_empty = Counter(row for row, _ in empty)
        col_empty = Counter(column for _, column in empty)
        moved = False
        for source in positions:
            if len(cells[source]) < PAGE_SIZE * 2 or hints[source]:
                continue
            options = [target for target in neighbors[source] if target in empty]
            if not options:
                continue
            options.sort(key=lambda target: (
                -(row_empty[target[0]] if target[1] == source[1] else col_empty[target[1]]),
                order[target]))
            target = options[0]
            move(source, target)
            empty.remove(target)
            row_empty[target[0]] -= 1
            col_empty[target[1]] -= 1
            moved = True
        if not moved:
            break

    # Place the list with fewest destinations first, exact/fullest fits first.
    # If direct capacity is exhausted, forward a suffix through one bridge page.
    while True:
        lengths = {position: len(chars) for position, chars in cells.items()}
        sources = [position for position in positions if lengths[position] > PAGE_SIZE]
        if not sources:
            return cells, hints
        options = {}
        for source in sources:
            overflow = lengths[source] - PAGE_SIZE
            targets = [target for target in neighbors[source]
                       if not hints[target] and lengths[target] + overflow <= PAGE_SIZE]
            targets.sort(key=lambda target: (PAGE_SIZE - lengths[target] - overflow, order[target]))
            if targets:
                options[source] = targets
        if options:
            source = min(options, key=lambda position: (len(options[position]), order[position]))
            move(source, options[source][0])
            continue
        paths = {}
        for source in sources:
            overflow = lengths[source] - PAGE_SIZE
            candidates = []
            for bridge in neighbors[source]:
                if hints[bridge] or lengths[bridge] > PAGE_SIZE:
                    continue
                forwarded = lengths[bridge] + overflow - PAGE_SIZE
                if forwarded <= 0:
                    continue
                for target in neighbors[bridge]:
                    if target == source or hints[target]:
                        continue
                    if lengths[target] + forwarded <= PAGE_SIZE:
                        candidates.append((bridge, target, forwarded))
            candidates.sort(key=lambda candidate: (
                PAGE_SIZE - lengths[candidate[1]] - candidate[2], candidate[2],
                order[candidate[0]], order[candidate[1]]))
            if candidates:
                paths[source] = candidates
        if not paths:
            raise ValueError(f"Unable to place overflow: {[(p, lengths[p]) for p in sources]}")
        source = min(paths, key=lambda position: (len(paths[position]), order[position]))
        bridge, target, _ = paths[source][0]
        move(source, bridge)
        move(bridge, target)


def hint_target(source, hint):
    if hint in ROW_KEYS:
        return hint, source[1]
    if hint in COLUMN_KEYS:
        return source[0], hint
    raise ValueError(f"Invalid page hint {hint!r} at {source}")


def validate(cells, hints, character_codes):
    assert len(cells) == len(ROW_KEYS) * len(COLUMN_KEYS) == 1008
    assert all(len(chars) <= PAGE_SIZE for chars in cells.values())
    actual = Counter("".join(cells.values()))
    assert actual == Counter(character_codes.keys()), "Lost, duplicated or invented candidates"
    assert len(actual) == 6763
    for source, hint in hints.items():
        if hint:
            assert paging_allowed(source, hint_target(source, hint)), (source, hint)
    for char, source in character_codes.items():
        current = source
        visited = set()
        while char not in cells[current]:
            assert current not in visited, f"Paging cycle for {char} at {current}"
            visited.add(current)
            hint = hints[current]
            assert hint, f"Unreachable candidate {char} from {source}"
            current = hint_target(current, hint)


def generate():
    with (XIAOHE / "shuangpin-xiaohe-code.csv").open(encoding="utf-8", newline="") as stream:
        code_rows = list(csv.DictReader(stream))
    character_codes = {}
    for row in code_rows:
        character_codes.setdefault(row["char"], (row["key1"], row["key2"]))
    primary = {}
    for char, position in character_codes.items():
        primary[position] = primary.get(position, "") + char
    cells, hints = allocate(primary)
    validate(cells, hints, character_codes)
    with (HERE / "pinyin-code.csv").open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, ("char", "key1", "key2"), lineterminator="\n")
        writer.writeheader()
        writer.writerows(code_rows)
    with (HERE / "pinyin.csv").open("w", encoding="utf-8", newline="") as stream:
        writer = csv.writer(stream, lineterminator="\n")
        writer.writerow(("key1", "key2", "chars", "original", "new", "hint"))
        for position, chars in cells.items():
            original_count = len(primary.get(position, ""))
            writer.writerow((*position, chars, chars[:original_count], chars[original_count:], hints[position]))
    lines = ["".join(cells[row, column][face:face + 1] or "　" for column in COLUMN_KEYS)
             for row in ROW_KEYS for face in range(PAGE_SIZE)]
    (HERE / "pinyin.txt").write_text("\n".join(lines), encoding="utf-8")
    print(f"Generated {len(cells)} cells, {sum(map(len, cells.values()))} candidates, "
          f"{sum(bool(hint) for hint in hints.values())} page hints; "
          f"{len(FORBIDDEN_COLUMN_EDGES)} forbidden continuation edges.")


if __name__ == "__main__":
    generate()
