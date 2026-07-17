Transform the current RRJ Food-House Management System prototype into a fully connected, production-quality application prototype. Do not redesign the existing visual identity—the current red, white, and black branding, typography, spacing, cards, and overall design language should remain consistent. Instead, improve the functionality, realism, and connectivity of every module.

The goal is to make this prototype feel like a complete restaurant management system that could realistically be deployed, where every screen is part of the same application and every action affects the rest of the system.

Global Requirements
Every page must be connected through realistic navigation.
Every button should perform a logical action.
Every table row should open a detailed page or modal.
Every form should have validation.
Every module should use the same shared demo data.
Status changes in one module should immediately reflect throughout the system.
Replace placeholder cards with realistic restaurant data.
Avoid creating isolated UI showcase pages.
Make the prototype feel like an actual software product instead of a UI gallery.
Authentication System

Replace the current authentication preview with a realistic authentication workflow.

The login screen should automatically determine the user's role after successful authentication.

Flow:

Email + Password

↓

Authenticating...

↓

Verifying Credentials

↓

Checking Permissions

↓

Loading Workspace

↓

Automatically Redirect

Do not ask the user to manually choose Manager, Cashier, or Kitchen after logging in.

Instead, determine the destination from the authenticated account.

Examples:

Manager account → Manager Dashboard

Cashier account → Cashier Dashboard

Kitchen Staff account → Kitchen Queue

Customer account → Customer Website

Rider account → Rider Mobile App

Demo Accounts

Create a collapsible "Demo Accounts" section with working credentials.

Example:

Manager

Email:
manager@rrjfoodhouse.com

Password:
password123

Cashier

Email:
cashier@rrjfoodhouse.com

Password:
password123

Kitchen

Email:
kitchen@rrjfoodhouse.com

Password:
password123

Customer

Email:
customer@gmail.com

Password:
password123

Rider

Email:
rider@rrjfoodhouse.com

Password:
password123

Each account should automatically redirect to its proper dashboard.

Customer Website

Redesign the customer experience to feel like a modern food ordering website similar to FoodPanda or GrabFood while keeping the current branding.

Instead of a simple landing page, include:

Sticky Navigation

Featured Banner

Popular Today

Recommended Meals

Categories

Meals

Rice

Soups

Vegetables

Desserts

Drinks

Product Cards

Each product should contain:

Food Image

Name

Description

Price

Availability

Rating

Add to Cart button

Clicking a product should open:

Large Image

Description

Ingredients

Price

Quantity Selector

Special Instructions

Add to Cart

Cart should be functional.

Include:

Shopping Cart

Quantity Adjustment

Subtotal

Delivery Fee

Checkout

Checkout should support:

Delivery Address

Contact Number

GCash QR Payment

Upload Proof of Payment

Order Confirmation

After ordering:

Order status should update live.

Track Order page should display:

Pending Payment

Payment Verified

Preparing

Ready

Out for Delivery

Delivered

Completed

Cashier Module

Expand the cashier dashboard into a complete POS.

Include:

Walk-in POS

Food Categories

Search Menu

Add to Cart

Quantity

Discount

Senior/PWD

Cash Payment

GCash Verification

Receipt Preview

Print Receipt

Pending GCash Verification

Payment History

Transaction History

When the cashier verifies payment:

The order automatically moves to the Kitchen Queue.

Kitchen Module

Keep the Kanban layout.

Improve functionality.

Clicking any order card should open a detailed modal showing:

Customer

Order Number

Order Type

Items

Quantity

Special Instructions

Preparation Timer

Buttons:

Start Preparing

Mark Ready

Complete

Moving an order should automatically update customer tracking and manager dashboard.

Manager Module

Keep the current layout.

Expand every feature.

Dashboard

Revenue Analytics

Top Selling Items

Low Stock

Pending Payments

Kitchen Status

Active Riders

Orders

View Details

Assign Rider

Cancel Order

Edit Status

Timeline

Inventory

Stock Levels

Receive Stock

Adjust Stock

Waste & Spoilage

Transaction History

Purchase Orders

Suppliers

CRUD

Reports

Daily

Weekly

Monthly

Sales

Inventory

Deliveries

Payments

Settings

Users

Roles

System Preferences

Inventory

Replace placeholder tables with realistic inventory cards.

Each item should include:

Image

Name

Current Stock

Minimum Level

Supplier

Receive Stock

Adjust

History

Low stock should generate warning badges.

Orders Module

Replace "View" buttons with "View Details."

Order Detail should display:

Customer

Address

Phone

Ordered Items

Payment Proof

Kitchen Timeline

Assigned Rider

Delivery Timeline

Order History

Status Updates

Manager Actions

Rider Mobile App

Expand the rider experience.

After login, show:

Good Morning

Rider Name

Availability Toggle

Today's Earnings

Completed Deliveries

Pending Requests

Current Delivery

Navigation

Delivery History

Profile

Delivery Details should include:

Customer

Address

Contact Number

Navigation Button

Proof of Delivery Upload

Delivered Button

Uploading proof should immediately update:

Manager Dashboard

Customer Tracking

Order Status

Real Order Lifecycle

Connect every module using one shared workflow.

Customer

↓

Browse Menu

↓

Add to Cart

↓

Checkout

↓

Upload GCash Proof

↓

Cashier

↓

Verify Payment

↓

Kitchen

↓

Preparing

↓

Ready

↓

Manager

↓

Assign Rider

↓

Rider

↓

Accept Delivery

↓

Navigate

↓

Upload Proof

↓

Delivered

↓

Customer Receives Order

Every dashboard should reflect this same lifecycle.

Interactive Features

Implement realistic interactions:

Search

Sorting

Filtering

Pagination

CRUD Modals

Confirmation Dialogs

Delete Confirmation

Success Toasts

Loading States

Error States

Empty States

Validation Messages

These should appear naturally inside each workflow instead of existing as separate showcase pages.

Shared Demo Data

Use one consistent dataset across the entire application.

For example:

Customer:
Maria Santos

Order:
ORD-1048

Payment:
Verified

Kitchen:
Preparing

Assigned Rider:
Ramil Abad

Inventory:
Cooking Oil (Low Stock)

Every module should reference this same data so the system feels connected.

Final Goal

The finished prototype should resemble a professionally designed SaaS application rather than a UI concept. It should feel like a complete, working restaurant management system where all modules communicate with one another through realistic user flows. Every screen should have meaningful functionality, logical navigation, shared data, and interactive behaviors that demonstrate how the actual system would work in production. The prototype should be polished enough for a capstone defense and convincing as a real-world software product.