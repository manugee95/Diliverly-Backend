# DILIVALY Backend

Backend API for **DILIVALY**, a delivery marketplace that connects e-commerce vendors with delivery agents.

The platform manages the complete delivery lifecycle — from delivery requests and agent quotes through order creation, payment, escrow, delivery completion, refunds, transactions, disputes, and withdrawals.

The backend is built with **NestJS, TypeScript, PostgreSQL, TypeORM, Redis, and external payment/verification services**.

---

## Overview

DILIVALY is designed around two primary users:

* **Vendors** — businesses that need delivery services for their customers.
* **Delivery Agents** — agents who receive delivery opportunities, submit quotes, complete deliveries, and receive earnings.

The backend coordinates the workflow between these participants while maintaining transactional consistency around orders, wallets, payments, escrow, and transaction records.

### Core workflow

```text
Vendor
  │
  ├── Creates Delivery Request
  │
  ▼
Delivery Request
  │
  ├── Agents submit Quotes
  │
  ▼
Vendor accepts Quote
  │
  ▼
Order / Order Item
  │
  ▼
Payment
  │
  ▼
Escrow
  │
  ├── Delivery completed
  │
  ├── Release → Agent
  │
  └── Refund → Vendor
  │
  ▼
Transaction Ledger
```

---

# Technology Stack

| Layer                 | Technology                              |
| --------------------- | --------------------------------------- |
| Language              | TypeScript                              |
| Framework             | NestJS                                  |
| Runtime               | Node.js                                 |
| Database              | PostgreSQL                              |
| ORM                   | TypeORM                                 |
| Authentication        | JWT                                     |
| Validation            | class-validator / class-transformer     |
| Cache                 | Redis                                   |
| API Documentation     | Swagger / OpenAPI                       |
| Payments              | Paystack                                |
| File Storage          | AWS S3                                  |
| Identity Verification | Youverify / Smile Identity integrations |
| Email                 | Resend                                  |
| Testing               | Jest / Supertest                        |
| Scheduling            | NestJS Schedule                         |
| Database Migrations   | TypeORM                                 |

---

# Architecture

The application follows a modular NestJS architecture.

Each major domain is organized into its own module with controllers, services/providers, DTOs, entities, enums, and supporting infrastructure.

```text
src/
├── auth/
├── users/
├── agent/
├── vendor/
├── delivery-requests/
├── quotes/
├── orders/
├── escrow/
├── wallets/
├── transactions/
├── paystack/
├── withdrawals/
├── dispute/
├── reviews/
├── verifications/
├── virtual-account/
├── bank-account/
├── favorites/
├── dashboard-overview/
├── s3/
├── mailer/
├── health/
├── common/
├── config/
└── migrations/
```

This structure keeps business domains isolated while allowing them to collaborate through explicit services and providers.

---

# Core Modules

### Authentication

Handles:

* User sign-in
* JWT access tokens
* Refresh tokens
* Password changes
* Password reset
* Email verification
* Role-based access control

Authentication is implemented using NestJS guards and decorators.

---

### Vendors and Agents

The platform separates vendor and delivery-agent functionality while sharing the underlying user/authentication system.

Agents can manage their profiles, verification status, bank information, delivery opportunities, and earnings.

Vendors can create delivery requests, review quotes, manage orders, and fund delivery transactions.

---

### Delivery Requests

A vendor can create a delivery request containing the relevant delivery information.

Agents can discover available delivery opportunities and submit quotes.

The delivery request lifecycle is represented using explicit status enums rather than relying only on implicit database state.

---

### Quotes

Agents can submit delivery quotes against vendor requests.

The quote workflow supports:

```text
Delivery Request
      ↓
Agent Quote
      ↓
Vendor Decision
      ↓
Order Creation
```

---

# Orders

Once a quote is accepted, the backend creates the corresponding order and order items.

Order management includes:

* Order creation
* Order status transitions
* Delivery confirmation
* Cancellation
* Delivery time extensions
* Order item management

Order-related business rules are handled within the orders domain rather than directly inside controllers.

---

# Escrow and Financial Transactions

One of the core engineering concerns of DILIVALY is maintaining consistency when money moves between users.

Funds associated with a delivery can be held in escrow until the delivery is completed.

The escrow service supports two primary state transitions:

```text
HELD
 ├──→ RELEASED
 └──→ REFUNDED
```

### Escrow release

When an eligible delivery is completed:

1. The order item is locked.
2. The associated escrow record is locked.
3. The vendor and agent wallets are locked.
4. The delivery amount is calculated in Kobo.
5. The platform commission is calculated.
6. The vendor's escrow balance is reduced.
7. The agent's available balance is increased.
8. The escrow status is changed to `RELEASED`.
9. A transaction record is created.

These operations are executed within a database transaction.

### Concurrency protection

The escrow implementation uses PostgreSQL transactions and pessimistic write locks for critical records.

For example, the service locks the relevant `OrderItem`, `Escrow`, and wallet records before modifying financial state.

This is intended to prevent concurrent operations from releasing or refunding the same escrow more than once.

The escrow state is also checked before processing:

```typescript
if (escrow.status !== EscrowStatus.HELD) return;
```

This provides an application-level idempotency guard for repeated release/refund attempts.

---

# Monetary Values

Financial calculations are performed in the smallest currency unit (Kobo) rather than relying on floating-point arithmetic for wallet balances.

For example:

```text
₦1,000
   ↓
100,000 Kobo
```

This helps avoid floating-point precision problems when performing financial calculations.

PostgreSQL `bigint` values are also normalized before arithmetic because they may be returned as strings by the database driver.

---

# Database Transactions

Financial operations use TypeORM transactions and can optionally receive an existing `EntityManager`.

