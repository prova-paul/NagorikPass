# NagorikPass — Product Requirements Document

> Source: `NagorikPass_PRD_Updated.docx`, supplied by the user. Preserve this file as the product requirements baseline. If the original PRD is updated, reconcile changes explicitly rather than silently overwriting requirements.

## 1. Product overview
NagorikPass is a digital Visitor Management System (VMS) designed to streamline visitor registration, check-in, check-out, and visit tracking within an organization. It replaces manual visitor logs with a centralized platform for HR/Admin, Receptionists, and Employees.

The system provides visitor records, expected visitor lists, real-time visit status, notifications, dashboards, visitor history, and reports, with role-based access control.

## 2. Product goal
Make visitor handling secure, organized, traceable, and efficient through reliable visitor records, streamlined check-in/check-out, clear responsibilities, and privacy-aware access.

## 3. Platforms and technology
- HR/Admin: Web application
- Employee: Web application
- Receptionist: Web and mobile application (responsive web experience unless a separate native app is later approved)
- Frontend: React, TypeScript, Vite
- Backend platform: Supabase
- Database: Supabase PostgreSQL
- Authentication: Supabase Auth
- Authorization: Role-based access control and database policies
- Notifications: Integration, subject to availability

## 4. User roles and responsibilities

### 4.1 HR/Admin
- Manage employees, receptionists, and visitor records.
- Register expected visitors in advance.
- Monitor dashboards, visitor history, and reports.
- Receive notifications when visitors check in.
- Monitor employee-initiated visitors.
- Register visitor cards manually or through bulk Excel upload.
- Monitor card status and assignment history.
- Upload interview candidate lists through Excel.
- Register VIP visits and groups.

### 4.2 Receptionist
- View expected visitors.
- Register unscheduled visitors.
- Search for employees visitors want to meet.
- Check visitors in and out.
- Manage visitor information through web and mobile interfaces.
- Assign an available visitor card at check-in.
- Confirm card return at check-out.
- Must not check in delivery personnel.

### 4.3 Employee
- Coordinate visitor invitations with HR/Admin.
- Provide visitor information before the visit.
- Take responsibility for coordinating invited visitors.
- Register visitors directly through the employee web application without prior HR/Admin approval.

## 5. Visitor categories
- Business Meeting
- Job Interview (Interview Candidate)
- VIP Visit (VIP Visitor or Group)
- Vendor / Supplier
- Maintenance / Technician
- Personal Guest
- Delivery / Courier (not permitted to enter; never checked in)
- Other

## 6. Visitor information
### Mandatory
- Visitor name
- Phone number
- Purpose of visit

### Additional
- Number of guests
- Invited-by employee
- Visitor's company or organization

Visitor records also include visitor category/type, host employee, scheduled arrival/departure where supplied, actual check-in/check-out timestamps, and visitor card issued.

## 7. Standard check-in and check-out

### 7.1 Check-in
1. Receptionist registers the visitor or finds the visitor in the system.
2. Receptionist selects an Available visitor card from the visitor list.
3. Receptionist clicks Check-in.
4. System links the card number to the visitor record.
5. System records check-in time.
6. Card status changes from Available to Issued.
7. Assigned card number and visitor details appear on the HR/Admin dashboard.
8. HR/Admin is notified according to the notification requirement.

### 7.2 Check-out
1. Visitor returns the assigned card to the Receptionist.
2. Receptionist clicks Check-out.
3. System asks: **"Did you get the visitor card back?"**
4. If Yes:
   - Record check-out time.
   - Change visitor status to Checked Out.
   - Change card status from Issued to Available.
   - Update HR/Admin dashboard.
   - Preserve card assignment/return history.
5. If No:
   - Do not complete check-out.
   - Visitor remains Checked In.
   - Card remains Issued and linked to the visitor.
   - Receptionist must recover the card before completing check-out.

## 8. Visitor workflows

### Workflow A — HR/Admin pre-registers visitor
1. HR/Admin registers visitor with required information.
2. Visitor appears in Receptionist's Expected Visitors list.
3. On arrival, Receptionist verifies identity and checks visitor in.
4. System records check-in and notifies HR/Admin.
5. Receptionist checks visitor out when the visit ends.

### Workflow B — Employee-initiated visitor
1. Employee logs in and selects Add New Visitor.
2. Employee enters visitor information and visit details.
3. System adds visitor to Receptionist's Expected Visitors list.
4. Visitor appears in Admin/HR dashboard and visitor records.
5. No HR/Admin approval is required.
6. Receptionist finds the visitor, verifies identity, and checks in.
7. System records check-in and updates status.
8. System notifies the registering employee and HR/Admin.
9. Receptionist checks visitor out when the visit ends.

### Workflow C — Unscheduled visitor
1. Receptionist collects visitor information and registers visitor.
2. Receptionist searches for the employee the visitor wants to meet.
3. If employee is not found, Receptionist contacts HR/Admin and records the confirmed employee in Invited By.
4. Receptionist checks visitor in.
5. System records visit and notifies HR/Admin.
6. Receptionist checks visitor out when visit ends.
7. Once visitor entry has been added, no additional employee approval is required for check-in.

### Workflow D — Personal guest
1. Receptionist registers the guest.
2. System records whom the guest intends to meet (Invited By).
3. Receptionist checks in the guest and issues a visitor card.
4. Visit is saved in visitor history as Personal Guest.

