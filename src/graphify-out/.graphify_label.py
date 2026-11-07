import json
from pathlib import Path
from graphify.build import build_from_json
from graphify.cluster import score_all
from graphify.analyze import suggest_questions
from graphify.report import generate
from graphify.export import to_json

out = Path('graphify-out')
extraction = json.loads((out / '.graphify_extract.json').read_text(encoding='utf-8'))
detection = json.loads((out / '.graphify_detect.json').read_text(encoding='utf-8'))
analysis = json.loads((out / '.graphify_analysis.json').read_text(encoding='utf-8'))
root = Path(detection['scan_root'])
G = build_from_json(extraction, root=root, directed=False)
communities = {int(k): v for k, v in analysis['communities'].items()}
cohesion = {int(k): v for k, v in analysis['cohesion'].items()}
names = '''
Manager Inventory Adjustments
Stock Receiving Workflow
Shared UI Components
Payment UI Utilities
Dialogs and Receipts
Sidebar and Navigation
Rider Application Workspace
Cashier Order Types
React UI Foundations
Walk In POS Controller
Cashier Orders Dashboard
Manager API Mapping
Customer Tracking Refresh
Cashier Order Payment Data
Inventory Audit Reconciliation
Kitchen Display Queue
Authentication Landing Screens
Manager Customer Pages
Shared Domain Types
Cashier Store Actions
Manager Phase Two API
POS Menu Grid
Walk In POS Screen
Customer App Navigation
Cashier Shift Settlement
Transaction History Data
Cashier Store Persistence
Inventory Detail Presentation
Rider Application Submission
Cashier Service Layer
Cashier Order List
Inventory Request Workflow
Cashier Dashboard Data
Route Authentication Guards
Cashier Sale Hydration
Manager Menu Management
Authentication Session State
Page Blueprint Navigation
Toggle Alert Badges
Manager Orders Dashboard
Inventory Request Register
Walk In POS Architecture
Dropdown App Shell
Customer Checkout Totals
Receiving Document Views
Context Menu Components
Cashier Order Actions
Cashier Seed Constants
Rider Delivery Components
Carousel UI Components
Transaction History Screen
POS Cart Types
Manager Stock Notifications
Manager Orders Financials
Inventory Overview Screen
Supabase Login Screens
Form Label Components
Cashier Work Queue
Cashier Form Schemas
Cashier Reusable Components
Reports Page Layout
Closed Shift History
Paid Order Cancellation
Transaction Detail Drawer
Drawer UI Components
Select UI Components
Customer GCash Rejection
Online Payment Data
Customer Quote Presentation
Manager Sales Reports
Chart UI Components
Navigation Menu Components
Customer Payment Tracking
Cashier Rider Assignment
Transaction Export Pipeline
Inventory Movement History
Request Document Printing
Pagination UI Components
Customer GCash Verification
Customer Order History
Walk In Sale Creation
Cashier Button Components
Password Recovery Screens
Accordion UI Components
One Time Password UI
Customer Tracking URLs
System State Components
Revenue Chart Component
Collapsible UI Components
Resizable UI Components
Customer Menu Browsing
Data Table Component
Restaurant Exterior Image
Toast Theme Integration
Customer Cart Screen
Customer Checkout Screen
Aspect Ratio Component
Customer Order Tracking
Food House Brand Logo
'''.strip().splitlines()
assert len(names) == len(communities), (len(names), len(communities))
labels = dict(enumerate(names))
questions = suggest_questions(G, communities, labels)
report = generate(G, communities, cohesion, labels, analysis['gods'], analysis['surprises'], detection,
                  {'input': 0, 'output': 0}, str(root), suggested_questions=questions)
report += '\n\n## Extraction metering note\n\nSemantic extraction used collaboration agents whose token usage was unavailable. The recorded 0 input and 0 output tokens reflect missing metering, not zero actual use.\n'
report += '\n`graphify-out/` was written into the working tree and currently appears as untracked files.\n'
(out / 'GRAPH_REPORT.md').write_text(report, encoding='utf-8')
(out / '.graphify_labels.json').write_text(json.dumps({str(k): v for k, v in labels.items()}, indent=2, ensure_ascii=False), encoding='utf-8')
assert to_json(G, communities, str(out / 'graph.json'), community_labels=labels)
analysis['questions'] = questions
(out / '.graphify_analysis.json').write_text(json.dumps(analysis, indent=2, ensure_ascii=False), encoding='utf-8')
print(f'Labeled {len(labels)} communities')
