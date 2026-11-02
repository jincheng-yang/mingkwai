# Pinyin roller layout

Generate the cards and roller faces with:

```sh
python3 dev/pinyin/generate_pinyin.py
```

The generator uses only Python's standard library. It reads the Xiaohe code
CSV, keeps its character order and first-code choice, and writes a separate
pinyin layout. The six other input methods keep their existing layouts.

The physical grid remains 36 rows × 28 columns × 8 candidates. Overflow pages
change one mechanical key at a time, and hints point to those exact row or
column keys. Placement excludes transitions that could be mistaken for a
buffered pinyin continuation: `Z/C/S` to row `H`, or a physical final column to
its next spelling letter (for example `u` to `a`, `x` to `n` after `ua`, and `r`
to `g` after `uan`). Incomplete prefixes such as `io` and `ion` are included
using their literal mechanical positions. Nonletter row/column keys preserve
the buffer, so symbol rows cannot page to `H`, and numeric columns `9`/`0`
cannot page to any possible continuation letter either.

Validation runs before export. It checks 6,763 unique characters, no cell over
eight characters, safe hints, and a hint path from every character's primary
code to its final location. Export order matches the simulator's row/column
order; the roller text contains 288 lines of 28 characters each.
