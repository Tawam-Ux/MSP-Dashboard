---
name: MSP Interfood P&L Dashboard
description: A monthly P&L dashboard drawn as a transit line; the unit tree is the route and every figure rides a coloured line.
colors:
  plane: "#f3f4f7"
  surface: "#ffffff"
  surface-2: "#f4f5f8"
  surface-3: "#eaecf1"
  ink: "#1b1f2a"
  ink-2: "#4b5263"
  ink-3: "#626979"
  line: "#e6e8ee"
  line-strong: "#d2d6df"
  msp-red: "#d3263a"
  accent-soft: "#fdebed"
  brand: "#2f6fd6"
  brand-soft: "#ebf1fc"
  btn-hover: "#343a48"
  line-rev: "#2f6fd6"
  line-gp: "#237a61"
  line-op: "#e3a21a"
  line-pbt: "#7b4fc9"
  route-off: "#d9dce4"
  seg-cogs: "#2c3240"
  seg-admin: "#3aa17e"
  seg-finance: "#b5bac6"
  good: "#1f7a5c"
  good-soft: "#e4f4ec"
  warn: "#c27c0e"
  warn-text: "#8a5600"
  warn-soft: "#fdf3e1"
  loss-text: "#b4161f"
  loss-soft: "#fde8ea"
  selection: "#FFFFCC"
  login-room: "#0c0c0e"
  login-paper: "#f2efe6"
  login-grid: "rgba(47, 108, 145, 0.3)"
  login-walnut: "#6a4a32"
  login-tungsten: "#ffe4b0"
  login-phosphor: "#cdeedc"
  login-card: "#fffdfa"
  login-ink: "#1f1b17"
  login-field: "#f4efe8"
  chalk-slate: "#1f2a25"
  chalk-white: "#f1efe6"
  chalk-green: "#9fe3b4"
  chalk-pink: "#f6a1a1"
  chalk-yellow: "#f5df86"
  oak: "#a87542"
typography:
  display:
    fontFamily: "Anuphan, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Anuphan, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
    fontFeature: "\"tnum\""
  title:
    fontFamily: "Anuphan, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Anuphan, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
  caption:
    fontFamily: "Anuphan, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Anuphan, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.4
rounded:
  code: "6px"
  rail: "6px"
  bar-less: "8px"
  bar: "12px"
  row: "14px"
  inner: "18px"
  tile: "22px"
  drop: "24px"
  card: "28px"
  login: "16px"
  login-control: "12px"
  pill: "999px"
spacing:
  page-gap: "1rem"
  page-x: "1rem"
  page-x-sm: "1.75rem"
  page-y: "1.5rem"
  card-pad: "1.375rem 1.5rem"
  kpi-pad: "1rem 1.25rem 1.0625rem"
  panel-pad: "0.875rem 1.125rem"
  cell-pad: "0.6875rem 0.875rem"
  container: "1440px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    padding: "0.625rem 1.5rem"
    height: "2.75rem"
  button-primary-hover:
    backgroundColor: "{colors.btn-hover}"
  button-primary-login:
    backgroundColor: "{colors.msp-red}"
    textColor: "{colors.surface}"
    rounded: "{rounded.login-control}"
    height: "3rem"
  login-card:
    backgroundColor: "{colors.login-card}"
    textColor: "{colors.login-ink}"
    rounded: "{rounded.login}"
    padding: "2.25rem 2rem 1.25rem"
  login-field:
    backgroundColor: "{colors.login-field}"
    textColor: "{colors.login-ink}"
    rounded: "{rounded.login-control}"
    padding: "0.75rem 1rem"
    height: "3rem"
  button-soft:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: "0.375rem 0.875rem"
    typography: "{typography.caption}"
  button-soft-hover:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.ink}"
  field:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0.5625rem 1.125rem"
    height: "2.75rem"
  field-focus:
    backgroundColor: "{colors.surface}"
  select:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0.5rem 2.5rem 0.5rem 1.125rem"
    height: "2.75rem"
  tab:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: "0.4375rem 1.125rem"
    height: "2.5rem"
  tab-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
  seg-item:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: "0.375rem 0.9375rem"
    height: "2.25rem"
  seg-item-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "{spacing.card-pad}"
  kpi:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.tile}"
    padding: "{spacing.kpi-pad}"
  panel:
    backgroundColor: "{colors.surface-2}"
    rounded: "{rounded.inner}"
    padding: "{spacing.panel-pad}"
  roundel:
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    size: "3rem"
    typography: "{typography.label}"
  roundel-sm:
    size: "2.125rem"
  badge-bad:
    backgroundColor: "{colors.loss-soft}"
    textColor: "{colors.loss-text}"
    rounded: "{rounded.pill}"
    padding: "0.1875rem 0.6875rem"
    typography: "{typography.label}"
  badge-good:
    backgroundColor: "{colors.good-soft}"
    textColor: "{colors.good}"
    rounded: "{rounded.pill}"
    padding: "0.1875rem 0.6875rem"
  badge-warn:
    backgroundColor: "{colors.warn-soft}"
    textColor: "{colors.warn-text}"
    rounded: "{rounded.pill}"
    padding: "0.1875rem 0.6875rem"
  stop-dot:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    size: "1.5rem"
  stop-dot-now:
    size: "2rem"
  table-head:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: "0.5625rem 0.875rem"
