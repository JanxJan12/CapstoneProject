Create a complete UI/UX blueprint for the RRJ Food-House Management System based on the approved capstone manuscript.

Project Title:
Web- and Mobile-Based Foodhouse Management System for Order Processing, Inventory Management, and Delivery Operations

Goal:
Design all major modules of the system in an organized, professional, enterprise-style layout. The design must reflect the actual system scope: order processing, inventory management, payment verification, kitchen monitoring, rider coordination, supplier and purchase order records, waste/spoilage recording, and reports.

Design Style:
Modern enterprise SaaS, clean, minimal, professional, restaurant management system, similar to Grab Merchant, Foodpanda Merchant, Toast POS, Shopify Admin, Stripe Dashboard, and Square Dashboard. Use RRJ red branding, white surfaces, light gray background, Inter font, rounded corners, soft shadows, clear hierarchy, and reusable components.

Do not add features outside the capstone scope. Do not include AI chatbot, loyalty rewards, coupons, customer reviews, ratings, live GPS tracking, real-time rider map monitoring, in-app wallet, push notifications, or multi-branch management.

Create these pages/modules:

1. Authentication Module

Improve the existing authentication module.

Staff Login:

* Remove role selection chips.
* Title: Staff Portal
* Subtitle: Sign in to access the RRJ Food-House Management System.
* Fields: Email, Password
* Actions: Sign In, Forgot Password
* Add error banner: Invalid email or password. Please try again.
* Add loading state: Signing In...
* Add account disabled state.
* Footer: Only authorized personnel may access this system. Unauthorized access is prohibited.

Customer Login:

* Continue with Google
* Replace “Continue as Guest” with “Browse Menu”
* Customers may browse the menu first, but Google login is required during checkout.

Rider Login:

* Mobile Android frame
* Title: RRJ Rider
* Subtitle: Authorized delivery partners only.
* Fields: Email, Password
* Action: Sign In
* Text: Need access? Please contact RRJ Food-House management.

Forgot Password:

* Email field
* Send Reset Link button
* Success screen: Password Reset Email Sent
* Message: If the email exists in our records, a password reset link has been sent.
* Return to Login button

Replace Role Redirect screen with:

* Authenticating screen
* Text: Checking account permissions...
* Users are automatically redirected based on assigned role.

Add:

* Session Expired screen
* Unauthorized 403 screen
* Account Disabled screen
* Maintenance Mode screen

2. Main Web Application Layout

Create a reusable desktop layout for Manager, Cashier, and Kitchen modules.

Include:

* Sidebar navigation
* Top navigation bar
* User profile menu
* Notifications
* Breadcrumbs
* Search
* Page header
* Content area
* Responsive layout

Sidebar items for Manager:

* Dashboard
* Menu Management
* Inventory
* Suppliers
* Purchase Orders
* Orders
* Payments
* Kitchen Monitor
* Riders
* Reports
* Settings

3. Manager Dashboard

Purpose:
Give the manager an overview of daily operations.

Include:

* Total Sales Today
* Total Orders Today
* Pending Payments
* Low Stock Items
* Active Riders
* Recent Orders table
* Inventory Alerts
* Sales chart
* Quick actions:

  * Add Menu Item
  * Add Inventory Item
  * Create Purchase Order
  * View Reports

Functions:

* Manager monitors sales, orders, inventory alerts, rider activity, and recent transactions.

4. Menu Management Module

Screens:

* Menu List
* Add Menu Item
* Edit Menu Item
* Category Management
* Menu Details

Include:

* Search
* Category filter
* Availability toggle
* Price
* Description
* Image placeholder
* Add/Edit/Delete actions

Functions:

* Manager can add, edit, delete, and mark menu items as available or unavailable.

5. Inventory Management Module

Screens:

* Inventory Dashboard
* Inventory List
* Inventory Details
* Add Inventory Item
* Edit Inventory Item
* Stock Receiving
* Inventory Adjustment
* Waste Recording
* Spoilage Recording
* Inventory Transaction History

Include:

* Item name
* Unit of measurement such as pcs, kg, liters
* Quantity
* Reorder level
* Inventory category
* Low stock badges
* Transaction type badges:

  * stock receiving
  * stock issuance
  * order deduction
  * adjustment
  * restock
  * waste
  * spoilage

Functions:

* Manager monitors stock levels.
* Inventory can be updated through receiving, issuance, adjustments, waste, and spoilage records.
* Low stock alert appears when quantity reaches reorder level.
* Use standardized units rather than automatic unit conversion.

6. Supplier and Purchase Order Module

Screens:

