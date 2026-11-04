# NagorikPass — Product Requirements Document (PRD)

*Visitor Management System (VMS)*

## Document Information

| Item          | Details                                                 |
|---------------|---------------------------------------------------------|
| Product       | NagorikPass — Visitor Management System (VMS)           |
| Document type | Product Requirements Document (PRD)                     |
| Primary users | HR/Admin, Receptionist, Employee                        |
| Platforms     | Web (Admin/HR, Employee); web and mobile (Receptionist) |
| Backend       | Supabase (PostgreSQL, Auth)                             |

## 1. Product Overview

NagorikPass is a digital Visitor Management System designed to streamline visitor registration, check-in, check-out, and visit tracking within an organization.

The system replaces manual visitor logs with a centralized platform for HR/Admin, Receptionists, and Employees. It provides visitor records, expected visitor lists, real-time visit status, notifications, dashboards, visitor history, and reports while protecting information through role-based access control.

## 2. Product Goal

NagorikPass aims to make visitor handling secure, organized, traceable, and efficient by replacing manual reception processes with a centralized digital system that provides reliable visitor records, streamlined check-in/check-out, clear responsibilities, and privacy-aware access to information.

## 3. User Roles

**HR/Admin**

- Manages employees, receptionists, and visitor records.
- Registers expected visitors in advance.
- Monitors dashboards, visitor history, and reports.
- Receives notifications when visitors check in.
- Adds employee-initiated visitors to the expected visitor list.
- Registers visitor cards (bulk Excel upload or manual entry) and monitors card status and assignment history in the NagorikPass portal.
- Uploads interview candidate lists via Excel and registers VIP visits and groups.

**Receptionist**

- Views expected visitors and registers unscheduled visitors.
- Searches for employees whom visitors want to meet.
- Checks visitors in and out.
- Manages visitor information through web and mobile applications.
- Assigns an available visitor card at check-in and confirms its return at check-out.
- Does not check in delivery personnel.

**Employee**

- Coordinates visitor invitations with HR/Admin.
- Provides visitor information to HR/Admin before the visit.
- Takes responsibility for coordinating invited visitors.

## 4. Visitor Categories

Visitors can be categorized by visit type:

- Business Meeting
- Job Interview (Interview Candidate)
- VIP Visit (VIP Visitor or Group)
- Vendor / Supplier
- Maintenance / Technician
- Personal Guest
- Delivery / Courier (not permitted to enter; never checked in)
- Other

Visitor records include the mandatory and additional information described in Section 4.1, the visitor category (visitor type), host employee, scheduled arrival and departure, actual check-in/check-out timestamps, and the visitor card issued.

### 4.1 Visitor Information

Mandatory fields. The following fields are required when registering a visitor:

- Visitor name
- Phone number
- Purpose of visit

Additional fields. The following information is also captured for each visitor:

- Number of guests
- Invited by (employee name)
- Company or organization the visitor is from

## 5. Core Visitor Workflows

### Standard Check-In and Check-Out (All Visitors)

The following check-in and check-out steps, including the visitor card, apply to every workflow in this section (A to F).

**Check-In**

1. The Receptionist registers the visitor or finds the visitor in the system.
2. The Receptionist selects an available visitor card from the dropdown in the visitor list (for example, Card 001, 002, 003) and assigns it to the visitor.
3. The Receptionist clicks Check-in. The system links the selected card number to the visitor's record, and the visitor receives the assigned card from the Receptionist.
4. The system records the check-in time and updates the card status from Available to Issued.
5. The assigned card number and visitor details automatically appear on the HR/Admin dashboard, and HR/Admin is notified (see Section 6.3).

**Check-Out**

1. The visitor returns the assigned card to the Receptionist.
2. The Receptionist clicks Check-out for that visitor, and the system displays a confirmation popup: "Did you get the visitor card back?"
3. If the Receptionist selects Yes, the system records the check-out time, changes the visitor's status to Checked Out, changes the card status from Issued to Available so it can be assigned to another visitor, and automatically updates the HR/Admin dashboard.
4. If the Receptionist selects No, the check-out remains incomplete: the visitor stays in the Checked-In list, the card remains assigned to that visitor, and the Receptionist must recover the card before completing check-out.
5. Every card assignment and return is kept in the card history with its issued and returned date and time.

### Workflow A: HR/Admin Pre-Registers a Visitor

1. HR/Admin registers the visitor with the required information.
2. The visitor appears in the Receptionist's Expected Visitors list.
3. When the visitor arrives, the Receptionist verifies their identity and checks them in.
4. The system records the check-in and notifies HR/Admin.
5. The Receptionist checks the visitor out when the visit ends.