---

# Design System: MSP Interfood P&L Dashboard

## Overview

**Creative North Star: "Transit Line"**

The unit tree (MSP → organisation → Zone → Op/Sz → unit) is a transit line, and drilling down is riding it one station at a time. The travelled part of the route is MSP red, the current station is enlarged with a soft halo, and stations still ahead are grey. Every headline figure owns a line colour, the way a metro line owns its colour: revenue blue, gross profit green, operating profit amber, profit before tax purple. On the Overview, the month's P&L becomes a ride of its own: it leaves station Revenue, each station subtracts a cost, and it arrives at PBT.

The world is calm and dense. It is built for an accounting team that spends hours here every day. A cool grey plane carries white, heavily rounded cards with no borders, near-black ink type, and a single family (Anuphan) set with tabular figures. Selection is always one dark ink pill. Colour is reserved for data roles and the route, so a red figure always means something. Every surface also has a dark theme that follows the OS. It remaps each role (values live in `src/app/globals.css` and the sidecar), so no rule here depends on a light-only value.

Motion has one rhythm: ease-out-expo, 120–160ms for responses, 200–300ms for state changes, and up to 900ms for the signature "train arrives" moment, when the red route draws from the first station to the current one. Content is fully visible without animation. Reduced motion leaves only fades.

The sign-in page is the one surface outside the Transit Line: a night desk. It opens as a dark room in either OS theme: a graph-paper wall, a walnut desk, and a spring-arm desk lamp with an MSP-red head. Pulling the lamp's cord lights the room and raises the paper login card out of the dark. Its palette, corners and shadows below are scoped to that scene (the `login-` tokens) and do not leak into the app.

**Key Characteristics:**
- Unit hierarchy rendered as a route of circular stations on a thick 6px rail; travelled = MSP red, ahead = grey.
- Metric line colours double as data colours (roundels, bridge bars, chart lines, ratio dots).
- Everything is rounded: 999px pills for every control, 28px cards, 22px tiles, 18px inner panels, 14px rows.
- Depth from three planes (plane, card, pop) and soft shadows, never card borders.
- Single type family, tabular numerals on every figure, weight 600 for figures and titles.
- Loss is always deep red text plus a true minus sign plus a "ขาดทุน" pill badge.
- Sign-in is its own lamp-lit scene; pulling the lamp's cord is the only way in, by pointer or keyboard.

## Colors

A cool, low-chroma neutral ground with five saturated "line" colours that each mean one metric, and MSP red reserved for the route, the brand, losses and errors.

