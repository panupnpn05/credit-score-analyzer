---
name: AI Credit Scoring System
description: The Bound Logbook — an engineering lab-logbook console for a local credit-scoring system
colors:
  paper: "#f2efe7"
  paper-deep: "#e9e4d7"
  sheet: "#fdfcf7"
  ink: "#1f2a33"
  ink-soft: "#4d5f6b"
  ink-faint: "#5f707a"
  rule: "#cfd6d4"
  rule-strong: "#a4b2b4"
  graph: "#5b7a99"
  graph-deep: "#45607a"
  graph-soft: "#dde4ea"
  slab: "#1c262e"
  stamp: "#bf3f1f"
  stamp-deep: "#9e3318"
  stamp-soft: "#f8e9e0"
  ok: "#2e6b46"
  ok-soft: "#e7efe7"
  warn: "#8f6408"
  warn-soft: "#f3ecd8"
  bad: "#b03a1e"
  bad-soft: "#f6e7de"
typography:
  display:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "clamp(2.75rem, 5vw, 4.25rem)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.01em"
  verdict:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "clamp(2.5rem, 4.5vw, 3.75rem)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 800
    lineHeight: 1.3
    letterSpacing: "0.02em"
  body:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  label:
    fontFamily: "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace"
    fontSize: "0.6875rem"
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: "0.08em"
  entry:
    fontFamily: "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  base: "2px"
spacing:
  space-1: "0.375rem"
  space-2: "0.75rem"
  space-3: "1.125rem"
  space-4: "1.5rem"
  space-6: "2.25rem"
components:
  button-primary:
    backgroundColor: "{colors.stamp}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.base}"
    typography: "{typography.title}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.stamp-deep}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.base}"
    padding: "8px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.base}"
    padding: "8px 16px"
  stamp:
    backgroundColor: "transparent"
    textColor: "{colors.stamp}"
    rounded: "{rounded.base}"
    typography: "{typography.entry}"
    padding: "3px 9px"
  stamp-ok:
    backgroundColor: "transparent"
    textColor: "{colors.ok}"
    rounded: "{rounded.base}"
    padding: "3px 9px"
  field-input:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    rounded: "{rounded.base}"
    typography: "{typography.body}"
    padding: "7px 10px"
  index-tab-active:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.base}"
    typography: "{typography.entry}"
    padding: "9px 12px"
  nameplate:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.base}"
    typography: "{typography.label}"
    padding: "2px 7px"
---

# Design System: AI Credit Scoring System

## Overview

**Creative North Star: "The Bound Logbook"**

This console is a credit analyst's bound lab logbook. Everything sits on an uncoated paper desk (`#f2efe7`); the working surface is one open sheet (`#fdfcf7`), ruled with hairlines instead of carded into panels. Iron-gall ink (`#1f2a33`) carries the record; a single vermilion (`#bf3f1f`) is reserved for stamps, the active decision, and verification marks, so every consequential act reads as an impression pressed into the page. Graph blue (`#5b7a99`) draws the structure — page-edge tabs, rules, protective-factor evidence — the way a draftsman's grid sits under the ink.

Density is that of a working record: compact, ruled, initialed. Type is a bundled variable Archivo for the shell and display set against bundled JetBrains Mono for entries, readouts, numerals, and labels; nothing loads from a network. The signature move is THE LOG — a session-persisted running record in the rail where every action appends a stamped, initialed, timestamped entry with a press animation. The system refuses the neutral card-and-gauge dashboard: nothing appears and vanishes; everything that happened today is on the page, in order, with initials on it.

**Key Characteristics:**
- Paper ground, one open sheet, hairline rules — never floating cards on gray
- Vermilion is a stamp: rare, rotated, pressed — never a fill or a gradient
- Uppercase mono labels, tabular numerals, initialed record entries
- Square-cut corners (2px radius) everywhere; a logbook is not rounded
- One soft sheet shadow plus hard offset "press" shadows — no blurred elevation stacks

## Colors

A warm paper-and-ink palette with one vermilion accent, graph-blue structure, and a semantic trio tinted to sit on paper.

### Primary
- **Vermilion Stamp** (`#bf3f1f`): The accent. Stamps, the active decision, slider thumbs, the ruler gauge fill, focus rings, risk-increasing SHAP bars, primary buttons, and the folio number. Its rarity is the point.
- **Deep Vermilion** (`#9e3318`): Hover/pressed state of the primary button and the text color for risk-factor SHAP values.
- **Stamp Tint** (`#f8e9e0`): Selection background and hover wash of the upload zone; the pale impression a stamp leaves on the reverse of the sheet.

