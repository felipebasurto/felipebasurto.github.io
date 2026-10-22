"""Writes the SurvivorTiers figures (method, sims, stats, tiers) from the published ranking.

    python3 src/diagrams/survivortiers/make_figures.py ranking.csv

ranking.csv is https://survivortiers.pages.dev/data/ranking.csv. The replay figure is separate.
"""
import csv
import statistics
import sys
import zlib
from pathlib import Path

OUT = Path(__file__).parent
SPRITES = "../../assets/experience/survivortiers/sprites/"
N = 966
TIERS = ["S", "A", "B", "C", "D"]
# Usual range (10th to 90th percentile) and the share that stays in its tier in at
# least 80% of the 2,000 repeats, from the site's meta.json.
STABILITY = {"S": (50, 24), "A": (70, 44), "B": (79, 71), "C": (86, 76), "D": (92, 48)}
CUTS = [(1, 30), (31, 120), (121, 320), (321, 620), (621, 966)]


def pct(rank):
    """Rank 1 is 100, rank 966 is 0."""
    return 100 * (N - rank) / (N - 1)


def sprite(dex, scale, cls="gm-sprite"):
    from PIL import Image  # only to read the sprite size

    w, h = Image.open(OUT.parents[2] / "public/assets/experience/survivortiers/sprites" / f"{dex}.png").size
    return f'<img class="{cls}" src="{SPRITES}{dex}.png" width="{w * scale}" height="{h * scale}" alt="" loading="lazy">'


def badge(tier):
    return f'<span class="gm-badge" style="--t: var(--tier-{tier})">{tier}</span>'


def hp_row(label, rank):
    p = pct(rank)
    level = "high" if p > 50 else "mid" if p > 20 else "low"
    return (f'<li class="gm-hp__row"><span class="gm-hp__label">{label}</span>'
            f'<span class="gm-hp__bar gm-hp__bar--{level}" style="--p: {p:.1f}"></span>'
            f'<span class="gm-hp__rank">#{rank}</span></li>')


def card(r):
    rows = "".join(hp_row(lbl, int(r[k])) for lbl, k in (("Sheet", "rank_sheet"), ("Games", "rank_early"), ("Late", "rank_late")))
    return (f'<div class="gm-card"><p class="gm-card__head">{sprite(int(r["dex"]), 2)}'
            f'<span class="gm-card__rank">#{r["rank"]}</span> <span class="gm-card__name">{r["name"]}</span> {badge(r["tier"])}</p>'
            f'<ul class="gm-hp">{rows}</ul></div>')


def method(rows):
    by = {r["name"]: r for r in rows}
    parts = [("Sheet", 45, "--syn-list"), ("Games", 30, "--syn-heading"), ("Late game", 25, "--syn-quote")]
    pillars = [("Stats", 45), ("Moves", 25), ("Types", 15), ("Size", 15)]
    top = "".join(f'<div class="gm-mix__part" style="--w: {w}; --c: var({c})"><span class="gm-mix__name">{n} <b>{w}%</b></span><span class="gm-mix__bar"></span></div>' for n, w, c in parts)
    sub = "".join(f'<div class="gm-mix__part" style="--w: {w}; --c: var(--syn-list)"><span class="gm-mix__bar gm-mix__bar--thin"></span><span class="gm-mix__name">{n} <b>{w}%</b></span></div>' for n, w in pillars)
    return f"""<figure class="fig gm gm-method">
<p class="gm__title">Three scores make the rank, and the weakest one counts most</p>
<p class="gm__sub">Weight of each score, then of each part of the sheet</p>
<div class="gm-mix">{top}</div>
<div class="gm-mix gm-mix--sub" aria-label="Inside the sheet">{sub}</div>
<div class="gm-cards">{card(by["Keldeo"])}{card(by["Magnemite"])}</div>
<figcaption class="fig__caption">Each bar is a percentile, full at rank 1 and empty at rank 966. Magnemite is #186 in games and #62 in the late game, but its sheet is #669, and the geometric mean drops it to #430. The whole calculation runs 2,000 times.</figcaption>
</figure>
"""


