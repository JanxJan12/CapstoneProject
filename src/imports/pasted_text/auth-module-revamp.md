Revise and improve the existing Authentication Module for the RRJ Food-House Management System. Keep the current visual design language, branding, colors, typography, spacing, and component style. This is a design refinement, not a complete redesign.

The goal is to make the authentication experience comparable to modern enterprise systems such as Grab Merchant, Shopify Admin, Toast POS, Stripe Dashboard, and Uber Eats Merchant.

==================================================
GENERAL IMPROVEMENTS
==================================================

Do not redesign the interface from scratch.

Preserve the current layout and branding.

Improve usability, accessibility, hierarchy, consistency, professionalism, and realism.

Maintain Auto Layout, reusable components, consistent spacing, and modern enterprise UI.

==================================================
STAFF LOGIN IMPROVEMENTS
==================================================

Remove the role selection chips (Manager, Cashier, Kitchen Staff).

Users should never manually choose their role.

The system determines the user's role after successful authentication.

Change the page title from:

"Staff Sign In"

to

"Staff Portal"

Update the subtitle to:

"Sign in to access the RRJ Food-House Management System."

Replace the footer text with:

"Only authorized personnel may access this system. Unauthorized access is prohibited."

Create additional UI states:

• Default
• Invalid credentials
• Loading
• Account disabled

The Sign In button should include a loading state with spinner and the text:

"Signing In..."

Create a reusable error banner component displaying:

"Invalid email or password. Please try again."

Do not reveal whether the email or password is incorrect.

==================================================
CUSTOMER LOGIN IMPROVEMENTS
==================================================

Keep Google authentication.

Replace:

"Continue as Guest"

with

"Browse Menu"

The Browse Menu button should allow customers to browse products before authentication.

Authentication should only be required during checkout.

Remove the sentence:

"No account required to browse or place a guest order."

Simplify the layout by reducing unnecessary text.

==================================================
RIDER LOGIN IMPROVEMENTS
==================================================

Replace:

"Registered riders only"

with

"Authorized delivery partners only."

Replace:

"Contact your manager if you need access."

with

"Need access? Please contact RRJ Food-House management."

Maintain the existing mobile-first layout.

Improve spacing and touch target sizes.

==================================================
FORGOT PASSWORD
==================================================

Keep the current layout.

Add a success confirmation screen after submission.

Display:

Password Reset Email Sent

"If the email exists in our records, a password reset link has been sent."

Add a button:

Return to Login

==================================================
REMOVE ROLE REDIRECT PAGE
==================================================

Remove the current Role Redirect demonstration page.

Replace it with a system loading screen.

Title:

Authenticating...

Subtitle:

Checking account permissions...

Display a centered loading animation.

After loading, indicate that users are automatically redirected based on their assigned role.

==================================================
ADD NEW AUTHENTICATION SCREENS
==================================================

Create the following additional screens.

1.

Session Expired

Message:

"Your session has expired. Please sign in again."

Button:

Return to Login

---------------------------------------

2.

Unauthorized (403)

Message:

"You do not have permission to access this page."

Button:

Return to Login

---------------------------------------

3.

Account Disabled

Message:

"Your account has been disabled. Please contact the administrator."

Button:

Return to Login

---------------------------------------

4.

Maintenance Mode

Message:

"The system is currently undergoing maintenance. Please try again later."

==================================================
ACCESSIBILITY
==================================================

Increase button height to approximately 48–52px.

Increase input height to approximately 48px.

Ensure color contrast meets WCAG AA.

Maintain consistent spacing.

==================================================
FINAL GOAL
==================================================

Produce a polished enterprise authentication module suitable for production software.

The module should look like authentication used in professional restaurant management platforms and be fully consistent with the approved RRJ Food-House capstone scope.