### Secondary
- **Graph Blue** (`#5b7a99`): Structural ink — page-edge tabs, protective-factor bars, the what-if panel's dashed border, section icons.
- **Deep Graph Blue** (`#45607a`): Graph blue for small text on paper — tab labels, SOP titles, logbook head, protective SHAP values.
- **Graph Tint** (`#dde4ea`): Tinted fills — ruler gauge bed, cross-check panels, table row hover, empty states.

### Neutral
- **Desk Paper** (`#f2efe7`): The page background — the surface the logbook lies on. Carries a faint radial graph-blue wash at the top.
- **Rail Paper** (`#e9e4d7`): The rail's page block behind the cut index tabs.
- **Open Sheet** (`#fdfcf7`): The working surface — the sheet, active tabs, and the focus-ring halo color.
- **Iron-Gall Ink** (`#1f2a33`): Primary text, 2px drawn rules (masthead, colophon, sign-off bar, table header), ruler markers.
- **Soft Ink** (`#4d5f6b`): Secondary text, field labels, log entry body.
- **Faint Ink** (`#5f707a`): Captions, timestamps, folio numerals, hints.
- **Hairline Rule** (`#cfd6d4`): Hairlines — entry separators, factor tracks, factor-row tick grids.
- **Drawn Rule** (`#a4b2b4`): Borders on paper — rail, sheet, inputs, stamps' parent containers, scrollbar thumbs.
- **Iron-Gall Slab** (`#1c262e`): The ink prompt slab — the dark code/prompt surface and its `::before` label (`#8fa3b0` on `#d8e0e4` text).

### Named Rules
**The Vermilion Is a Stamp Rule.** Vermilion appears only on stamps, the active decision, verification marks, focus rings, slider thumbs, and the primary action — never as a decorative fill, background wash, or gradient.

**The Evidence Color Rule.** Risk-increasing evidence is vermilion (`#bf3f1f`); protective evidence is graph blue (`#5b7a99`). This split holds across factor bars, SHAP values, and drift bars.

### Semantic States
- **Ledger Green** (`#2e6b46` / tint `#e7efe7`): ok — APPROVE, agree, grounded/stable states, grades A–B, saved notes.
- **Ochre** (`#8f6408` / tint `#f3ecd8`): warn — MANUAL REVIEW, warnings, unsupported claims, truncation notices, grade C.
- **Deep Red** (`#b03a1e` / tint `#f6e7de`): bad — NON-APPROVE, contradicted claims, drift, errors, grades D–E. It shares the vermilion family by recorded decision; it is the one place red extends beyond a stamp.

## Typography

**Display Font:** Archivo (variable 100–900, bundled `Archivo-var.woff2` via `/fonts/fonts.css`, fallback `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`)
**Body Font:** Archivo (same stack)
**Label/Mono Font:** JetBrains Mono (variable 100–800, bundled `JetBrainsMono-var.woff2`, fallback `ui-monospace, 'SF Mono', Menlo, monospace`)

**Character:** A squared grotesque doing the work of a printed record against a technical mono that carries every entry, readout, and numeral. The pairing reads as instrument output pressed into a printed form — Archivo is the form, JetBrains Mono is the handwriting of the machine.

### Hierarchy
- **Display** (800, `clamp(2.75rem, 5vw, 4.25rem)`, lh 1, ls `-0.01em`): Page-hero scale.
- **Verdict** (800, `clamp(2.5rem, 4.5vw, 3.75rem)`, lh 1, ls `-0.03em`, tabular-nums): The monumental probability readout — one number, set huge.
- **Headline** (700, `1.375rem`, ls `-0.01em`): `h1` — page-level titles.
- **Title** (800, `1.0625rem`, ls `0.02em`, uppercase): Section titles, memo and what-if heads, brand name.
- **Body** (400, `0.9375rem`, lh 1.55): Forms, prose, log entry text at `0.75rem`/`1.4`. Max line length ~46ch in empty states; memo prose at lh 1.75.
- **Small** (400–500, `0.8125rem`): Secondary body, table cells, tab labels (600).
- **Label** (mono 500–700, `0.6875rem`, ls `0.08–0.12em`, uppercase): Field labels, table headers, verdict labels, logbook head, colophon rule.
- **Entry** (mono 400, `0.75rem`; timestamps at `0.625rem`; initials at `0.5625rem`, ls `0.18em`): THE LOG's record face.