### Workflow E — Interview candidate
1. HR uploads an Excel sheet containing interview candidate details.
2. System imports candidate information into Expected Visitors.
3. Receptionist finds candidate on arrival and checks them in.
4. Receptionist issues a visitor card and checks candidate out using the standard procedure.

### Workflow F — VIP visitors and groups
1. HR/Admin registers VIP visit and specifies expected number of guests.
2. Receptionist verifies actual number of people who arrive.
3. System records visitor name, number of guests, invited-by employee, and organization.
4. Receptionist checks in VIP/group and issues visitor cards following the standard procedure.

### Delivery personnel
Delivery personnel are not allowed to enter the premises. Receptionist must not check them in and no visitor card is issued.

## 9. Functional requirements

### 9.1 HR/Admin web application
Navigation:
- Dashboard
- Visitor Management
- Visitor Approval
- Visitor History
- Visitor Cards
- Employee Management
- Receptionist Management
- Reports
- Settings

Dashboard:
- Total Visitors
- Expected Today
- Checked In
- Pending Approval
- Completed
- Activity graphs
- Visitor timeline

Visitor Management:
- Manage visitors.
- Add expected visitors with Visitor Name, Phone Number, and Purpose of Visit required.
- Register VIP visits with expected number of guests.
- Upload interview candidates through Excel.

Visitor Approval:
- Manage approval records. Note: the PRD also says employee-initiated and registered unscheduled visitors do not require additional approval. Clarify which records, if any, use this module before implementation.

Visitor History:
- Search past visits and check-in/check-out details.
- Include visitor card issued/returned details and visitor type.

Visitor Cards:
- Register cards manually or through bulk Excel upload.
- Monitor card status and history.

Employee Management:
- Manage employees.
- Receptionists see only employee name and team.

Receptionist Management:
- Manage receptionist accounts and access.

Reports:
- Arrival/departure data.
- PDF-format report table.

Settings:
- Manage application configuration.

### 9.2 Receptionist application
Available on web and mobile. Navigation:
- Home
- Expected Visitors
- Add New Visitor

Home:
- Total Visitors Today
- Currently Checked In
- Checked Out
- Today's visitor list

Expected Visitors:
- Find and verify pre-registered visitors.
- Check in and record timestamps.

Add New Visitor:
- Required: Visitor Name, Phone Number, Purpose of Visit.
- Additional: Number of Guests, Company/Organization.
- Search and associate host employee.
- If host is not found, contact HR/Admin and enter confirmed employee in Invited By.
- No additional approval is required.

Check-in/check-out:
- Select an Available card and check in.
- Check out only after confirmation popup: "Did you get the visitor card back?"

Delivery restriction:
- Delivery personnel must not be checked in.

### 9.3 Notifications
- Automatically notify HR/Admin when a visitor checks in.
- Include relevant visitor information such as visitor name, phone number, invited employee, and check-in details.
- WhatsApp or Telegram notification is preferred if integration is available.
- If automatic notifications are unavailable, Receptionist can manually notify or call HR/Admin.
- Employee-initiated visitor check-in should notify both registering employee and HR/Admin.

### 9.4 Visitor card management
Registration:
- HR/Admin can bulk upload card numbers using Excel.
- HR/Admin can manually add individual cards.
- Every card number/ID must be unique.
- Registered cards become available to Receptionist.
- HR/Admin can view all cards and statuses.

Assignment:
- Receptionist assigns an Available card at check-in.
- Card status changes Available → Issued.
- Check-out confirmation Yes changes Issued → Available.
- Confirmation No leaves check-out incomplete and card Issued.

Monitoring/history fields:
- Visitor name
- Visitor ID
- Assigned card number
- Check-in time
- Card status
- Check-out status
- Card assignment and return history
- Issued date/time
- Returned date/time

Physical card-punching machine integration is not required at this stage.

### 9.5 Interview candidate import
- HR uploads Excel containing interview candidate details.
- Imported candidates appear in Expected Visitors.
- Receptionist can find and check in arriving candidates.

### 9.6 Visitor history
Store:
- Visitor ID, name, phone number
- Purpose of visit
- Number of guests
- Invited-by employee
- Visitor company/organization
- Check-in and check-out times
- Visitor card number, issue and return timestamps
- Visitor type

## 10. Approval and security rules
- Employees can register their own visitors without HR/Admin approval.
- Unscheduled visitors do not require additional employee approval after registration.
- Access is restricted by role.
- Receptionists can view employee names and teams, not private employee information.
- Delivery personnel cannot be checked in.
- Check-out requires confirmation that visitor card was returned.
- Visitor cards are registered and managed only by HR/Admin through NagorikPass.
- Each card has a unique Card Number/ID.

## 11. Explicitly unresolved items
Do not silently invent answers for these points:
- The exact purpose and scope of the Visitor Approval module, given the no-approval rules above.
- Exact Excel column names, file-size limits, duplicate handling, and invalid-row behavior.
- Exact WhatsApp/Telegram provider, credentials, template requirements, and fallback behavior.
- Whether scheduled arrival/departure are mandatory or optional.
- Whether a VIP/group visit uses one visitor record or individual records per attendee/card.
- Exact employee and receptionist account provisioning/invitation process.
- Retention, deletion, and privacy policy.
- Exact report filters and PDF layout.
- Whether the mobile receptionist interface is responsive web/PWA or a separate native app.

Ask the product owner before making decisions that materially affect these requirements.
