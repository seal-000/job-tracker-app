# Job Application Tracker

A secure full-stack web application for managing job applications through a Kanban-style pipeline. Users can register, sign in, track application details, update statuses, review status history, and reset forgotten passwords with a one-time reset link.

## Contents

- [Highlights](#highlights)
- [Screenshots](#screenshots)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Database Setup in Neon](#database-setup-in-neon)
- [Local Development](#local-development)
- [Deploy to Vercel](#deploy-to-vercel)
- [Security Highlights](#security-highlights)
- [Architecture Decisions and Trade-offs](#architecture-decisions-and-trade-offs)
- [Scope and Limitations](#scope-and-limitations)
- [What I Learned](#what-i-learned)
- [Testing](#testing)
- [Scripts](#scripts)

## Highlights

- Built a server-rendered dashboard and JSON API with Node.js, Express, EJS, and vanilla JavaScript.
- Used PostgreSQL transactions to keep application updates and status history consistent.
- Implemented bcrypt password hashing, session regeneration, CSRF protection, and ownership checks.
- Added one-time, expiring password-reset tokens with Gmail SMTP delivery through Nodemailer.
- Added server-side validation for request bodies, IDs, strings, URLs, salary values, and status updates.
- Verified with Jest and Supertest: **2 test suites and 9 tests passing**.



## Screenshots





## Tech Stack

- **Backend:** Node.js, Express
- **Views:** EJS and vanilla JavaScript
- **Database:** PostgreSQL with `pg` and Neon
- **Authentication:** `bcrypt`, `express-session`, and `connect-pg-simple`
- **Email:** Nodemailer with Gmail SMTP
- **Testing:** Jest and Supertest
- **Deployment:** Vercel


## Project Structure

```text
job-application-tracker/
├── src/
│   ├── server.js               # Express application entry point & middleware setup
│   ├── db/
│   │   ├── pool.js             # PostgreSQL connection pool (Neon)
│   │   └── schema.sql          # Database schema and initial migrations
│   ├── middleware/             # Authentication & CSRF protection helpers
│   ├── routes/
│   │   ├── auth.js             # Registration, login, logout, & password reset
│   │   └── applications.js     # Job application CRUD & status history API
│   ├── public/                 # Static assets (CSS, client-side JS)
│   └── views/                  # EJS template pages & reusable partials
└── tests/
    ├── auth.test.js            # Auth workflow integration tests
    └── applications.test.js    # Application API integration tests
```


## Database Setup in Neon

The SQL schema is in [src/db/schema.sql](src/db/schema.sql). Run it once in the Neon SQL Editor, or with the PostgreSQL CLI:

```bash
psql "$DATABASE_URL" -f src/db/schema.sql
```

The schema creates the `users`, `session`, `password_reset_tokens`, `applications`, and `application_status_history` tables, plus the `application_status` enum. 


## Local Development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and set:

   ```env
   DATABASE_URL="your-neon-connection-string"
   SESSION_SECRET="your-long-random-secret"
   APP_URL="http://localhost:3000"
   EMAIL_USER="your-gmail-address@gmail.com"
   EMAIL_APP_PASSWORD="your-gmail-app-password"
   ```

3. Run `src/db/schema.sql` in Neon.
4. Start the development server:

   ```bash
   npm run dev
   ```

5. Run the tests:

   ```bash
   npm test
   ```

Use a Gmail App Password for `EMAIL_APP_PASSWORD`, not your normal Gmail password. Without mail credentials, local development prints the reset link in the server log instead of sending email.


## Deploy to Vercel

1. Push the repository to GitHub and import it into Vercel.
2. Add these environment variables in Vercel project settings for Production:

   ```env
   DATABASE_URL=your-neon-connection-string
   SESSION_SECRET=your-long-random-secret
   APP_URL=https://your-project.vercel.app
   EMAIL_USER=your-gmail-address@gmail.com
   EMAIL_APP_PASSWORD=your-gmail-app-password
   ```

3. Run `src/db/schema.sql` in the production Neon database before testing the deployed app.
4. Deploy, then test registration, login, application creation, status updates, deletion, and password reset.

Use your custom domain for `APP_URL` if one is configured. Never commit `.env`, database credentials, session secrets, or Gmail app passwords.


## Security Highlights

- Passwords are hashed with bcrypt and login regenerates the session to prevent session fixation.
- CSRF tokens protect state changing form and API requests.
- Application queries are scoped to the authenticated user, preventing cross-user access.
- IDs, request bodies, text lengths, URLs, salaries, and status values are validated server-side.
- Password reset tokens are random, hashed at rest, expiring, and invalidated after use.


## Architecture Decisions and Trade-offs

- **Server-rendered EJS instead of a separate frontend framework:** This kept the project smaller and let me focus on authentication, authorization, PostgreSQL, and backend validation. The trade-off is less frontend interactivity than a single page application.
- **PostgreSQL-backed sessions:** Sessions remain available across Vercel instances instead of relying on in-memory storage. The trade-off is an additional database dependency for session management.
- **Gmail SMTP for password reset emails:** This was practical for this project and easy to test. A production application would likely use a dedicated transactional email provider with delivery monitoring.
- **Direct status changes are allowed:** Users can move an application to any valid status because the dashboard is designed for flexible tracking. Every change is still recorded in the status history table.



## Scope and Limitations

This project is designed as a personal project. It is not ready for production. It does not currently include automated database migrations, advanced email delivery monitoring, rate limiting, or multi-tenant organization accounts. These would be reasonable next improvements for a production scale system.

## What I Learned

### The Problem

Job applications can become difficult to track when company details, interview stages, links, and outcomes are spread across notes or spreadsheets. I wanted one secure place to manage the complete application lifecycle and preserve status history.

### Understanding the Problem

I learned that a dashboard is only one part of the application: the server must validate every request because browser controls can be bypassed. I also learned how authentication, authorization, CSRF protection, database ownership checks, transactions, and password recovery work together.

### The Solution

I built the application with Express, PostgreSQL, EJS, and a browser-based dashboard, then added secure authentication, transactional status history, validated API endpoints, and expiring password reset links delivered through Gmail SMTP.

## Testing

Run `npm test` to execute the Jest and Supertest integration tests. The current result is **2 test suites, 9 tests passing**.

## Scripts

- `npm run dev` starts the development server with Nodemon.
- `npm start` starts the application with Node.js.
- `npm test` runs the Jest test suite.

