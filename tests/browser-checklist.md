# Browser verification

Use a fresh local test owner and sample contact details. These steps verify actual UI interactions, not just API responses.

1. Open `/signup`, create an account, and confirm redirect to onboarding.
2. Enter business details and confirm the page address is generated from the name.
3. Add a service; verify its price and duration appear in the service list.
4. Save weekly opening hours.
5. Publish from Overview and open the customer page.
6. Choose a day and a time, submit sample customer details, and verify the confirmation reference.
7. Return to the owner workspace, reload, and verify the booking persists.
8. Open booking details and change its status; verify the corresponding filtered list.
9. Unpublish from Business page; verify the page and directory entry are unavailable publicly.
10. Log out; verify protected owner routes return to login.
11. Check home, directory, owner workspace, and booking page at 390px and desktop widths for overflow and legibility.
12. Explore `/demo`: confirm it is labeled sample data and offers sign-up instead of editing its services or hours.

Backend integration tests independently check concurrent booking conflicts, cross-owner access, and demo-contact redaction.