### Primary
- **MSP Route Red** (msp-red): The one binding brand trait. It is the travelled part of every route and step rail, the station rings, the M logo, and on the sign-in page the lamp's enamel head, the login button and field focus. It is also the loss colour (bars, outlines, coin overruns) and the error/destructive colour (import error progress, login error, logout hover).

### Secondary
- **Revenue Line Blue** (line-rev, also `brand`): Revenue's line colour, plus the interactive accent: links on hover, field focus border and ring, focus outline, the active-row tint (brand-soft), the selected-month column tint in the monthly matrix, and default rank bars.

### Tertiary (metric lines and cost segments)
- **Gross Profit Green** (line-gp): GP roundel, GP bridge bar, GP ratio dot.
- **Operating Amber** (line-op): OP roundel and bar. It is light, so roundels on it switch to dark ink text (`data-light`).
- **PBT Purple** (line-pbt): PBT roundel, the PBT bridge destination, month-strip bars (45% mixed into surface when not selected, full when selected or in the YTD range).
- **Cost Graphite** (seg-cogs), **SG&A Green** (seg-admin), **Finance Grey** (seg-finance): the "less" columns of the profit bridge and the 100-baht breakdown segments.
- **Rail Off Grey** (route-off): stations and rail ahead of the rider; also unfilled step connectors.

### Neutral
- **Cool Plane** (plane): The page ground behind every card.
- **White Surface** (surface): Cards, KPI tiles, route bar, top bar, white select pills on the plane.
- **Mist** (surface-2) / **Fog** (surface-3): Table head pills, soft buttons, fields, panels, chips, hover fills; Fog is for tracks, skeletons and code.
- **Ink** (ink), **Ink 2** (ink-2), **Ink 3** (ink-3): Primary text, secondary text, captions and meta. Ink 3 is tuned to at least 4.5:1 on surface and surface-2.
- **Hairline** (line) / **Strong Hairline** (line-strong): Table row separators, ratio-strip dividers, zero lines, scrollbars, field hover border.
- **Highlighter** (selection): Text selection is a pale highlighter yellow with ink text.

### Status
- **Good** (good, good-soft): Positive deltas, good badges and panels.
- **Warn** (warn, warn-text, warn-soft): Warning dots, badges and panels; text uses the darker warn-text for contrast.
- **Loss** (msp-red, loss-text, loss-soft): Loss bars and outlines in msp-red; loss figures in loss-text; loss badges, panels and error notices on loss-soft.