* Supplier List
* Supplier Details
* Add Supplier
* Edit Supplier
* Purchase Order List
* Create Purchase Order
* Purchase Order Details
* Receive Purchase Order

Include:

* Supplier name
* Contact number
* Purchase order status:

  * pending
  * received
  * cancelled
* Purchase order items
* Quantity
* Unit cost
* Total cost
* Total amount

Functions:

* Manager can record suppliers.
* Manager can create purchase orders.
* Received purchase orders increase inventory stock.
* Purchase order items are linked to inventory items.

7. Customer Website

Screens:

* Customer Landing Page
* Menu Browsing
* Menu Details
* Cart
* Checkout
* Google Login Prompt
* Upload Proof of Payment
* Order Tracking
* Order History
* Customer Profile

Include:

* Food categories
* Menu cards
* Quantity selector
* Cart summary
* Delivery details
* GCash proof upload
* Order status timeline:

  * Waiting for Payment Verification
  * Confirmed
  * Preparing
  * Ready
  * Waiting for Rider
  * Rider Accepted
  * Picked Up
  * Out for Delivery
  * Delivered

Functions:

* Customer can browse menu.
* Customer can place delivery order.
* Customer uploads proof of GCash payment.
* Customer can track order status.

8. Cashier Module

Screens:

* Cashier Dashboard
* Pending Payment Verification
* Payment Verification Details
* Walk-in Order POS
* Order List
* Transaction History

Include:

* Customer order details
* Proof of payment image preview
* Verify Payment button
* Reject Payment button
* Walk-in order creation
* Order status update
* Payment status badges:

  * pending
  * verified
  * rejected

Functions:

* Cashier verifies proof of payment.
* Cashier confirms or rejects orders.
* Cashier creates walk-in orders.
* Confirmed orders are sent to the kitchen.
* Inventory availability is checked before confirmation.

9. Kitchen Module

Screens:

* Kitchen Queue
* Order Details
* Preparing Orders
* Ready Orders
* Completed Orders

Include:

* Order cards
* Food items and quantity
* Status buttons:

  * Start Preparing
  * Mark as Ready
* Time received
* Customer/order type

Functions:

* Kitchen staff views confirmed orders.
* Kitchen updates order status from Confirmed to Preparing to Ready.
* Ready orders become available for rider coordination.

10. Rider Management Module

Screens:

* Rider List
* Rider Details
* Rider Account Review
* Rider Availability Monitoring

Include:

* Rider name
* Contact number
* Valid ID
* OR/CR document
* License number
* Plate number
* Motor brand/model
* Availability status:

  * available
  * on_delivery
  * offline

Functions:

* Manager monitors rider accounts.
* Riders are registered and managed within the system.
* Rider availability supports delivery coordination.

11. Rider Mobile App

Design in Android mobile frames.

Screens:

* Splash Screen
* Rider Login
* Home / Today’s Deliveries
* Availability Toggle
* Delivery Requests
* Delivery Details
* Accept Delivery
* Reject Delivery
* Navigation Assistance screen
* Update Status:

  * Rider Accepted
  * Picked Up
  * Out for Delivery
  * Delivered
* Upload Proof of Delivery
* Delivery History
* Rider Profile

Functions:

* Rider logs in.
* Rider sets availability.
* Rider receives delivery requests when available.
* Rider accepts or rejects requests.
* Rider views customer details and location.
* Rider updates delivery status.
* Rider uploads proof of delivery.

12. Reports Module

Screens:

* Sales Report
* Inventory Report
* Purchase Order Report
* Inventory Transaction Report
* Waste and Spoilage Report
* Order Report

Include:

* Date filters
* Search
* Export button placeholder
* Summary cards
* Tables
* Charts

Functions:

* Manager reviews operational records.
* Reports support monitoring of sales, inventory, purchase orders, waste, and transactions.

13. System States and Feedback

Create reusable states:

* Loading
* Empty State
* Error State
* Success Toast
* Delete Confirmation
* Reject Confirmation
* Payment Verified Success
* Order Confirmed Success
* Low Stock Warning
* No Rider Available
* Waiting for Rider
* No Orders Found

14. Design Requirements

Use:

* Auto Layout
* Reusable components
* Component variants
* Consistent spacing
* Consistent typography
* Responsive desktop layout
* Android mobile layout for rider app
* Clear page titles
* Professional tables
* Status badges
* Search and filters
* Accessible button sizes
* WCAG AA contrast

Final Output:
Create a complete organized Figma blueprint with all modules and screens. The design should be ready for developer handoff and should clearly show how the system works based on the approved capstone scope.
