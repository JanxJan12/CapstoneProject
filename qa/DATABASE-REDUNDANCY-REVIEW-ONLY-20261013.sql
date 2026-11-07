-- RRJ'S FOOD-HOUSE hosted database: read-only review preview.
-- Target: zhzluhqvysvsadwuugpa. Execute only as SELECTs after verifying target.
-- No row identifiers, customer details, proof paths, DML, or DDL are returned.
-- Re-run immediately before any separately approved remediation: counts can drift.

-- Empty legacy-looking entities: zero rows does not authorize dropping a table.
SELECT 'supplier_items' AS relation, count(*) AS rows FROM public.supplier_items
UNION ALL SELECT 'suppliers', count(*) FROM public.suppliers
UNION ALL SELECT 'purchase_orders', count(*) FROM public.purchase_orders
UNION ALL SELECT 'purchase_order_items', count(*) FROM public.purchase_order_items
UNION ALL SELECT 'production_replenishment_requests', count(*) FROM public.production_replenishment_requests
UNION ALL SELECT 'production_replenishment_status_events', count(*) FROM public.production_replenishment_status_events
UNION ALL SELECT 'inventory_opening_balances', count(*) FROM public.inventory_opening_balances
UNION ALL SELECT 'inventory_transaction_batch_allocations', count(*) FROM public.inventory_transaction_batch_allocations
UNION ALL SELECT 'paid_order_cancellations', count(*) FROM public.paid_order_cancellations;

-- The following business keys would be suspicious only if excess_rows > 0.
WITH keyed AS (
  SELECT 'order request id' AS key_name, count(*) AS n
    FROM public.orders WHERE customer_request_id IS NOT NULL
    GROUP BY customer_id, customer_request_id HAVING count(*) > 1
  UNION ALL
  SELECT 'order number', count(*) FROM public.orders
    GROUP BY order_number HAVING count(*) > 1
  UNION ALL
  SELECT 'cashier order link', count(*) FROM public.cashier_transactions
    GROUP BY order_id HAVING count(*) > 1
  UNION ALL
  SELECT 'inventory mutation id', count(*) FROM public.inventory_transactions
    WHERE mutation_request_id IS NOT NULL
    GROUP BY mutation_request_id HAVING count(*) > 1
  UNION ALL
  SELECT 'recipe item pair', count(*) FROM public.menu_ingredients
    GROUP BY menu_item_id, inventory_item_id HAVING count(*) > 1
)
SELECT key_name, count(*) AS duplicate_groups, coalesce(sum(n - 1), 0) AS excess_rows
FROM keyed GROUP BY key_name ORDER BY key_name;

-- Repeated status is an event-review queue, not a deletion target.
WITH repeated AS (
  SELECT order_id, status, count(*) AS n,
         min(created_at) AS first_at, max(created_at) AS last_at,
         count(DISTINCT coalesce(notes, '')) AS note_variants
  FROM public.order_status_history
  GROUP BY order_id, status HAVING count(*) > 1
)
SELECT status::text, count(*) AS groups, sum(n - 1) AS repeated_status_rows,
       min(last_at - first_at) AS shortest_span,
       max(last_at - first_at) AS longest_span,
       count(*) FILTER (WHERE note_variants > 1) AS changed_notes_groups
FROM repeated GROUP BY status ORDER BY status;

-- Candidate QA markers are labels only. Provenance requires operator records,
-- request IDs, audit trail, and backup comparison before calling data synthetic.
SELECT 'order notes' AS field, count(*) AS marker_hits
FROM public.orders WHERE coalesce(notes, '') ~* '(test|demo|qa|example)'
UNION ALL SELECT 'inventory reasons', count(*) FROM public.inventory_transactions
WHERE coalesce(reason, '') ~* '(test|demo|qa|example)'
UNION ALL SELECT 'status history notes', count(*) FROM public.order_status_history
WHERE coalesce(notes, '') ~* '(test|demo|qa|example)';

-- Enabled duplicate profile timestamp triggers; definitions must be reviewed
-- before any separate schema proposal is tested locally.
SELECT tgname, tgenabled, tgfoid::regprocedure::text AS target,
       pg_get_triggerdef(oid) AS definition
FROM pg_trigger
WHERE tgrelid = 'public.profiles'::regclass AND NOT tgisinternal
ORDER BY tgname;

-- Retention sizing only. No age cutoff has been approved.
SELECT 'orders' AS relation, count(*) AS rows, min(created_at) AS oldest,
       max(created_at) AS newest FROM public.orders
UNION ALL SELECT 'order_status_history', count(*), min(created_at), max(created_at)
FROM public.order_status_history
UNION ALL SELECT 'inventory_transactions', count(*), min(created_at), max(created_at)
FROM public.inventory_transactions;
