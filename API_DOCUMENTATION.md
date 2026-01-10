# Time Tracker API Documentation

## Table of Contents
1. [Overview](#overview)
2. [Base URL](#base-url)
3. [Authentication](#authentication)
4. [User Roles](#user-roles)
5. [Common Response Format](#common-response-format)
6. [Error Handling](#error-handling)
7. [API Endpoints](#api-endpoints)
   - [Authentication](#authentication-endpoints)
   - [User Management](#user-management)
   - [Time Tracking](#time-tracking)
   - [Project Management](#project-management)
   - [Leave Management](#leave-management)
   - [Leave Balance](#leave-balance)
   - [Dashboard](#dashboard)
   - [Subscriptions](#subscriptions)
   - [Public Content](#public-content)
   - [Notifications](#notifications)
   - [Gallery](#gallery)
   - [Notes](#notes)
   - [Payroll](#payroll)
   - [Packages](#packages)

## Overview

The Time Tracker API is a comprehensive RESTful API for managing employee time tracking, project management, leave management, and subscription services. It supports multiple user roles and provides extensive functionality for workforce management.

## Base URL

```
http://localhost:3000/api/v1
```

## Authentication

The API uses JWT (JSON Web Token) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## User Roles

- `SUPER_ADMIN`: System administrator with full access
- `ADMIN`: Administrative user with elevated permissions
- `COMPANY`: Company owner/manager
- `EMPLOYEES`: Regular employee users

## Common Response Format

### Success Response
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Operation successful",
  "data": {}
}
```

### Error Response
```json
{
  "statusCode": 400,
  "success": false,
  "message": "Error message",
  "errorMessages": [
    {
      "path": "field_name",
      "message": "Specific error message"
    }
  ]
}
```

## Error Handling

### Common HTTP Status Codes
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `500`: Internal Server Error

---

# API Endpoints

## Authentication Endpoints

### 1. User Login
**POST** `/auth/login`

**Description:** Authenticate user with email/phone and password

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "jwt-token",
    "refreshToken": "refresh-token",
    "role": "company"
  }
}
```

### 2. Admin Login
**POST** `/auth/admin-login`

**Description:** Special login endpoint for admin users

**Request Body:**
```json
{
  "email": "admin@example.com",
  "password": "adminpassword"
}
```

### 3. User Signup
**POST** `/auth/signup`

**Description:** Create a new user account (requires SUPER_ADMIN or COMPANY role)

**Headers:**
- `Authorization: Bearer <token>`
- `Content-Type: multipart/form-data`

**Request Body (Form Data):**
```
data:{
  name: "John Doe"
  email: "john@example.com"
  password: "password123"
  role: "employees or company"
  phone: "+1234567890"
  address: "Address"
}
images: [file] (optional)
```

### 4. Verify Account
**POST** `/auth/verify-account`

**Description:** Verify user account with OTP

**Request Body:**
```json
{
  "email": "user@example.com",
  "oneTimeCode": "123456"
}
```
**Response Body:**
```json
{
    "statusCode": 200,
    "success": true,
    "message": "OTP verified successfully, please reset your password.",
    "data": {
        "token": "87a068d9c3fab1088b2274ba89fbda3c8ccead3202bf5fbb80b377a20ebda39d"
    }
}
```

### 5. Forget Password
**POST** `/auth/forget-password`

**Description:** Request password reset

**Request Body:**
```json
{
  "email": "user@example.com"
}
```
**Response Body:**
```json
{
    "statusCode": 200,
    "success": true,
    "message": "An OTP has been sent to your wijiciv379@iotrama.com. Please verify your email.",
    "data": "OTP sent successfully."
}
```

### 6. Reset Password
**POST** `/auth/reset-password`

**Description:** Reset password with new credentials
**Headers:**
- `Authorization: Bearer <temp-token> from verify account response`
**Request Body:**
```json
{
  "newPassword": "newpassword123",
  "confirmPassword": "newpassword123"
}
```
**Response Body:**
```json
{
    "statusCode": 200,
    "success": true,
    "message": "Password reset successfully, please login now.",
    "data": {
        "message": "Password reset successfully"
    }
}
```

### 7. Resend OTP
**POST** `/auth/resend-otp`

**Description:** Resend verification OTP

**Headers:**
- `Authorization: Bearer <temp-token>`

**Request Body:**
```json
{
    "email": "wijiciv379@iotrama.com",
    "authType": "createAccount"
    // "authType": "resetPassword"
}
```
**Response Body:**
```json
{
    "statusCode": 200,
    "success": true,
    "message": "An OTP has been sent to your wijiciv379@iotrama.com. Please verify your email."
}
```
### 8. Change Password
**POST** `/auth/change-password`

**Description:** Change user password (requires authentication)

**Headers:**
- `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword123",
  "confirmPassword": "newpassword123"
}
```
**Response Body:**
```json
{
    "statusCode": 200,
    "success": true,
    "message": "Password changed successfully",
    "data": {
        "message": "Password changed successfully"
    }
}
```

### 9. Delete Account
**DELETE** `/auth/delete-account`

**Description:** Delete user account

**Headers:**
- `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "password": "userpassword"
}
```
**Response Body:**
```json
{
    "statusCode": 200,
    "success": true,
    "message": "Account deleted successfully",
    "data": {
        "message": "Account deleted successfully"
    }
}
```

### 10. Refresh Token
**POST** `/auth/refresh-token`

**Description:** Get new access token using refresh token

**Request Body:**
```json
{
  "refreshToken": "refresh-token-here"
}
```
**Response Body:**
```json
{

    "statusCode": 200,
    "success": true,
    "message": "Token refreshed successfully",
    "data": {
        "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiY29tcGFueSIsIm5hbWUiOiJBc2FkdXp6YW1hbiIsImVtYWlsIjoid2lqaWNpdjM3OUBpb3RyYW1hLmNvbSIsImlhdCI6MTc1NjE2NTg5NiwiZXhwIjoxNzU3MDI5ODk2fQ.MxxghwxTRJnArFFgy7TB98BKxuXs5qDha6uu15k1Sj4"
    }

}
```

---

## User Management

### 1. Get All Users
**GET** `/user`

**Description:** Retrieve all users with pagination and filtering

**Headers:**
- `Authorization: Bearer <token>`

**Query Parameters:**
- `page`: Page number (optional)
- `limit`: Items per page (optional)
- `search`: Search term (optional)

**Response:**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Users retrieved successfully",
  "data": {
     "meta": {
        "page": 1,
        "limit": 10,
        "total": 4,
        "totalPages": 1
    },
    "data": []
  }
}
```

### 2. Get User Profile
**GET** `/user/profile`

**Description:** Get current user's profile

**Headers:**
- `Authorization: Bearer <token>`

**Response:**
```json
{
    "statusCode": 200,
    "success": true,
    "message": "Profile retrieved successfully",
    "data": {
        "_id": "68a4d83f2756fe079b9366b7",
        "name": "SparkTech Agency",
        "email": "asaduzzaman193146@gmail.com",
        "phone": "+880 18891265",
        "status": "active",
        "verified": true,
        "role": "company",
        "address": "Dhaka-1212",
        "location": {
            "type": "Point",
            "coordinates": [
                0,
                0
            ]
        },
        "createdAt": "2025-08-19T20:02:07.359Z",
        "updatedAt": "2025-08-21T00:05:59.661Z",
        "__v": 0,
        "stripeCustomerId": "cus_StmO0GYHwatUYG",
        "subscriptionExpiresAt": "2026-08-19T23:59:30.000Z",
        "subscriptionStatus": "active",
        "subscriptionTier": "basic",
        "trialUsed": false
    }
}
```

### 3. Update Profile
**PATCH** `/user/profile`

**Description:** Update user profile

**Headers:**
- `Authorization: Bearer <token>`
- `Content-Type: multipart/form-data`

**Request Body (Form Data):**
```
data: {
    "name": "Updated Name",
    "email": "updated@example.com",
    "phone": "+1234567890"
}
images: [file] (optional)
```

**Response:**
```json
{
    "statusCode": 200,
    "success": true,
    "message": "Profile updated successfully",
    "data": "Profile updated successfully."
}
```

### 4. Get Single User
**GET** `/user/:id`

**Description:** Get specific user by ID

**Headers:**
- `Authorization: Bearer <token>`

**Parameters:**
- `id`: User ID

### 5. Get Working Hours Summary
**GET** `/user/working-hours-summary`

**Description:** Get working hours summary for today, this week, and this month

**Headers:**
- `Authorization: Bearer <token>`

**Query Parameters:**
- `date`: Date in YYYY-MM-DD format (optional)

**Response:**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Working hours summary retrieved successfully",
  "data": {
    "today": 8.5,
    "thisWeek": 42.5,
    "thisMonth": 180.25
  }
}
```

### 6. Get Break Hours Chart
**GET** `/user/break-hours-chart`

**Description:** Get break hours for last 7 days in bar chart format

**Headers:**
- `Authorization: Bearer <token>`

**Response:**
```json
{
    "statusCode": 200,
    "success": true,
    "message": "Break hours chart data retrieved successfully",
    "data": {
        "Wed": 0,
        "Thu": 0.19,
        "Fri": 0,
        "Sat": 0,
        "Sun": 0,
        "Mon": 0.01,
        "Tue": 0
    }
}
```

### 7. Get Today's Break Periods
**GET** `/user/todays-break-periods`

**Description:** Get detailed break periods for today

**Headers:**
- `Authorization: Bearer <token>`

**Query Parameters:**
- `date`: Date in YYYY-MM-DD format (optional)

**Response:**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Today's break periods retrieved successfully",
  "data": {
    "date": "2024-01-15",
    "totalBreakPeriods": 3,
    "totalBreakTime": 90,
    "breakPeriods": [
      {
        "projectName": "Project A",
        "startTime": "2024-01-15T10:00:00Z",
        "endTime": "2024-01-15T10:15:00Z",
        "durationMinutes": 15,
        "durationHours": 0.25
      }
    ]
  }
}
```

---

## Time Tracking

### 1. Start Timer
**POST** `/timetracker/start`

**Description:** Start a new time tracking session

**Headers:**
- `Authorization: Bearer <token>`

**Request Body:**
```json
{
    "project": "68acbccced43325323ea74e8",
    "location": {
        "lat": 40.7128,
        "lng": -74.0060
    }
}
```

**Response:**
```json
{
    "statusCode": 200,
    "success": true,
    "message": "Timer started",
    "data": "Time tracking started successfully."
}
```

### 2. Pause Timer
**POST** `/timetracker/pause/:sessionId`

**Description:** Pause an active time tracking session

**Headers:**
- `Authorization: Bearer <token>`

**Parameters:**
- `sessionId`: Time session ID

**Request Body:**
```json
{
    "location": {
        "lat": 40.7128,
        "lng": -74.0060
    }
}
```

**Response:**
```json
{
    "statusCode": 200,
    "success": true,
    "message": "Timer paused",
    "data": "Timer paused successfully."
}
```

### 3. Resume Timer
**POST** `/timetracker/resume/:sessionId`

**Description:** Resume a paused time tracking session

**Headers:**
- `Authorization: Bearer <token>`

**Parameters:**
- `sessionId`: Time session ID

**Body:**
```json
{
    "location": {
        "lat": 40.7128,
        "lng": -74.0060
    }
}
```

### 4. Stop Timer
**POST** `/timetracker/stop/:sessionId`

**Description:** Stop and finalize a time tracking session

**Headers:**
- `Authorization: Bearer <token>`

**Parameters:**
- `sessionId`: Time session ID

**Request Body:**
```json
{
    "location": {
        "lat": 40.7128,
        "lng": -74.0060
    }
}
```

### 5. Get Daily Summary
**GET** `/timetracker/summary`

**Description:** Get daily time tracking summary

**Headers:**
- `Authorization: Bearer <token>`

**Query Parameters:**
- `date`: Date in YYYY-MM-DD format (optional, defaults to today)
- `project`: Project ID 

**Response:**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Daily summary retrieved successfully",
  "data": {
    "date": "2024-01-15",
    "totalTime": 28800000,
    "totalTimeInHours": 8,
    "totalBreakInHours": 1.5,
    "overtime": 0,
    "sessions": []
  }
}
```

### 6. Add Periodic Location
**POST** `/timetracker/location`

**Description:** Add location data during time tracking

**Headers:**
- `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "sessionId": "session-id",
  "location": {
    "lat": 40.7128,
    "lng": -74.0060
  }
}
```

### 7. Get Session Locations
**GET** `/timetracker/session/:sessionId/locations`

**Description:** Get all locations for a specific session

**Headers:**
- `Authorization: Bearer <token>`

**Parameters:**
- `sessionId`: Time session ID

### 8. Get Locations by Date
**GET** `/timetracker/locations`

**Description:** Get locations for a specific date

**Headers:**
- `Authorization: Bearer <token>`

**Query Parameters:**
- `date`: Date in YYYY-MM-DD format (required)
- `project`: Project ID (optional)
- `page`: Page number (optional)
- `limit`: Items per page (optional)

---

### 9. Generate Monthly PDF Report
**GET** `/timetracker/reports/monthly`

**Description:** Generate a monthly PDF report containing an employee's daily work and break time details.

**Headers:**
- `Authorization: Bearer <token>` (COMPANY, ADMIN, SUPER_ADMIN, or EMPLOYEES)

**Query Parameters:**
- `month` (required): Month in `YYYY-MM` format
- `employee` (optional): Employee user ID. If omitted, uses the authenticated user
- `project` (optional): Project ID to filter sessions
 - `template` (optional): `default`, `timesheet`, or `comprehensive` for layout style

**Response:**
- Content-Type: `application/pdf`
- A downloadable PDF file with:
  - Summary totals (work hours, break hours, days tracked, sessions)
  - Daily breakdown with sessions, work hours, and break durations

**Example:**
```
GET /api/v1/timetracker/reports/monthly?month=2025-09&employee=68a4d83f2756fe079b9366b7&template=comprehensive
```

---

## Project Management

### 1. Create Project
**POST** `/project`

**Description:** Create a new project

**Headers:**
- `Authorization: Bearer <token>`
- `Content-Type: multipart/form-data`

**Request Body (Form Data):**
```
data: {
    "title": "Project Name",
    "description": "Project description",
    "startDate": "2024-01-15",
    "endDate": "2024-06-15",
    "budget": 50000,
    "projectTime": 1000000000000
}
images: [file] (optional)
```

### 2. Get All Projects
**GET** `/project`

**Description:** Get all projects with pagination

**Headers:**
- `Authorization: Bearer <token>`

**Query Parameters:**
- `page`: Page number (optional)
- `limit`: Items per page (optional)
- `searchTerm`: Search term (optional)

### 3. Get Single Project
**GET** `/project/:id`

**Description:** Get specific project by ID

**Headers:**
- `Authorization: Bearer <token>`

**Parameters:**
- `id`: Project ID

### 4. Update Project
**PATCH** `/project/:id`

**Description:** Update project details

**Headers:**
- `Authorization: Bearer <token>`
- `Content-Type: multipart/form-data`

**Parameters:**
- `id`: Project ID

**Request Body (Form Data):**
```
title: "Updated Project Name"
description: "Updated description"
budget: 60000
image: [file] (optional)
```

### 5. Delete Project
**DELETE** `/project/:id`

**Description:** Delete a project

**Headers:**
- `Authorization: Bearer <token>`

**Parameters:**
- `id`: Project ID

---

## Leave Management

### 1. Create Leave Request
**POST** `/leavemanagement`

**Description:** Create a new leave request

**Headers:**
- `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "type": "vacation",
  "startDate": "2024-02-01",
  "endDate": "2024-02-05",
  "reason": "Family vacation",
  "description": "Annual family trip"
}
```

### 2. Get All Leave Requests
**GET** `/leavemanagement`

**Description:** Get all leave requests

**Headers:**
- `Authorization: Bearer <token>`

**Query Parameters:**
- `page`: Page number (optional)
- `limit`: Items per page (optional)
- `status`: Leave status filter (optional)

### 3. Get Single Leave Request
**GET** `/leavemanagement/:id`

**Description:** Get specific leave request by ID

**Headers:**
- `Authorization: Bearer <token>`

**Parameters:**
- `id`: Leave request ID

### 4. Update Leave Request
**PATCH** `/leavemanagement/:id`

**Description:** Update leave request (approve/reject)

**Headers:**
- `Authorization: Bearer <token>`

**Parameters:**
- `id`: Leave request ID

**Request Body:**
```json
{
  "status": "approved",
  "adminComment": "Approved for vacation"
}
```

### 5. Delete Leave Request
**DELETE** `/leavemanagement/:id`

**Description:** Delete a leave request

**Headers:**
- `Authorization: Bearer <token>`

**Parameters:**
- `id`: Leave request ID

---

## Leave Balance

### 1. Create Leave Balance
**POST** `/leavebalance`

**Description:** Create leave balance for a user

**Headers:**
- `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "user": "user-id",
  "balances": [
    {
      "type": "vacation",
      "balance": 20
    },
    {
      "type": "sick",
      "balance": 10
    }
  ]
}
```

### 2. Get All Leave Balances
**GET** `/leavebalance`

**Description:** Get all leave balances

**Headers:**
- `Authorization: Bearer <token>`

### 3. Get Single Leave Balance
**GET** `/leavebalance/:id`

**Description:** Get specific leave balance by ID

**Headers:**
- `Authorization: Bearer <token>`

**Parameters:**
- `id`: Leave balance ID

### 4. Update Leave Balance
**PATCH** `/leavebalance/:id`

**Description:** Update leave balance

**Headers:**
- `Authorization: Bearer <token>`

**Parameters:**
- `id`: Leave balance ID

**Request Body:**
```json
{
  "balances": [
    {
      "type": "vacation",
      "balance": 18
    }
  ]
}
```

### 5. Delete Leave Balance
**DELETE** `/leavebalance/:id`

**Description:** Delete a leave balance record

**Headers:**
- `Authorization: Bearer <token>`

**Parameters:**
- `id`: Leave balance ID

---

## Dashboard

### 1. Get System Admin General Stats
**GET** `/dashboard/general-stats`

**Description:** Get general statistics for system admin

**Headers:**
- `Authorization: Bearer <token>` (SUPER_ADMIN only)

### 2. Get Monthly Revenue from Stripe
**GET** `/dashboard/monthly-revenue-stripe`

**Description:** Get monthly revenue data from Stripe

**Headers:**
- `Authorization: Bearer <token>` (SUPER_ADMIN only)

### 3. Get Total Company Monthly Data
**GET** `/dashboard/total-company-monthly`

**Description:** Get total company data monthly

**Headers:**
- `Authorization: Bearer <token>` (SUPER_ADMIN only)

### 4. Get Total Employees Data Yearly
**GET** `/dashboard/total-employees-yearly`

**Description:** Get yearly employee data

**Headers:**
- `Authorization: Bearer <token>` (COMPANY only)

### 5. Get Total Project Yearly Data
**GET** `/dashboard/total-project-yearly`

**Description:** Get yearly project data

**Headers:**
- `Authorization: Bearer <token>` (COMPANY only)

### 6. Get Company General Stats
**GET** `/dashboard/company-general-stats`

**Description:** Get general statistics for company

**Headers:**
- `Authorization: Bearer <token>` (COMPANY only)

### 7. Get Time Analytics
**GET** `/dashboard/time-analytics/:userId`

**Description:** Get time analytics for specific user

**Headers:**
- `Authorization: Bearer <token>` (COMPANY only)

**Parameters:**
- `userId`: User ID

### 8. Get Employee Locations
**GET** `/dashboard/employee-locations/:userId`

**Description:** Get location data for specific employee

**Headers:**
- `Authorization: Bearer <token>` (COMPANY only)

**Parameters:**
- `userId`: User ID

---

## Subscriptions

### 1. Get Available Plans
**GET** `/subscriptions/plans`

**Description:** Get all available subscription plans (public endpoint)

**Query Parameters:**
- `isActive`: Filter by active status (optional)
- `planType`: Filter by plan type (optional)

### 2. Get Plan by ID
**GET** `/subscriptions/plans/:planId`

**Description:** Get specific plan details (public endpoint)

**Parameters:**
- `planId`: Plan ID

### 3. Check Trial Eligibility
**GET** `/subscriptions/trial-eligibility/:userId?`

**Description:** Check if user is eligible for trial

**Headers:**
- `Authorization: Bearer <token>` (COMPANY only)

**Parameters:**
- `userId`: User ID (optional)

### 4. Create Subscription
**POST** `/subscriptions/create`

**Description:** Create a new subscription

**Headers:**
- `Authorization: Bearer <token>` (COMPANY only)

**Request Body:**
```json
{
  "planId": "plan-id",
  "paymentMethodId": "payment-method-id",
  "billingCycle": "monthly"
}
```

### 5. Get Current Subscription
**GET** `/subscriptions/current`

**Description:** Get current user's subscription

**Headers:**
- `Authorization: Bearer <token>` (COMPANY only)

### 6. Cancel Subscription
**POST** `/subscriptions/cancel`

**Description:** Cancel current subscription

**Headers:**
- `Authorization: Bearer <token>` (COMPANY only)

### 7. Get Usage Data
**GET** `/subscriptions/usage`

**Description:** Get subscription usage data

**Headers:**
- `Authorization: Bearer <token>` (COMPANY only)

### 8. Get Usage Warnings
**GET** `/subscriptions/usage/warnings`

**Description:** Get usage warnings and limits

**Headers:**
- `Authorization: Bearer <token>` (COMPANY only)

---

## Public Content

### 1. Create Public Content
**POST** `/public`

**Description:** Create public content (privacy policy, terms, etc.)

**Headers:**
- `Authorization: Bearer <token>` (SUPER_ADMIN or ADMIN only)

**Request Body:**
```json
{
  "content": "Content text",
  "type": "privacy-policy"
}
```

### 2. Get Public Content
**GET** `/public/:type`

**Description:** Get public content by type (no authentication required)

**Parameters:**
- `type`: Content type (privacy-policy, terms-and-condition, contact, about)

### 3. Delete Public Content
**DELETE** `/public/:id`

**Description:** Delete public content

**Parameters:**
- `id`: Content ID

### 4. Create Contact
**POST** `/public/contact`

**Description:** Submit contact form (no authentication required)

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "country": "USA",
  "message": "Contact message"
}
```

### 5. Create FAQ
**POST** `/public/faq`

**Description:** Create FAQ entry

**Headers:**
- `Authorization: Bearer <token>` (ADMIN or SUPER_ADMIN only)

**Request Body:**
```json
{
  "question": "How do I reset my password?",
  "answer": "Click on forgot password link..."
}
```

### 6. Update FAQ
**PATCH** `/public/faq/:id`

**Description:** Update FAQ entry

**Headers:**
- `Authorization: Bearer <token>` (ADMIN or SUPER_ADMIN only)

**Parameters:**
- `id`: FAQ ID

### 7. Get Single FAQ
**GET** `/public/faq/single/:id`

**Description:** Get specific FAQ by ID (no authentication required)

**Parameters:**
- `id`: FAQ ID

### 8. Get All FAQs
**GET** `/public/faq/all`

**Description:** Get all FAQs (no authentication required)

### 9. Delete FAQ
**DELETE** `/public/faq/:id`

**Description:** Delete FAQ entry

**Headers:**
- `Authorization: Bearer <token>` (SUPER_ADMIN or ADMIN only)

**Parameters:**
- `id`: FAQ ID

---

## Notifications

### 1. Get Notifications
**GET** `/notifications`

**Description:** Get user notifications

**Headers:**
- `Authorization: Bearer <token>`

**Query Parameters:**
- `page`: Page number (optional)
- `limit`: Items per page (optional)
- `read`: Filter by read status (optional)

### 2. Mark Notification as Read
**PATCH** `/notifications/:id/read`

**Description:** Mark specific notification as read

**Headers:**
- `Authorization: Bearer <token>`

**Parameters:**
- `id`: Notification ID

### 3. Mark All Notifications as Read
**PATCH** `/notifications/mark-all-read`

**Description:** Mark all notifications as read

**Headers:**
- `Authorization: Bearer <token>`

### 4. Delete Notification
**DELETE** `/notifications/:id`

**Description:** Delete specific notification

**Headers:**
- `Authorization: Bearer <token>`

**Parameters:**
- `id`: Notification ID

---

## Gallery

### 1. Upload Image
**POST** `/gallery`

**Description:** Upload image to gallery

**Headers:**
- `Authorization: Bearer <token>`
- `Content-Type: multipart/form-data`

**Request Body (Form Data):**
```
image: [file]
title: "Image title"
description: "Image description"
```

### 2. Get All Images
**GET** `/gallery`

**Description:** Get all gallery images

**Headers:**
- `Authorization: Bearer <token>`

**Query Parameters:**
- `page`: Page number (optional)
- `limit`: Items per page (optional)

### 3. Get Single Image
**GET** `/gallery/:id`

**Description:** Get specific image by ID

**Headers:**
- `Authorization: Bearer <token>`

**Parameters:**
- `id`: Image ID

### 4. Update Image
**PATCH** `/gallery/:id`

**Description:** Update image details

**Headers:**
- `Authorization: Bearer <token>`
- `Content-Type: multipart/form-data`

**Parameters:**
- `id`: Image ID

### 5. Delete Image
**DELETE** `/gallery/:id`

**Description:** Delete image from gallery

**Headers:**
- `Authorization: Bearer <token>`

**Parameters:**
- `id`: Image ID

---

## Notes

### 1. Create Note
**POST** `/note`

**Description:** Create a new note

**Headers:**
- `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "title": "Note title",
  "content": "Note content",
  "category": "work",
  "tags": ["important", "project"]
}
```

### 2. Get All Notes
**GET** `/note`

**Description:** Get all user notes

**Headers:**
- `Authorization: Bearer <token>`

**Query Parameters:**
- `page`: Page number (optional)
- `limit`: Items per page (optional)
- `category`: Filter by category (optional)
- `search`: Search term (optional)

### 3. Get Single Note
**GET** `/note/:id`

**Description:** Get specific note by ID

**Headers:**
- `Authorization: Bearer <token>`

**Parameters:**
- `id`: Note ID

### 4. Update Note
**PATCH** `/note/:id`

**Description:** Update note content

**Headers:**
- `Authorization: Bearer <token>`

**Parameters:**
- `id`: Note ID

**Request Body:**
```json
{
  "title": "Updated title",
  "content": "Updated content",
  "tags": ["updated", "important"]
}
```

### 5. Delete Note
**DELETE** `/note/:id`

**Description:** Delete a note

**Headers:**
- `Authorization: Bearer <token>`

**Parameters:**
- `id`: Note ID

---

## Payroll

### 1. Create Payroll
**POST** `/payrole`

**Description:** Create payroll record

**Headers:**
- `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "employee": "employee-id",
  "period": "2024-01",
  "basicSalary": 5000,
  "overtime": 500,
  "deductions": 200,
  "bonus": 300
}
```

### 2. Get All Payrolls
**GET** `/payrole`

**Description:** Get all payroll records

**Headers:**
- `Authorization: Bearer <token>`

**Query Parameters:**
- `page`: Page number (optional)
- `limit`: Items per page (optional)
- `period`: Filter by period (optional)
- `employee`: Filter by employee (optional)

### 3. Get Single Payroll
**GET** `/payrole/:id`

**Description:** Get specific payroll by ID

**Headers:**
- `Authorization: Bearer <token>`

**Parameters:**
- `id`: Payroll ID

### 4. Update Payroll
**PATCH** `/payrole/:id`

**Description:** Update payroll record

**Headers:**
- `Authorization: Bearer <token>`

**Parameters:**
- `id`: Payroll ID

### 5. Delete Payroll
**DELETE** `/payrole/:id`

**Description:** Delete payroll record

**Headers:**
- `Authorization: Bearer <token>`

**Parameters:**
- `id`: Payroll ID

---

## Packages

### 1. Create Package
**POST** `/package`

**Description:** Create subscription package

**Headers:**
- `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "title": "Premium Package",
  "price": 99.99,
  "features": [
    "Unlimited projects",
    "Advanced analytics",
    "Priority support"
  ],
  "isActive": true
}
```

### 2. Get All Packages
**GET** `/package`

**Description:** Get all packages

**Headers:**
- `Authorization: Bearer <token>`

**Query Parameters:**
- `page`: Page number (optional)
- `limit`: Items per page (optional)
- `isActive`: Filter by active status (optional)

### 3. Get Single Package
**GET** `/package/:id`

**Description:** Get specific package by ID

**Headers:**
- `Authorization: Bearer <token>`

**Parameters:**
- `id`: Package ID

### 4. Update Package
**PATCH** `/package/:id`

**Description:** Update package details

**Headers:**
- `Authorization: Bearer <token>`

**Parameters:**
- `id`: Package ID

**Request Body:**
```json
{
  "title": "Updated Premium Package",
  "price": 109.99,
  "features": [
    "Unlimited projects",
    "Advanced analytics",
    "Priority support",
    "Custom integrations"
  ]
}
```

### 5. Delete Package
**DELETE** `/package/:id`

**Description:** Delete a package

**Headers:**
- `Authorization: Bearer <token>`

**Parameters:**
- `id`: Package ID

---

## Rate Limiting

The API implements rate limiting to prevent abuse:
- **General endpoints**: 100 requests per 15 minutes
- **Authentication endpoints**: 5 requests per 15 minutes
- **File upload endpoints**: 10 requests per 15 minutes

## File Upload Guidelines

### Supported File Types
- **Images**: JPG, JPEG, PNG, GIF, WebP
- **Documents**: PDF, DOC, DOCX
- **Maximum file size**: 10MB

### Upload Response Format
```json
{
  "statusCode": 200,
  "success": true,
  "message": "File uploaded successfully",
  "data": {
    "url": "https://cloudinary.com/image-url",
    "publicId": "file-public-id",
    "format": "jpg",
    "size": 1024000
  }
}
```

## WebSocket Events

The API supports real-time communication through WebSocket connections:

### Connection
```javascript
const socket = io('http://localhost:3000', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

### Events
- `timer_started`: When a user starts a timer
- `timer_paused`: When a user pauses a timer
- `timer_stopped`: When a user stops a timer
- `notification_received`: When a new notification is received
- `leave_request_updated`: When leave request status changes

## Environment Variables

Required environment variables for the API:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/timetracker

# JWT
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your-refresh-secret
JWT_REFRESH_EXPIRES_IN=30d

# Cloudinary (for file uploads)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Stripe (for payments)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Redis (for caching and sessions)
REDIS_URL=redis://localhost:6379
```

## Testing

The API can be tested using tools like:
- **Postman**: Import the collection from `/docs/postman-collection.json`
- **cURL**: Use command line examples provided in each endpoint
- **Frontend Integration**: Use the provided JavaScript examples

## Support

For API support and questions:
- **Email**: support@timetracker.com
- **Documentation**: Available at `/api-docs` when server is running
- **GitHub Issues**: Report bugs and feature requests

---

*Last updated: January 2024*
*API Version: 1.0.0*