def jitter(dex, h):
    return 6 + (zlib.crc32(str(dex).encode()) % 1000) / 1000 * (h - 12)


def sims(rows):
    X0, X1, W, H = 15, 140, 600, 44
    x = lambda s: (s - X0) / (X1 - X0) * W
    kinds = [("projectile", "Projectile"), ("beam", "Beam"), ("nova", "Nova"), ("melee", "Melee")]
    notes = {"Solgaleo": "right", "Ninjask": "left"}
    lanes = []
    for key, label in kinds:
        rs = [r for r in rows if r["start_kind"] == key]
        med = statistics.median(float(r["start_median_s"]) for r in rs)
        dots = "".join(
            f'<rect x="{x(float(r["start_median_s"])) - 2:.1f}" y="{jitter(r["dex"], H) - 2:.1f}" width="4" height="4" fill="var(--tier-{r["tier"]})"/>'
            for r in sorted(rs, key=lambda r: TIERS.index(r["tier"]), reverse=True))
        ann = ""
        for r in rs:
            if r["name"] in notes:
                sx = x(float(r["start_median_s"]))
                ann += f'<rect x="{sx - 3.5:.1f}" y="{jitter(r["dex"], H) - 3.5:.1f}" width="7" height="7" fill="none" stroke="var(--text-strong)"/>'
        lanes.append(
            f'<div class="gm-strip__row"><span class="gm-strip__label">{label}<small>{len(rs)}</small></span>'
            f'<svg class="gm-strip__svg" viewBox="0 0 {W} {H}" role="img" aria-label="{label}: {len(rs)} Pokémon, median {med:.1f} seconds">'
            f'{dots}<line class="gm-strip__med" x1="{x(med):.1f}" x2="{x(med):.1f}" y1="0" y2="{H}"/>{ann}</svg>'
            f'<span class="gm-strip__med-label">{med:.1f} s</span></div>')
    sol = next(r for r in rows if r["name"] == "Solgaleo")
    nin = next(r for r in rows if r["name"] == "Ninjask")
    ticks = "".join(f'<span style="left: {x(s) / W * 100:.2f}%">{s} s</span>' for s in (30, 60, 90, 120))
    key = " ".join(badge(t) for t in TIERS)
    return f"""<figure class="fig gm gm-sims">
<p class="gm-counter"><span class="gm-counter__n">308,600</span> simulated games</p>
<p class="gm__title">A projectile start survives three times longer than melee</p>
<p class="gm__sub">Median survival of each Pokémon with its starting attack. One square per Pokémon, colored by tier {key}</p>
<div class="gm-strip">{"".join(lanes)}
<div class="gm-strip__row gm-strip__row--axis"><span></span><span class="gm-strip__axis">{ticks}</span><span></span></div>
</div>
<p class="gm-notes"><span>{sprite(791, 1)} Solgaleo lasts longest: {float(sol["start_median_s"]):.0f} s with Confusion.</span> <span>{sprite(291, 1)} Ninjask starts with Bug Bite, a melee attack, and lasts {float(nin["start_median_s"]):.1f} s.</span></p>
<figcaption class="fig__caption">200 games for each Pokémon with its starting attack and 200 with the best one it can learn. Eleven Pokémon that start with an orbit or boomerang attack are left out.</figcaption>
</figure>
"""