This allows a higher-level workflow to include escrow operations within the same database transaction where appropriate.

Conceptually:

```text
BEGIN TRANSACTION

Lock relevant records

Validate current state

Update wallet balances

Update escrow state

Create transaction record

COMMIT
```

If an operation fails before the transaction commits, the database changes are rolled back.

---

# Authentication and Authorization

The API uses JWT-based authentication.

Authentication is enforced through NestJS guards, while role-specific access is handled using role decorators and authorization logic.

Requests are validated using global `ValidationPipe` configuration with:

* `whitelist`
* `forbidNonWhitelisted`
* transformation
* DTO validation

This prevents unexpected request properties from reaching business logic.

---

# Caching and Redis

Redis is used for caching and supporting application-level infrastructure.

The project contains dedicated cache and Redis providers so that caching concerns are not coupled directly to individual controllers.

---

# External Integrations

The backend integrates with several external services.

### Paystack

Used for payment-related operations.

### AWS S3

Used for object/file storage.

### Youverify / Smile Identity

Used for identity and business verification workflows.

### Resend

Used for application email delivery.

External integrations are isolated into dedicated providers/modules rather than being embedded directly into controllers.

---

# API Documentation

Swagger/OpenAPI documentation is configured in the application.

When the application is running, the Swagger UI is available at:

```text
/api
```

The deployed API server is currently configured as:

```text
https://diliverly-backend.onrender.com
```

> The deployed URL may change depending on the current hosting environment.

---

# Getting Started

## Prerequisites

Make sure the following are installed:

* Node.js 20+
* npm
* PostgreSQL
* Redis

Clone the repository:

```bash
git clone https://github.com/manugee95/Diliverly-Backend.git
cd Diliverly-Backend
```

Install dependencies:

```bash
npm install
```

---

# Environment Configuration

Create the environment file expected by the application:

```text
.env.development
```

The application requires database and authentication configuration such as:

```env
NODE_ENV=development

PORT=3000

DATABASE_HOST=
DATABASE_PORT=5432
DATABASE_USER=
DATABASE_PASSWORD=
DATABASE_NAME=

JWT_SECRET=
JWT_TOKEN_AUDIENCE=
JWT_TOKEN_ISSUER=
JWT_ACCESS_TOKEN_TTL=
JWT_REFRESH_TOKEN_TTL=

REDIS_URL=

PAYSTACK_SECRET_KEY=

AWS_ACCESS_KEY=
AWS_SECRET_KEY=
AWS_REGION=
AWS_BUCKET_NAME=

SMILE_API_KEY=
SMILE_PARTNER_ID=
SMILE_BASE_URL=
SMILE_CALLBACK_URL=

YV_API_KEY=
YV_BASE_URL=

FRONTEND_URL=
```

Never commit real credentials, API keys, database passwords, or other secrets to the repository.

---

# Running the Application

### Development

```bash
npm run start:dev
```

### Production

Build the application:

```bash
npm run build
```

Start the compiled application:

```bash
npm run start:prod
```

---

# Database Migrations

The project uses TypeORM migrations.

Build the project before running migration commands:

```bash
npm run build
```

Generate a migration:

```bash
npm run migration:generate -- src/migrations/MigrationName
```

Run pending migrations:

```bash
npm run migration:run
```

> Review migrations before applying them to a production database.

---

# Testing

The project is configured with Jest and Supertest.

Run unit tests:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

Run coverage:

```bash
npm run test:cov
```

Run end-to-end tests:

```bash
npm run test:e2e
```

Testing is an ongoing part of the project, with particular attention needed around transactional business logic such as payments, wallets, escrow, and order state transitions.

---

# Engineering Considerations

Several areas of the backend require careful handling because they involve state transitions, concurrency, or external systems.

### Financial consistency

Wallet and escrow updates should be atomic and protected against concurrent modifications.

### Idempotency

Payment callbacks and escrow operations should be safe against repeated requests.

### External service failures

Payment, verification, email, and storage providers can fail independently of the application database.

The system therefore needs to distinguish between external operation state and internal transaction state.

### Database consistency

Operations that modify multiple related records should use appropriate database transactions.

### Input validation

DTO validation is applied globally before requests reach business logic.

---

# Project Structure

A simplified example of the backend structure:

```text
src/
│
├── auth/
├── users/
├── agent/
├── vendor/
│
├── delivery-requests/
├── quotes/
├── orders/
├── escrow/
│
├── wallets/
├── transactions/
├── withdrawals/
├── dispute/
│
├── paystack/
├── virtual-account/
├── bank-account/
│
├── verifications/
├── s3/
├── mailer/
│
├── common/
├── config/
├── health/
└── migrations/
```

---

# API Examples

HTTP request examples for several modules are included within their respective `http/` directories.

These can be used with compatible REST clients such as VS Code REST Client or similar tools.

---

# Current Project Status

DILIVALY is an actively developed backend/MVP project.

The repository demonstrates the backend architecture and core workflows of the platform, including authentication, delivery requests, quoting, orders, escrow, wallet operations, transactions, payments, verification, disputes, and supporting infrastructure.

Some areas — particularly comprehensive automated testing, production hardening, and additional observability — remain areas for continued development.

---

# Engineering Focus

This project was built with particular attention to:

* Modular backend architecture
* Transactional database operations
* Financial state management
* Concurrency control
* Idempotent state transitions
* API validation
* Authentication and authorization
* External service integrations
* Database migrations
* Redis-backed infrastructure
* Maintainable domain separation

---

## Author

**Emmanuel Eseigbe**

Software Engineer — TypeScript / JavaScript / Node.js / NestJS

GitHub: https://github.com/manugee95
