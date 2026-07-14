Improve the existing RRJ Food-House UI/UX blueprint. Do not redesign from scratch. Keep the same branding, red primary color, Inter font, rounded cards, white surfaces, and enterprise SaaS style.

Goal:
Make the system look more realistic, operational, and production-ready, similar to Shopify Admin, Toast POS, Square Dashboard, Grab Merchant, and Foodpanda Merchant.

General Improvements:
1. Increase information density. Reduce excessive empty space.
2. Make screens feel like real business software with more realistic data.
3. Use tables for management-heavy modules.
4. Use cards only where they improve scanning.
5. Add clearer page headers, filters, search bars, and action buttons.
6. Add role-based navigation groups.
7. Add reusable status badges and realistic system states.
8. Maintain clean spacing and accessibility.

Navigation Improvements:
Revise the Manager sidebar into grouped sections:

OPERATIONS
- Dashboard
- Orders
- Payments
- Kitchen Monitor

INVENTORY
- Menu Management
- Inventory
- Inventory Transactions
- Suppliers
- Purchase Orders

PEOPLE
- Riders
- Customers

REPORTS
- Sales Reports
- Inventory Reports
- Order Reports
- Waste Reports

SYSTEM
- Settings

Top Bar Improvements:
- Larger global search: “Search orders, menu items, suppliers…”
- Notification dropdown showing:
  - Payment pending
  - Low stock alert
  - Order ready
  - Rider unavailable
- User profile dropdown showing:
  - Profile
  - Settings
  - Log out

Manager Dashboard Improvements:
Add more realistic dashboard data:
- Sales Today
- Orders Today
- Pending Payments
- Low Stock Items
- Active Riders
- Completed Orders
- Cancelled Orders
- Walk-in Orders
- Delivery Orders
- Average Order Value
- Top Selling Item

Add sections:
- Revenue trend chart
- Orders by status chart
- Recent Orders table
- Inventory Alerts list
- Recent Payments table
- Recent Inventory Transactions
- Quick Actions:
  - Add Menu Item
  - Add Inventory Item
  - Create Purchase Order
  - View Reports

Order Management Module:
Create a complete Orders module with:
- All Orders table
- Filters by status, date, order type
- Search by order ID/customer
- Order details drawer/modal
- Status timeline:
  - Waiting for Payment Verification
  - Confirmed
  - Preparing
  - Ready
  - Waiting for Rider
  - Rider Accepted
  - Picked Up
  - Out for Delivery
  - Delivered
  - Cancelled
- Columns:
  - Order ID
  - Customer
  - Type
  - Status
  - Total
  - Created At
  - Assigned Rider
  - Actions

Payment Verification Module:
Improve cashier payment verification with:
- Pending payments table
- Payment detail view
- Proof of payment image preview
- Customer information
- Order summary
- Amount paid
- Verify Payment button
- Reject Payment button
- Rejection confirmation dialog
- Success state: Payment Verified
- After verification, order is sent to Kitchen Queue

Cashier POS Module:
Create a realistic walk-in order POS screen:
- Menu category sidebar
- Menu item grid
- Cart panel
- Quantity controls
- Order type: dine-in, take-out, delivery
- Payment method: cash or GCash
- Confirm order button
- Transaction summary

Kitchen Module Improvements:
Redesign Kitchen Queue as a Kanban board:
- Confirmed
- Preparing
- Ready
- Completed

Each order card should show:
- Order ID
- Order type
- Customer name or Walk-in
- Time received
- Items and quantities
- Priority/time indicator
- Action button:
  - Start Preparing
  - Mark as Ready
  - Complete

Make the kitchen screen feel busy with multiple realistic order cards.

Inventory Module Improvements:
Create:
- Inventory Dashboard
- Inventory List table
- Inventory Details
- Add/Edit Inventory Item
- Stock Receiving
- Inventory Adjustment
- Waste Recording
- Spoilage Recording
- Inventory Transaction History

Inventory List columns:
- Item Name
- Category
- Unit
- Quantity
- Reorder Level
- Stock Status
- Last Updated
- Actions

Stock Status:
- Healthy
- Reorder Soon
- Critical

Use realistic examples:
- Rice
- Cooking Oil
- Marinated Chicken Pecho
- Chicken Lumpia
- Beef
- Flour
- Noodles
- Vegetables
- Shrimp
- Iced Tea Mix

Inventory Transaction History columns:
- Transaction ID
- Item
- Type
- Quantity
- Related Order/Purchase Order
- Date
- Actions

Supplier and Purchase Order Improvements:
Create:
- Supplier List
- Supplier Details
- Create Purchase Order
- Purchase Order Details
- Receive Purchase Order

Purchase Order table columns:
- PO Number
- Supplier
- Status
- Total Amount
- Order Date
- Created By
- Actions

Purchase Order details should show:
- Supplier info
- Ordered items
- Quantity
- Unit cost
- Total cost
- Receive button

Customer Website Improvements:
Make the customer website more complete:
- Landing page with hero section
- Store hours
- Browse by category
- Popular items
- Menu grid
- Cart
- Checkout
- Upload GCash proof of payment
- Order tracking timeline

Keep customer flow:
Browse Menu → Add to Cart → Checkout → Google Login if needed → Upload Proof of Payment → Track Order

Do not add reviews, coupons, loyalty, live GPS, or wallet.

Rider App Improvements:
Improve mobile rider app with:
- Bottom navigation:
  - Home
  - Deliveries
  - History
  - Profile

Screens:
- Splash
- Login
- Home with availability toggle
- Delivery Requests
- Delivery Details
- Accept/Reject Delivery
- Navigation Assistance
- Update Status
- Upload Proof of Delivery
- Delivery History
- Profile

Delivery detail should show:
- Customer name
- Contact number
- Address
- Landmark
- Order items
- Delivery fee
- Status
- Buttons:
  - Accept Delivery
  - Picked Up
  - Out for Delivery
  - Delivered
  - Upload Proof

System States Improvements:
Add reusable states for:
- Loading
- Saving
- Uploading
- Empty
- Error
- No Internet
- Server Error
- Unauthorized
- Session Expired
- No Orders Found
- No Inventory Found
- No Rider Available
- Waiting for Rider
- Payment Verified
- Order Confirmed
- Low Stock Warning
- File Uploaded
- Delete Confirmation
- Reject Confirmation

Important:
Do not add features outside the approved capstone scope.
Do not include AI chatbots, loyalty rewards, coupons, customer ratings/reviews, real-time rider GPS tracking, in-app wallet, automated dispatch optimization, third-party delivery integration, or multi-branch management.

Final Output:
Produce an improved, organized, high-fidelity Figma blueprint with all modules, realistic operational data, professional tables, status badges, forms, dialogs, loading states, and screen flows ready for React and React Native development.