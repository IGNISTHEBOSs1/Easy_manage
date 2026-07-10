CoachPro Business Rules (MVP)
Purpose

This document defines the business rules of CoachPro.

Every database migration, backend function, and frontend feature must follow these rules. If code conflicts with this document, this document takes precedence until deliberately updated.

Core Principles
Every coaching institute is completely isolated from every other institute.
Every business record belongs to exactly one organization.
Data integrity is more important than convenience.
Historical records should be preserved whenever possible.
The system should fail loudly rather than silently creating invalid data.
Organizations
One organization represents one coaching institute.
Organizations are isolated using PostgreSQL RLS.
Every business record must belong to exactly one organization.
Organizations cannot access each other's data.
Students
Student Identity
Students belong to one organization.
Students may have identical names.
Students may have identical phone numbers.
Student IDs are UUIDs.
Batch Membership
A student may belong to multiple active batches.
Maximum active batch memberships: 15.
There is no primary batch.
Membership stores:
Joined Date
Left Date (nullable)
Status (Active/Archived)
History
Membership history is never deleted.
Leaving a batch archives the membership.
Archived memberships remain visible in history.
Batches
Batch names must be unique within one organization.
Different organizations may use the same batch name.
A batch may contain many students.
A student may belong to many batches.
Archived Batches

Archived batches:

Cannot accept new students.
Cannot take attendance.
Cannot generate recurring fees.
Cannot generate new invoices.
Remain visible in reports.
Can be restored.
Fees
Ownership

Fees belong to the student.

Every fee may optionally reference the batch that generated it.

Example:

Student
↓

Monthly Fee

↓

Generated From:
Physics XI
Discounts

Students may receive:

Scholarships
Discounts
Manual adjustments

These affect only that student's fees.

Recurring Fees

Recurring fees stop automatically when:

batch membership ends
batch becomes archived
Payments
One payment may pay multiple fees.
Partial payments are supported.
Payment history is preserved.
Payments should never be silently deleted.
Attendance

Attendance belongs to:

Student
+
Batch
+
Date

Rules:

One attendance record per student per batch per day.
A student may be present in one batch and absent in another on the same day.
Multiple attendance sessions per day are not required for MVP.
Analytics

Revenue should be traceable to:

Student
Batch (when applicable)

Attendance statistics should be calculated per batch.

Historical reports should remain correct even after students change batches.

Database Principles
organization_id is mandatory.
organization_id is never nullable.
No sentinel organization IDs.
No hidden defaults.
Missing organization_id must fail immediately.
Deletion Policy

Avoid physical deletion whenever historical data exists.

Prefer:

Archived

Inactive

Closed

instead of DELETE.

Future Features

These are intentionally excluded from MVP:

Multiple staff accounts
Teacher management
Parent portal
Student portal
QR attendance
Multiple attendance sessions
Online fee payment
AI analytics
Development Rule

Before implementing any new feature, answer these four questions:

1. Business Rules

How should the feature behave?

2. Edge Cases

What unusual situations must still work correctly?

3. Database Impact

Which tables, constraints, RLS policies, indexes, and functions must change?

4. Testing

How can we verify the feature works and doesn't break existing functionality?