### Sign-in Night Desk
- **Night Room** (login-room): The room with the light off, in both OS themes; a 93% darkness layer over the whole scene still lets the graph-paper grid show faintly.
- **Graph Paper** (login-paper, login-grid): The wall. 16px minor squares at 12% grid alpha, 80px major squares at 30%, in a blue-grey ink.
- **Walnut** (login-walnut): The desk top; its front deepens to #3a2619.
- **Tungsten** (login-tungsten): The lamp's light: the beam, the bulb glow, the pool on the desk and the warm wash on the wall.
- **Phosphor** (login-phosphor): The pull-cord bead glowing in the dark; it turns cream ceramic once the light is on.
- **Paper Card** (login-card, login-ink, login-field): The sign-in card is warm paper white with warm near-black ink and warm grey fields. It is always light, whatever the OS theme.
- **Slate** (chalk-slate): The wall chalkboard, a green-black board in an **Oak** (oak) frame. The lamp stands to its right, so lamp light warms its upper right, and faint eraser haze clouds the rest.
- **Chalk White / Green / Pink / Yellow** (chalk-white, chalk-green, chalk-pink, chalk-yellow): White draws the chalkboard's axes and figures, green the rising candles, pink the falling ones, and yellow the latest price line and its boxed tag.
- **Bookshelf** (oak): Oak planks on graphite brackets. Book spines use muted navy, forest, ochre, cream, charcoal, teal, tan, plum and olive, and the vase a sage-blue glaze. No MSP red: it stays reserved for the lamp head and the button.
- **Desk things:** A cream stoneware mug with a navy band, a graphite laptop with a silver deck (its screen borrows the app's plane, ink and metric colours), a graphite pencil cup, navy, leather and forest ledgers, and a brass alarm clock with a cream face and an ochre second hand. No MSP red here either.

### Named Rules
**The Line-Is-the-Metric Rule.** Each headline metric owns one line colour across every page and chart: REV blue, GP green, OP amber, PBT purple. Never recolour a metric for decoration or reuse its colour for another metric.

**The One Red Rule.** MSP red means only the travelled route, the brand mark, the sign-in lamp head and button, a loss, or an error/destructive state. Never use it for decoration or emphasis.

**The Ink Selection Rule.** Every selected state (active tab, segmented option, selected matrix month, tooltip) is the single ink pill (ink background, white text, weight 600). Blue never fills a selected control.

**The Loss Never Alone Rule.** A loss is shown with deep red text (loss-text), a true minus sign (−, U+2212), and, where it is the headline, a "ขาดทุน" pill badge. It is never shown by colour alone.

## Typography

**Display Font:** Anuphan (with system-ui, sans-serif)
**Body Font:** Anuphan (with system-ui, sans-serif)

**Character:** A single headless Thai–Latin sans with rounded strokes, loaded as a variable font through `next/font`. Its soft terminals match the round geometry. Hierarchy comes only from size and weight (400/500/600/700).

### Hierarchy
- **Display** (600, 1.625rem rising to 1.875rem at ≥640px, leading tight, −0.01em, balanced wrap): Page titles in the page header, e.g. "ภาพรวมทั้งบริษัท · <month>".
- **Headline** (600, 1.75rem, −0.01em, tabular): KPI figures. Bridge destination figures use 1.1875rem and other bridge figures 1rem/600.
- **Title** (600, 1.0625rem, 1.4): Card titles, balanced wrap.
- **Body** (400, 0.875rem in tables and tabs, 1rem base at 1.6 line-height): Table cells, tabs, selects, panel text.
- **Caption** (400–500, 0.8125rem, 1.5): Card captions, table heads, chips, stop labels, info rows, month names. This is the workhorse size of a dense day tool.
- **Label** (600, 0.75rem, 1.4): Badges, roundel station codes (700, +0.02em), tooltips, sub-values. Narrow-screen bridge labels drop to 0.6875rem.

### Named Rules
**The One Family Rule.** Anuphan everywhere: titles, figures, labels. Do not introduce a display face or a mono face. Figures get their alignment from tabular numerals, not from a mono font.

**The Tabular Figures Rule.** Every number that can sit next to another number carries tabular numerals (`.num`, `font-variant-numeric: tabular-nums`). Columns of baht must align digit for digit.

## Layout

A single centred column, max 1440px, with 1rem side padding (1.75rem from 640px) and 1.5rem vertical padding (1.75rem from 1024px). The sticky white top bar (z-30) holds the round red M, pill tab navigation and the user chip. Below 1024px the tabs wrap to their own horizontally scrolling row.

Pages stack sections with a 1rem gap. A page header (title + one-line caption at left, segmented pills, selects and the money toggle at right) leads, then full-width cards. Paired cards use a two-column grid at ≥1024px (Overview: `1fr / 1.25fr`). Long lists cap their height (card-sm 28rem at ≥1024px, md 32rem, lg 36rem, xl 42rem) and scroll inside the card body with a stable gutter, sticky table heads, and a bottom fade mask while more content remains.

Data visualisations keep all their stations on narrow screens instead of dropping data. The profit bridge compresses to seven equal columns with compact K/M figures below 640px. The month strip folds 12 months into two rows of six and hides values but keeps loss badges. The monthly matrix keeps a sticky name column and scrolls horizontally inside an 18px-rounded box. Breakpoints are 480px (step labels), 640px and 1024px.

Touch and click targets are at least 2.5rem (tabs, icon buttons 40px). Buttons, fields, selects and month cells are 2.75rem. Rank rows are at least 44px.

## Elevation & Depth

Depth comes from three tonal planes plus soft, ambient shadows: the cool plane, white cards resting on it, and popovers or tooltips lifted above. Cards never carry a border, and separation inside a card comes from surface-2 fills and hairlines. In dark mode the shadows collapse to a near-invisible 1px and the planes do the work.

### Shadow Vocabulary
- **Rest** (`box-shadow: 0 1px 2px rgba(22,27,40,0.04), 0 8px 24px -12px rgba(22,27,40,0.12)`): Every card, KPI tile, route bar, ratio strip, header select and plane-level segmented control.
- **Pop** (`box-shadow: 0 2px 6px rgba(22,27,40,0.06), 0 18px 40px -12px rgba(22,27,40,0.24)`): Popovers and bridge tooltips.
- **Lamp Cast** (`box-shadow: 16px 20px 44px -16px rgba(28,18,10,0.5)`): The sign-in card standing in lamp light. The light comes from the lamp at its upper left, so the shadow falls down-right on the wall, and its x offset moves against the lamp head's nod.
- **Halo** (`box-shadow: 0 0 0 4–5px color-mix(in srgb, <line colour> 14–18%, transparent)`): A soft ring in the element's own line colour around roundels, the current station and the bridge destination. Field focus uses the same device in brand blue at 16%.

### Named Rules
**The Three Planes Rule.** Plane, card, pop. A surface is lifted by moving it to the next plane, never by adding a border or a heavier shadow.

## Shapes

Nothing has a square corner. Every interactive control is a full pill (999px): buttons, fields, selects, tabs, segmented items, badges, chips, avatar, icon buttons, month cells, and even the focus outline and the table head row (first and last cells capped at 999px). The sign-in desk is the one exception: its card is a 16px paper sheet with 12px fields and button, because it is an object on a desk, not app chrome. Containers step down in radius as they nest: cards 28px, drop zone 24px, KPI tiles and route bar 22px, inner panels and scroll boxes 18px, table and rank rows 14px. Bridge bars are 12px (8px for "less" columns), month-strip bars 8px with a 3px foot on the zero line, and rails and progress bars 6px with round caps. Stations, roundels, coins and status dots are true circles. The ratio strip tightens from 28px to 22px at ≥1024px when it becomes a single five-cell row.

## Components

### Buttons
Tactile ink pills that shrink slightly under the finger.
- **Shape:** Full pill (999px), min height 2.75rem.
- **Primary:** Ink background, white text, weight 600, padding 0.625rem 1.5rem. On the sign-in card it becomes MSP red with a deeper red hover (#b51d30), 12px corners, 3rem tall, and a soft red drop shadow.
- **Hover / Focus / Active:** Hover lifts to the hover ink. Focus is a 2px focus-colour outline offset 2px, pill-shaped. Active scales to 0.96 over 80ms. Disabled drops to 55% opacity.
- **Soft:** Mist pill, ink-2 text, 0.8125rem/500, padding 0.375rem 0.875rem. Hover moves to Fog with ink text.
- **Icon button:** 40px circle, ink-3 glyph (inline SVG stroke icons). Hover fills Mist. The danger variant (logout) hovers to loss-soft with loss-text.

### Chips
- **Ratio chip:** Mist pill, padding 0.4375rem 0.9375rem, 0.8125rem. It leads with a 10px dot in the ratio's line colour, then the ink-3 label, the figure in 600 tabular (loss-text if negative), and an optional delta.
- **Badges:** Pills at 0.75rem/600 in good, bad, ok, warn and muted tones on their soft grounds. An optional leading 6px currentColor dot.

### Cards / Containers
- **Corner Style:** 28px.
- **Background:** White surface on the cool plane.
- **Shadow Strategy:** Rest shadow (see Elevation).
- **Border:** None.
- **Internal Padding:** 1.375rem vertical, 1.5rem horizontal. The title (1.0625rem/600) is followed by a 0.8125rem ink-3 caption. Panels inside cards are Mist (or good, loss or warn soft), 18px, with no border.
- **KPI tile:** 22px card, padding 1rem 1.25rem 1.0625rem. A small roundel plus label head, a 1.75rem/600 tabular figure (loss-text when negative), and a two-line-clamped note.

### Inputs / Fields
- **Style:** Mist pill, transparent 1px border, padding 0.5625rem 1.125rem, min height 2.75rem. The placeholder is ink-3.
- **Focus:** Border turns brand blue, background goes white, with a 4px brand halo at 16%.
- **Hover:** The border appears in line-strong.
- **Header select:** A white pill on the plane with the rest shadow and a chevron at right. Hover fills Mist.
- **Sign-in field:** A warm paper field (login-field), 12px corners, 3rem tall. Focus is an MSP-red border with a 4px red halo at 14%. Browser autofill is repainted to the same fill.

### Navigation
- **Top bar:** Sticky white bar with a 1px hairline under it. Round red M brandmark, pill tabs (0.875rem/500, ink-2), and the user chip (Mist pill with ink avatar circle) at right.
- **Active tab:** One ink pill that slides and stretches to the chosen tab over 360ms ease-out. The new tab's text turns white just after the pill arrives.
- **Segmented control:** A pill tray (white with shadow on the plane, Mist inside cards) holding pill items. The active item is the ink pill. It is used for month/YTD, years, amount/percent and money format.
- **Mobile:** Tabs move to a full-width, horizontally scrolling row with the scrollbar hidden.

### Tables
- **Head:** A Mist pill row (first and last cells capped 999px), 0.8125rem/500 ink-2.
- **Rows:** 0.875rem, separated by hairlines, with 14px-rounded row ends. Hover fills Mist on fine pointers. A whole row is clickable through one stretched link, whose name underlines in blue with a chevron nudging 2px. Group-heading rows and major subtotal rows sit on Mist.
- **Monthly matrix:** A 0.8125rem grid with a sticky left name column and a sticky head. The selected month's head cell is the ink pill and its column is tinted 7% brand (12% on major rows). The total column has a strong inset left hairline. Negative cells are loss-text 600.

### Route Line (signature)
A white 22px bar holding stations on a 6px round-capped rail. Each station is a 1.5rem white dot with a 5px MSP-red ring. The rail into a station is red if travelled and route-off if ahead. The current station grows to 2rem with a 7px ring and a 5px red halo, and its label goes 0.875rem/700 ink. Stations ahead go grey with ink-3 labels. Past stations are links back up the tree: hovering underlines the label and scales the dot 1.18×. On entry, the rail draws station by station (320ms per segment, 130ms stagger), dots "arrive" from 30% scale, and the current station's ring blooms over 900ms. The same station-and-rail language draws the upload steps and the empty-state illustration.

### Roundel
A station code badge: a circle (3rem, or 2.125rem small) filled with a metric's line colour, white 0.75rem/700 code (REV, GP, OP, PBT), and a 4px halo of its own colour at 14%. On amber the code switches to dark ink.

### Profit Bridge (Overview)
A seven-column waterfall standing on an MSP-red rail: REV, −cost, GP, −SG&A, OP, −depreciation/interest, PBT. Total bars stand on the zero line in their metric colour. "Less" bars float from the previous level in cost-segment colours at 88% opacity, joined by dotted level links. A station dot sits under every column, and the PBT destination is a filled 2.125rem dot in its colour (loss red when PBT is negative, plus a "ขาดทุน" badge). Columns are focusable. Hover or focus brightens the bar and shows an ink-pill tooltip with the exact baht and % of revenue. Bars grow from the rail (200ms, 30ms stagger) and the destination arrives last.

### Month Strip (Overview)
Twelve monthly PBT columns on a 2px zero line, each month a link that re-rides the bridge. Profit bars stand up in muted PBT purple (full purple when selected or in range). Loss months hang below zero as a loss-soft bar with a 2px inset red outline (full red when selected) and carry a "ขาดทุน" badge. Unclosed months are grey "ยังไม่ปิดงบ". The selected month sits on a Mist 18px tile with bold ink text.

### Rank Bar
A ≥44px row with a 0.8125rem/600 label, a 0.625rem Fog pill track filled left-to-right (clip-path reveal, 700ms) in revenue blue, good or loss, a tabular value, an optional badge and an optional chevron. Rows are 14px-rounded, and the active row sits on brand-soft.

### Sign-in Night Desk (login)
A lamp-lit still life that is the whole sign-in page.
- **Scene:** The page is a three-row grid. The top row is headroom for the lamp head. The middle row is the paper card standing on the desk, shifted right on wide screens (70px from 640px, 120px from 1024px) so lamp and card centre together. The bottom row is the walnut desk (12svh). The graph-paper wall sits behind everything. On screens 1360px and wider, the wall carries a chalkboard left of the lamp and a bookshelf right of the card. The board's top sits 1rem above the card's top and the shelf's 1rem below it. Both are placed from positions the lamp engine measures, so they never push the card's layout.
- **Lamp:** A spring-arm desk lamp drawn as geometry: graphite double-rod arms with coil springs, brass knuckle joints, a weighted base on the desk, and an MSP-red cone head. Its base, elbow and head are computed from the card and desk positions. The head floats above the card's top-left corner and never covers the card: its lowest point sits 8px above the card. The lamp grows to 1.3× where there is room above the card and shrinks where there is not.
- **Switch:** The pull cord hangs from under the head. Its bead is a `role="switch"` button that glows phosphor green in the dark. At rest on wide screens it hangs just left of the card, clear of the form.
  - **Drag:** The bead drags in any direction, a full 360° around the cord's anchor. Closer to the anchor than the cord's length, the cord goes slack and sags. Past that length, it stretches like rubber.
  - **Click:** 38px of stretch in any direction clicks the switch, mid-pull. Tapping the bead also switches. While the room is dark, Enter, Space or Tab anywhere also switches it on.
  - **Release:** The bead swings back like a pendulum, and a hard flick can whip it around the anchor. The head nods with the downward part of the pull.
- **Light off:** A 93% darkness layer covers the wall, the chalkboard, the bookshelf, the desk and the things on it. The lamp dims to a silhouette, and the card is hidden and inert. Only the bead and the hint "ดึงสายเพื่อเปิดไฟ" read.
- **Light on:**
  - The bulb and the room's darkness flicker against each other for 0.6s, then the tungsten wash and the desk pool come up.
  - The card rises out of the dark (0.7s ease-out after a 0.3s wait). Its warm highlight and its lamp-cast shadow follow the head's nod.
  - The head nods and settles on its springs, and dust motes drift in the beam.
  - Switching off leaves an orange filament ember that fades over 1.6s.
  - A failed sign-in browns the room out once.
- **Help and error:** Under the button, a fixed-height slot holds the help line. A sign-in error replaces it, so the card never changes height.
- **Chalkboard:**
  - **Placement:** Hangs on the left wall and reaches to 2rem short of the card. The lamp's arms and elbow cross in front of it, while the head and the resting bead stay above its top edge. It fills toward the screen edge (2.5rem margin) up to 52rem wide. It is 3:2 and keeps at least 3rem of wall above the desk, so it narrows when that space runs short.
  - **Look:** A slate board in an oak frame, with a wooden tray under it holding a chalk stick and a felt eraser. The candlestick chart is drawn in chalk: a dotted grid, a right price scale, a time axis, green and pink candles, and a yellow dashed latest-price line with a boxed tag. Price labels the tag would cover are hidden.
  - **Chalk texture:** One SVG filter over the whole chart roughens the stroke edges and bites gaps into them. The figures stay in Anuphan.
  - **Data:** Synthetic and unlabeled. The page is pre-authentication, so it never shows company figures.
  - **Motion:** The board does not glow by itself, so it sinks into the dark with the room. When the light comes on, the axes draw themselves, the figures appear, and the candles are drawn one by one from left to right. The latest-price line is written last (at about 2.2s), and then the board stays still.
- **Bookshelf:**
  - **Placement:** The board's old place on the right wall: 3rem right of the card, at least 3rem from the screen edge, at most 26rem wide. It shrinks with the space above the desk.
  - **Look:** Two oak wall shelves on graphite brackets, drawn as one SVG.
    - Upper shelf: a row of upright books, two books toppled into each other like dominoes, and two lying flat.
    - Lower shelf: a ceramic vase of five daisies (white, butter, lilac, peach), upright books, and a stack of three.
    - The lamp-side (left) edge of each spine is lighter, and its right edge darker.
  - **Motion:** None. Like the board, it does not glow by itself and sinks into the dark with the room.
- **Desk things:**
  - **Placement:** Two groups stand on the desk top, their bases 16px into it. On the right, 1.5rem from the card: a coffee mug, an open laptop and a pencil cup. On the left, 1.5rem from the lamp base: a stack of three ledgers with folded reading glasses, and a twin-bell brass alarm clock. They scale with the lamp but shrink to keep 1.5rem from the screen edge.
  - **Look:**
    - The mug is cream stoneware with a navy band.
    - The laptop faces the viewer: a graphite lid and a silver keyboard deck.
    - Its screen is a miniature of the site's P&L Analysis page. It shows the white top bar with the selected tab as a dark pill, the page title and the period pill, and the four KPI cards in a 2×2 grid. Each card has a metric-colour roundel (REV, GP, OP, PBT), a label, a value and a ▲/▼ line against last month.
    - The values are masked as •••.•• because the page comes before sign-in.
    - The pencil cup is graphite and holds a ruler, two pencils and a pen.
    - No MSP red. The side facing the lamp is lighter, and shadows fall away from it.
  - **Motion:**
    - The laptop screen is dark glass while the light is off. It wakes 1.1s after the light comes on, as the bulb settles.
    - While the light is on, steam rises from the mug.
    - The alarm clock rings once (a 0.8s shake at 0.9s) as the light comes on. It always shows the visitor's local time, ticking each second.
- **Reduced motion:** No flicker, nod, motes, chalk drawing, steam drift or clock ring. The steam stays still and faint, the clock hides its second hand, and the laptop screen comes on with the light. Switching is a short fade.

## Do's and Don'ts

### Do:
- **Do** give every headline metric its line colour and roundel code (REV blue, GP green, OP amber with dark code, PBT purple) and carry that colour into its bars, dots and lines.
- **Do** draw hierarchy and progress as stations on a 6px rail: travelled in MSP red, current enlarged with a 5px halo, ahead in route-off grey.
- **Do** mark every selected control with the single ink pill (ink background, white text, weight 600).
- **Do** show losses with loss-text, a true minus sign (−), and a "ขาดทุน" pill badge where the figure is a headline.
- **Do** put tabular numerals on every figure and keep money in the user's chosen format (full, decimal, compact K/M).
- **Do** keep every control in the app chrome a 999px pill at least 2.5rem tall, and nest container radii 28 → 22 → 18 → 14px. The sign-in card is the one exception: 16px corners with 12px fields and button.
- **Do** keep all stations or months on narrow screens by compacting figures or folding rows instead of dropping data.
- **Do** use the shared ease-out-expo curve (`cubic-bezier(0.16, 1, 0.3, 1)`) and let reduced motion fall back to fades only.

### Don't:
- **Don't** add borders to cards or tiles. Lift by plane and the rest shadow.
- **Don't** use MSP red for anything other than the route, the brand mark, the sign-in lamp head and button, a loss, or an error/destructive state.
- **Don't** fill a selected tab or segment with blue. Blue is for links, focus and tints.
- **Don't** convey loss or gain by colour alone. Pair it with a sign, an arrow or a label.
- **Don't** introduce a second typeface, a mono face for figures, or square-cornered controls.
- **Don't** render negative money with a hyphen-minus on new surfaces. Use SignedMoney / formatSignedPct.
