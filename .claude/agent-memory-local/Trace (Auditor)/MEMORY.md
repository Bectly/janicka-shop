# Trace (Auditor) — Memory Index

- [project_sold_filter_audit.md](project_sold_filter_audit.md) — Cycle #10 audit: sold-filter coverage across all public product queries; cart race condition status
- [project_admin_panel_state.md](project_admin_panel_state.md) — Admin covers dashboard+products only; no image upload UI; no migrations dir; AUTH_SECRET is placeholder
- [project_cycle25_audit.md](project_cycle25_audit.md) — Cycle #25 deep audit: checkout/orders/auth/cart/shop. Core txn safety solid. Open: 2 MEDIUM, 3 LOW.
- [project_cycle34_audit.md](project_cycle34_audit.md) — Cycle #34 extended audit: cart/reservation/auth/schema + checkout/payment/webhook. Open: 1 HIGH, 3 MEDIUM, 6 LOW.
- [project_cycle34b_admin_product_audit.md](project_cycle34b_admin_product_audit.md) — Cycle #34b audit: admin products/orders/actions, catalog/search/detail, price-history. Open: 3 MEDIUM, 3 LOW.
- [project_cycle36_audit.md](project_cycle36_audit.md) — Cycle #36 audit: checkout/payment/webhook/reservation. New: 2 MEDIUM, 2 LOW. Cumulative open: 1 HIGH, 5 MEDIUM, 6 LOW.
- [project_cycle36_auth_security_audit.md](project_cycle36_auth_security_audit.md) — Cycle #36b auth/middleware/security audit. New: missing CSP (MEDIUM), API middleware gap (MEDIUM), 5 LOWs. No new HIGHs.
- [project_cycle36b_catalog_admin_audit.md](project_cycle36b_catalog_admin_audit.md) — Cycle #36c audit: catalog/admin products-orders/cart/reservation/price-history. All C34b MEDIUMs confirmed fixed. New: 1 HIGH, 2 MEDIUM, 3 LOW.
- [project_cycle53_catalog_detail_audit.md](project_cycle53_catalog_detail_audit.md) — Cycle #53 audit: catalog/detail/homepage/search/share-buttons/structured-data. New: 1 HIGH, 2 MEDIUM, 3 LOW.
- [project_cycle53_payment_checkout_audit.md](project_cycle53_payment_checkout_audit.md) — Cycle #53 audit: checkout/payment-return/webhook/comgate.ts/qr-platba/admin-orders. New: 0 HIGH, 2 MEDIUM, 3 LOW. Cumulative open: 1 HIGH, 2 MEDIUM, 4 LOW.
