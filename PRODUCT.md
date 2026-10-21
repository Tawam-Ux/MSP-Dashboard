# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: MSP Interfood's accounting team, using the dashboard every working day on office desktops. They import the monthly Master Excel file, check that computed totals match the file, and read P&L figures in detail across companies, zones, operations units and 80+ branches. They need dense, exact numbers they can scan and trust.

Secondary: executives and branch managers who open it to read the month's result for the units they are scoped to.

## Product Purpose

Turns the single monthly Master Excel workbook into a permission-scoped monthly P&L dashboard: overview KPIs, "every 100 baht of revenue" breakdown, unit ranking with drill-down, full statement table, Sales Zone and Operations views, and a guarded import flow (validate → confirm → back up the old file to Google Drive). Success: accounting can import and verify a month in minutes, and anyone can find a unit's result without opening Excel.

## Positioning

The numbers are computed on the backend exactly as the Excel sheets compute them (verified against the sample file), and every view is scoped to the units the viewer is allowed to see — the dashboard is a faithful, governed mirror of the Master file, not an approximation.

## Operating Context

- Runs locally (Next.js + MySQL on a Windows machine); admin-app (react-admin, separate Vite app) handles users and the unit tree.
- Unit tree: MSP → organisation → Zone → Operations (Op) / Sales Zone (Sz) → unit/branch.
- Periods are months; years entered in Buddhist Era (พ.ศ.) on import.
- Money shown either in millions (ล้านบาท) or full baht, toggled by the user and remembered in a cookie.
- UI language is Thai; some menu labels are English (Overview, P&L Analysis, Sales Zone, Operations, Upload Data, Admin).

## Capabilities and Constraints

- Roles: admin, executive, accountant, branch_manager. Permissions: dashboard.view, report.export, data.upload, users.manage.
- Losses must stand out clearly (negative values are the most important signal).
- Must keep working behaviour: URL-held state (period, unit, sort), skeleton loading, money-format cookie, light and dark themes following the OS (both must be well designed).

## Brand Commitments

- Name "MSP Interfood"; logo mark is the letter M. MSP brand red (#d3263a) is the one binding brand trait; the rest of the visual world is open for redesign (user confirmed 2026-10-14).

## Evidence on Hand

- Real data comes from the Master workbook (`PreView_ForClaude/`); no testimonials, marketing claims or external proof exist and none should be invented.

## Product Principles

1. Exactness over flourish: every figure must be legible, aligned and traceable to the statement.
2. Scan first, drill second: the month's state is readable in one glance; detail is one click away.
3. Scope is invisible but absolute: users only ever see units they are allowed to.
4. Daily-tool calm: an accountant spends hours here; nothing should tire the eye or slow them down.

## Accessibility & Inclusion

Text contrast ≥ 4.5:1 in both themes; loss/gain never conveyed by colour alone (sign, arrow or label too); keyboard-navigable; respects prefers-reduced-motion.