### Named Rules
**The Mono Is the Record Rule.** Anything the system produced — log lines, timestamps, readouts, numerals, table data cells — is JetBrains Mono with tabular numerals. Anything the shell says — titles, labels, buttons — is Archivo.

**The One Voice Rule.** The vermilion accent covers a small fraction of any screen. Its rarity is the point.

## Layout

The desk holds one open logbook. `.app` is a centered column (`max-width: 1460px`, padding `1.125rem` sides) containing the masthead, the book, and the colophon. The book is a two-column grid: a `264px` rail (`--rail-width`) and the fluid sheet, joined as one open spread. Inside the sheet, `.page-grid` splits content `minmax(300px, 5fr) / minmax(0, 8fr)` with `1.5rem` row and `2.25rem` column gaps; `.form-grid` auto-fills columns at `minmax(190px, 1fr)`.

Spacing rhythm is a base-8 scale: `0.375 / 0.75 / 1.125 / 1.5 / 2.25rem` (`--space-1/2/3/4/6`). Sections stack with `2.25rem` separation; section heads carry a `1px` drawn-rule bottom.

At `960px` and below the book collapses to one column: the rail sits above the sheet, tabs become a horizontal scroll row, THE LOG caps at `220px` tall, the verdict block drops its side column, and page-grid/forms go single-column. A sticky sign-off bar pins to the sheet's bottom edge.

## Elevation & Depth

Flat by default with exactly one lifted surface: the open sheet casts `--shadow-sheet` (`0 1px 2px rgba(31, 42, 51, 0.10), 0 16px 40px -18px rgba(31, 42, 51, 0.28)`), and the memo sheet reuses it. Depth is otherwise conveyed by hard, unblurred offset shadows that read as letterpress impression, never ambient float.

### Shadow Vocabulary
- **Sheet Lift** (`box-shadow: 0 1px 2px rgba(31, 42, 51, 0.10), 0 16px 40px -18px rgba(31, 42, 51, 0.28)`): The open sheet and the memo sheet only.
- **Press Shadow** (`box-shadow: 1.5px 1.5px 0 rgba(31, 42, 51, 0.35)`, hover `2.5px 2.5px 0`): The primary button; the brand mark uses `1px 1px 0`; the verdict grade `2px 2px 0 rgba(31, 42, 51, 0.25)`; SOP result boxes `1px 1px 0 rgba(31, 42, 51, 0.12)`. Hard offset, no blur — the stamp press.

### Named Rules
**The One Sheet Rule.** Only the sheet (and the memo sheet, a loose page on it) casts a soft shadow. Nothing else floats; elevation is expressed with ink rules and press shadows.

## Shapes

Square-cut. Every corner in the system uses a single `2px` radius (`--radius`) — a logbook is trimmed, not rounded. The form language is ruled, not carded: sections are `.sheet-section` folios divided by `1px` hairlines (`--rule-strong` for drawn borders, `--rule` for hairlines) and `2px` ink rules at structural seams (masthead, colophon, sign-off bar, table headers). Recurring silhouettes: rotated stamp marks (`-1.2deg`, verdict grade `-2deg`, brand mark `-1.5deg`), page-edge tabs that translate out of the rail, a `84px` square verdict grade cell with a `3px` currentColor border, and ruler gauges whose beds are ticked repeating-linear-gradients.

## Components

### Buttons
- **Shape:** square-cut (2px radius), inline-flex, gap `6px`
- **Primary:** vermilion fill (`--stamp`) with sheet text, press shadow `1.5px 1.5px 0`, padding `8px 16px`, Archivo 700 at `0.8125rem`, ls `0.03em`
- **Hover / Focus:** background deepens to `--stamp-deep`, shadow grows to `2.5px`; `:active` presses up `translateY(-1px)`; `:focus-visible` shows the vermilion double-ring (`0 0 0 2px sheet, 0 0 0 4px stamp`); disabled at `0.45` opacity
- **Ghost:** transparent with a `1.5px` `--rule-strong` border, ink text; hover darkens the border to ink with a `rgba(31,42,51,0.04)` wash
- **Small:** `5px 10px` at label size