![Workflow A · HR/Admin pre-registers a visitor](images/image3.png)

Workflow A · HR/Admin pre-registers a visitor

HR/Admin registers the visitor in advance, so the Receptionist can check them in on arrival.

### Workflow B: Employee-Initiated Visitor

Employees shall be able to register visitors directly through the employee web application without requiring prior approval from Admin/HR.

1. The employee logs in and selects Add New Visitor.
2. The employee enters the visitor's information, including full name and phone number, and provides the relevant visit details.
3. The system adds the visitor to the Receptionist's Expected Visitors list.
4. The visitor also appears in the Admin/HR dashboard and visitor records.
5. No Admin/HR approval is required for the employee to register the visitor.
6. When the visitor arrives, the receptionist finds the visitor in the Expected Visitors list, verifies their identity, and checks them in.
7. The system records the check-in time and updates the visitor's status.
8. The system automatically sends check-in notifications to both the employee who registered the visitor and Admin/HR.
9. The receptionist checks the visitor out when the visit ends.

![Workflow B · Employee-initiated visitor](images/image1.png)

Workflow B · Employee-initiated visitor

The employee is responsible for coordinating their invited visitors and providing accurate visitor information. Admin/HR can monitor employee-registered visitors through the dashboard and visitor records, but does not need to approve each registration.

### Workflow C: Unscheduled Visitor

1. The Receptionist collects the visitor's information and registers the visitor.
2. The Receptionist searches for the employee the visitor wants to meet.
3. If the employee is not found, the Receptionist contacts HR/Admin and records the confirmed employee in the **Invited By** field.
4. The Receptionist checks the visitor in.
5. The system records the visit and notifies HR/Admin.
6. The Receptionist checks the visitor out when the visit ends.

Once a visitor entry has been added to the system, no additional employee approval is required for check-in.

![Workflow C · Unscheduled visitor](images/image2.png)

Workflow C · Unscheduled visitor

When the host employee cannot be found, HR/Admin confirms the name and the Receptionist records it in Invited By.

### Workflow D: Personal Guest

When a personal guest arrives:

1. The Receptionist registers the guest.
2. The system records whom the guest intends to meet (Invited By).
3. The Receptionist checks in the guest and issues a visitor card.
4. The visit is saved in the visitor history with the visitor type Personal Guest.

### Workflow E: Interview Candidate

1. HR uploads an Excel sheet containing interview candidate details.
2. The system automatically imports the candidate information into the Expected Visitors list.
3. When the candidate arrives, the Receptionist finds the candidate in the Expected Visitors list and checks them in.
4. The Receptionist issues a visitor card and checks the candidate out at the end of the visit, following the standard procedure.

### Workflow F: VIP Visitors and Groups

1. HR/Admin registers the VIP visit and specifies the expected number of guests.
2. When the VIP or group arrives, the Receptionist verifies the actual number of people who arrive.
3. The system records the visitor name, number of guests, invited-by employee, and organization.
4. The Receptionist checks in the VIP or group and issues visitor cards, following the standard procedure.

### Delivery Personnel (Not Permitted)

Delivery personnel are not allowed to enter the premises. The Receptionist must not check in delivery visitors, and no visitor card is issued to them.

## 6. Functional Requirements

### 6.1 Admin/HR Web Application

**Sidebar:** Dashboard, Visitor Management, Visitor Approval, Visitor History, Visitor Cards, Employee Management, Receptionist Management, Reports, Settings.

- **Dashboard:** Total Visitors, Expected Today, Checked In, Pending Approval, Completed, Rejected, activity graphs, visitor timeline.
- **Visitor Management:** Manage visitors; add expected visitors via modal (Visitor Name, Phone Number, and Purpose of Visit required); register VIP visits with expected number of guests; upload interview candidates via Excel.
- **Visitor Approval:** Manage approval records.
- **Visitor History:** Search past visits and check-in/check-out details, including visitor card issued and returned, and visitor type (see Section 6.6).
- **Visitor Cards:** Register visitor cards (bulk Excel upload or manual entry) and monitor card status and history (see Section 6.4).
- **Employee Management:** Manage employees; receptionists see only employee name and team.
- **Receptionist Management:** Manage receptionist accounts and access.
- **Reports:** Arrival/departure data and PDF-format report table.
- **Settings:** Manage application configuration.

### 6.2 Receptionist Application

Available on web and mobile. **Navigation:** Home, Expected Visitors, Add New Visitor.

