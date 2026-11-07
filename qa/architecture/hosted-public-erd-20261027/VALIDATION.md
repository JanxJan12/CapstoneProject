# Hosted public ERD validation

Captured: 2026-10-26T20:58:45.038881+00:00; project: zhzluhqvysvsadwuugpa. All hosted operations were SELECT-only pg_catalog reads. This is a point-in-time snapshot.

| Check | Result | Evidence |
| --- | --- | --- |
| public table count | **PASS** | 36 observed; 36 expected from prior mapping |
| column count | **PASS** | 414 / 414 |
| primary key coverage | **PASS** | 36 PK constraints / 36 tables |
| unique constraint count | **PASS** | 31 observed |
| foreign key count | **PASS** | 80 observed |
| table-to-domain coverage | **PASS** | unmapped: none; unknown: none |
| FK column resolution | **PASS** | 0 unresolved public endpoints |
| rendered SVG count | **PASS** | 7 / 7 |
| overview rendered table/edge coverage | **PASS** | 37 nodes (36 public + auth.users), 80 / 80 edges |
| domain rendered table/edge coverage | **PASS** | 36 / 36 nodes, 43 / 43 internal edges |
| key index coverage | **PASS** | 67 / 67 PK and UQ constraints |
| unique-index cardinality filter | **PASS** | 3 expression indexes tagged; partial/invalid indexes excluded |
| relationship index coverage | **PASS** | 80 unique IDs |

Observed: **36 tables, 414 columns, 36 PKs, 31 unique constraints, 80 FKs**. 2 composite FKs; 37 cross-domain or external FKs; 1 FK to auth.users. All 36 mapped public tables remain present; no added or missing table was observed.

A relationship is included only if backed by pg_constraint.contype = f. One-to-one maximums use a full, unconditional unique key or unique index on the child FK columns. Partial, invalid, and expression-based unique indexes are excluded from cardinality inference. Optional child-to-parent participation derives from column nullability (for a composite MATCH SIMPLE FK, any nullable component makes the parent optional). FK constraints alone never require a parent to have children. Defaults, exact types, and all composite key columns are in the catalog and dictionary. The Mermaid type tokens normalize punctuation for parser compatibility; exact PostgreSQL type spelling is displayed in SVG and dictionary.

**NOT VERIFIED:** live write behavior, hosted authenticated flows, business semantics inferred from application code, future schema stability, and rendering the alternative Mermaid sources in Mermaid itself. The delivered HTML/SVG was rendered from the editable DOT sources and opened in Chrome. No business data or schema was changed.

Render: npm install --prefix <temp-renderer-folder> --no-save @hpcc-js/wasm-graphviz@1.30.0; set ERD_GRAPHVIZ_PACKAGE if using another folder; then run node build-erd.mjs.
