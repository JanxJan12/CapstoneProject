# Customer ordering design

Scope: the active `/customer` app screens. The RRJ logo, restaurant image, catalog, and customer order data are the material. Preserve routes, fields, handlers, server quotes, GCash steps, order and payment states.

The ordering task leads. Home introduces the restaurant briefly and immediately exposes categories and available dishes. Menu is a searchable list. Cart and checkout use one item column and one amount column. Tracking leads with the persisted status and next step. History is a scannable list; profile is a contact form with account context.

Use Manrope with Segoe UI as fallback, with a restrained 16px body and 14px supporting copy. Follow the supplied Foodpanda menu screenshots: firm section and item headings, regular descriptions, and medium-weight controls rather than bold text everywhere. The customer palette draws from the real RRJ logo and venue photo: warm paper, charcoal, and a restrained umbrella red action color. These roles live in `tokens.css`; `customer-ui.css` consumes them. The Home hero uses the original venue photo, cropped and exposure-adjusted in CSS. Keep shape modest, use hairlines for grouping, and reserve filled surfaces for major regions. Buttons and inputs need visible focus and 44px touch targets on phones. Motion only acknowledges state and must respect reduced motion.

Never add dish photography without a verified catalog image path, fabricated ratings, popularity, promotions, prices, delivery estimates, maps, or order states. Live transactional verification requires a separate authenticated test; a visual capture does not prove checkout or payment.