def stats():
    measures = [("Survival, best attack", 0.88, "var(--accent)"), ("Moves pillar", 0.65, "var(--syntax)"),
                ("Base stats pillar", 0.63, "var(--syntax)"), ("Type resistance", 0.27, "var(--syntax)")]
    # The classic Pokémon stat colors.
    base = [("Sp. Atk", 0.53, "#9db7f5"), ("Attack", 0.42, "#f5ac78"), ("Speed", 0.41, "#fa92b2"),
            ("HP", 0.39, "#ff5959"), ("Sp. Def", 0.32, "#a7db8d"), ("Defense", 0.25, "#fae078")]

    def rows(items):
        return "".join(
            f'<li class="gm-dots__row" style="--v: {v * 100:.0f}; --c: {c}"><span class="gm-dots__label">{n}</span>'
            f'<span class="gm-dots__track"><span class="gm-dots__dot"></span></span><span class="gm-dots__value">{v:.2f}</span></li>'
            for n, v, c in items)

    return f"""<figure class="fig gm gm-stats">
<p class="gm__title">Sp. Atk matters most, Defense least</p>
<p class="gm__sub">Rank correlation with the final rank. At 1, the measure alone would give the same order</p>
<p class="gm-dots__group">The scores</p>
<ul class="gm-dots">{rows(measures)}</ul>
<p class="gm-dots__group">Each base stat on its own</p>
<ul class="gm-dots">{rows(base)}</ul>
<p class="gm-dots__axis" aria-hidden="true"><span style="left: 0%">0</span><span style="left: 50%">0.5</span><span style="left: 100%">1</span></p>
<figcaption class="fig__caption">Spearman correlation over the 966 Pokémon. Speed helps because the bot survives by moving away from the swarm.</figcaption>
</figure>
"""


def tiers(rows):
    W, H, M = 600, 220, 6
    sx = lambda r: M + (r - 1) / (N - 1) * (W - 2 * M)
    sy = lambda r: M + (r - 1) / (N - 1) * (H - 2 * M)
    paths = []
    for t in TIERS:
        d = "".join(f'M{sx(int(r["rank"])):.1f} {sy(float(r["rank_p10"])):.1f}V{sy(float(r["rank_p90"])) + 0.6:.1f}'
                    for r in rows if r["tier"] == t)
        paths.append(f'<path d="{d}" stroke="var(--tier-{t})"/>')
    cuts = "".join(f'<line class="gm-cat__cut" x1="{sx(a - 0.5):.1f}" x2="{sx(a - 0.5):.1f}" y1="0" y2="{H}"/>' for a, _ in CUTS[1:])
    legend = "".join(
        f'<li>{badge(t)} <span><b>{STABILITY[t][0]}%</b> stay<br>ranks {a}–{b}<br>range ~{STABILITY[t][1]}</span></li>'
        for t, (a, b) in zip(TIERS, CUTS))
    return f"""<figure class="fig gm gm-tiers">
<p class="gm__title">The bottom of the list is settled, the top is not</p>
<p class="gm__sub">Each stroke is one Pokémon: its final rank across, and where it landed in the 2,000 repeats down (10th to 90th percentile)</p>
<div class="gm-cat">
<svg class="gm-cat__svg" viewBox="0 0 {W} {H}" role="img" aria-label="966 rank ranges along a diagonal. They are narrow in tier D, widest in tiers B and C, and S members swap places often.">{cuts}<g class="gm-cat__ranges">{"".join(paths)}</g></svg>
<span class="gm-cat__y gm-cat__y--top">rank 1</span><span class="gm-cat__y gm-cat__y--bottom">966</span>
<span class="gm-cat__note">{sprite(647, 1)} Keldeo is #1, with a usual range of 1 to 2</span>
</div>
<ul class="gm-tierlist">{legend}</ul>
<figcaption class="fig__caption">"Stay" is the share of each tier that lands in it in at least 80% of the repeats. "Range" is the usual spread in places. Tier S is only 30 Pokémon, so small differences decide who is 25th or 35th.</figcaption>
</figure>
"""


def main():
    rows = list(csv.DictReader(open(sys.argv[1], encoding="utf-8")))
    assert len(rows) == N
    (OUT / "method.html").write_text(method(rows))
    (OUT / "sims.html").write_text(sims(rows))
    (OUT / "stats.html").write_text(stats())
    (OUT / "tiers.html").write_text(tiers(rows))


if __name__ == "__main__":
    main()