### Stamps (the unit of record)
- **Style:** inline-flex, `1.5px solid currentColor` border, transparent background, 2px radius, mono 700 at `0.625rem`, ls `0.14em`, uppercase, rotated `-1.2deg`, vermilion by default
- **Tones:** `stamp` (vermilion), `ok`, `warn`, `bad`, `ink`; `stamp-lg` enlarges to `0.75rem` / `6px 14px` / `2px` border
- **Behavior:** every stamp mounts with the `stamp-in` keyframe (scale `1.35→1` with rotation overshoot, 380ms)

### Navigation — Page-edge index tabs
- **Style:** rail-contained tabs with a sheet-tinted wash (`rgba(253,252,247,0.55)`), `1px` rule border, folio number in mono; hover slides out `translateX(4px)`
- **Active:** full sheet background, `translateX(6px)`, `2px` vermilion inset bar on the rail edge, folio turns vermilion; on mobile the vermilion bar flips to the top edge

### Inputs / Fields
- **Style:** white fill, `1px` `--rule-strong` border, 2px radius, padding `7px 10px`, body size
- **Focus:** border turns vermilion with the double-ring halo (`2px` sheet + `4px` stamp)
- **Labels:** mono uppercase at label size; hints at label size, sentence case; errors in `--bad` at label size. Textareas are mono. Range sliders render as ruled scales (repeating-linear-gradient ticks) with a vermilion thumb.

### Chips / Pills
- **Style:** outline chips — `1px solid currentColor`, transparent, 2px radius, mono 700 at `0.625rem`, ls `0.1em`, uppercase
- **State:** `pill-success` (ok/ok-soft), `pill-warning` (warn/warn-soft), `pill-danger` (bad/bad-soft) — tone color with its paper-sitting tint fill

### Cards / Containers
- There are no cards. Sections are ruled folios: a `section-head` (uppercase title + faint note over a `1px` rule) above ruled content. The nearest thing to a card is the memo sheet (white, `1px` rule border, sheet shadow) and the ink prompt slab (dark, mono, with a stamped `::before` caption).

### Tables
- **Ruled tables:** `border-collapse`, small size; mono uppercase headers over a `2px` ink rule; row separators in `--rule`; row hover washes `--graph-soft` at 25%; data cells that hold numerals use mono with tabular-nums.
- **Nameplates:** inline mono label chips (`1px` rule-strong border, paper fill) used as row identifiers.

### Signature: THE LOG
- The running record of the session in the rail: timestamp (mono, faint) + entry text + operator initials (mono 700, ls `0.18em`, vermilion, max 4 chars set by the user — never fabricated) + optional stamped tone. Entries prepend, cap at 80, persist to `sessionStorage`; fresh entries play the `stamp-in` press animation; the log scrolls in a thin custom-scrollbar pane.

### Signature: Verdict block
- One monumental verdict per record: a tabular-nums probability at verdict scale, an `84px` rotated grade cell (`3px` currentColor border; ok/warn/bad by grade), and a mono record-line header above a dashed rule. The decision banner is a stamped, explicitly mockup mark.

### Signature: Ruler gauge & factor exhibits
- The ruler gauge is a ticked bed (`--rule-strong` major / `--rule` minor ticks over a `--graph-soft` spine) with a vermilion fill that scales from the left and an ink marker with a pointer notch. Factor exhibits are ruled rows: name column, ticked track, vermilion risk bar or graph-blue protective bar, mono SHAP value.

## Do's and Don'ts

### Do:
- **Do** keep all web fonts bundled locally (`/fonts/fonts.css` serving `Archivo-var.woff2` and `JetBrainsMono-var.woff2`) — the app runs offline.
- **Do** use the 2px radius and the ruled (not carded) section language everywhere.
- **Do** set every consequential state as a stamped entry with timestamp + operator initials in THE LOG.
- **Do** use tabular numerals for all readouts, tables, and gauges (mono face does this natively).
- **Do** keep the educational disclaimer and "mockup"/"demo memo" honesty badges visible.

### Don't:
- **Don't** load fonts, icons, or assets from a CDN; Lucide inline SVGs only, no emojis (standing PRODUCT.md commitment).
- **Don't** add cards, floating panels, or blurred drop shadows — the sheet is the only lifted surface; use ink rules.
- **Don't** spend vermilion on decorative fills, gradients, or large areas; it is a stamp color.
- **Don't** introduce corners rounder than 2px; a logbook is square-cut.
- **Don't** fabricate operator initials, testimonials, benchmarks, or claims; empty states say the record is empty.
- **Don't** add eyebrow kickers or marketing eyebrows above section titles; section heads are record lines (uppercase title + note over a rule), not campaign copy.