- **Home:** Total Visitors Today, Currently Checked In, Checked Out, today's visitor list.
- **Expected Visitors:** Find and verify pre-registered visitors; check in and record timestamps.
- **Add New Visitor:** Register unscheduled visitors (Visitor Name, Phone Number, and Purpose of Visit required; Number of Guests and Company/Organization recorded as additional information); search and associate host employee. If not found, contact HR/Admin and enter the confirmed employee in **Invited By**. No additional approval required.
- **Check-In / Check-Out:** Select an available card from the dropdown in the visitor list, assign it, and click Check-in; click Check-out and confirm card return through the popup "Did you get the visitor card back?".
- **Delivery Restriction:** Delivery personnel must not be checked in.

### 6.3 Notifications

The system will automatically notify HR/Admin when a visitor checks in.

Notifications will include relevant visitor information, such as visitor name, phone number, invited employee, and check-in details.

HR/Admin should receive a notification through WhatsApp or Telegram when a visitor checks in and receives a card, if integration is available. If automatic notifications are unavailable, the Receptionist can manually notify or call HR/Admin when a visitor arrives.

### 6.4 Visitor Card Management

**Card Registration (HR/Admin)**

- HR/Admin can register visitor cards in bulk by uploading an Excel file (for example, 50 card numbers).
- HR/Admin can also add individual card numbers manually.
- Each visitor card must have a unique Card Number/ID.
- Once registered, all card numbers automatically become available in the Receptionist dashboard.
- HR/Admin can view all registered visitor cards and their current statuses.

**Card Assignment, Check-In, and Check-Out (Receptionist)**

- At check-in, the Receptionist selects an available card from the dropdown in the visitor list, assigns it, and clicks Check-in; the system links the card number to the visitor's record and changes the card status from Available to Issued.
- At check-out, the Receptionist clicks Check-out and answers the popup "Did you get the visitor card back?". Yes completes the check-out and changes the card from Issued to Available; No leaves the check-out incomplete and the card assigned until it is recovered.
- The full step-by-step flow is described in Section 5 (Standard Check-In and Check-Out).

**Card Monitoring (HR/Admin)**

- Visitor name
- Visitor ID
- Assigned card number
- Check-in time
- Card status (Available or Issued)
- Check-out status
- Card assignment and return history

**Card Status Management**

Each visitor card has exactly one current status:

- Available: the card is registered and ready to be assigned to a visitor.
- Issued: the card has been assigned to a visitor and has not yet been returned.

The system also maintains card assignment and return history:

- Card number
- Visitor name
- Issued date and time
- Returned date and time
- Assigned and returned status

**HR/Admin Dashboard Updates and Notifications**

- When the Receptionist assigns a card and checks in a visitor, the HR/Admin dashboard automatically displays the visitor's details and assigned card number.
- HR/Admin receives a notification through WhatsApp or Telegram when a visitor checks in and receives a card, if integration is available.
- When the visitor checks out and card return is confirmed, the HR/Admin dashboard reflects the updated visitor and card statuses.
- If automatic notifications are unavailable, the Receptionist can manually contact HR/Admin.

Note: Visitor card registration and assignment are managed through the NagorikPass portal. Integration with the physical card-punching machine is not required at this stage.

### 6.5 Interview Candidate Import

- HR uploads an Excel sheet containing interview candidate details.
- The system automatically imports the candidate information into the Expected Visitors list.
- The Receptionist can find the candidate in the Expected Visitors list and check them in when they arrive.

### 6.6 Visitor History

The system stores the following information for every visit:

- Visitor ID, visitor name, and phone number
- Purpose of visit
- Number of guests
- Invited-by employee
- Visitor's company or organization
- Check-in and check-out times
- Visitor card number assigned, with issued and returned date and time
- Visitor type (Personal Guest, Interview Candidate, VIP, etc.)

## 7. Approval and Security Rules

- Employees can register their own visitors without HR/Admin approval.
- Unscheduled visitors do not require additional employee approval after registration.
- User access is restricted based on role.
- Receptionists can view only employees names and teams, not their private information.
- Delivery personnel are not allowed to enter the premises and must not be checked in by the Receptionist.
- A visitor is checked out only after the Receptionist confirms that the visitor card has been returned.
- Visitor cards are registered and managed only by HR/Admin through the NagorikPass portal, and each card must have a unique Card Number/ID.

## 8. Technology Stack and Platforms

- **Web frontend:** React, TypeScript, Vite
- **Backend platform:** Supabase
- **Database:** Supabase PostgreSQL
- **Authentication:** Supabase Auth
- **Authorization:** Role-based access control and database policies
- **Notifications:** Notification integration
- **Admin/HR:** Web application
- **Employee:** Web application
- **Receptionist:** Web application and mobile application
