# Copilot Instructions

This file will be used to store best practices and reference instructions for the application stack. Please paste your best practices below, and I will keep them for future reference and guidance.

---

*Awaiting best practices from user...*
#Best Practices for the Application Stack

1. Monorepo & Code Organization
•	Use a monorepo structure with clear separation:
•	frontend/ (patient, hospital, HR portals + shared UI components).
•	services/ (each microservice independently deployable).
•	database/ (migrations + seed).
•	infra/ (docker-compose, terraform/bicep/pulumi scripts).
•	Keep shared contracts (DTOs, API specs) in a shared/ library.
•	Use semantic versioning for shared libraries to manage breaking changes.
•	Use tools like Nx or Lerna for dependency management and build optimization in monorepos.
•	Enforce consistent naming conventions:
•	PascalCase for .NET.
•	camelCase for JavaScript.
2. Frontend (React Native Web)
•	Use React Native Web + Expo/Next.js for mobile-first UI.
•	Maintain a shared design system (frontend/shared-components) for consistency.
•	Centralize API calls with an Axios-based client that reads base URLs from .env.
•	Use .env.{env} files (e.g., .env.local, .env.dev) to switch API endpoints per environment.
•	Add accessibility features (WCAG 2.2):
•	ARIA labels.
•	High contrast.
•	Keyboard navigation.
•	Use state management (e.g., Zustand or Redux) for predictable state handling.
•	Implement performance optimizations:
•	Lazy loading and code splitting for faster load times.
•	Real-time user monitoring (RUM) for frontend performance insights.
3. Backend (Azure Functions, .NET 8 Isolated Worker)
•	Each domain = one microservice (e.g., Identity, Profile, Appointments, Billing, Records, Notifications).
•	Enforce 12-Factor App principles: configuration in environment, not in code.
•	Use Dependency Injection for database and service dependencies.
•	Implement global exception handling middleware to return structured error responses.
•	Follow RESTful APIs + FHIR standards for healthcare interoperability.
•	Implement API versioning (e.g., URL-based or header-based) to handle breaking changes.
•	For async workflows, use Azure Service Bus/Event Grid (e.g., audit, notifications).
•	Integrate OpenTelemetry for distributed tracing across microservices.
4. Database (PostgreSQL)
•	Use EF Core migrations per service, stored in database/migrations/.
•	Enforce UUID as primary keys.
•	Enable row-level security (RLS) for sensitive data.
•	Encrypt PHI/PII fields at rest (e.g., identity docs, insurance numbers).
•	Use partitioning and indexing for large tables (e.g., audit logs, notifications).
•	Implement data retention policies to purge/archive expired data (GDPR/HIPAA).
•	Use connection pooling (e.g., PgBouncer) to optimize database connections.
•	Handle connection failures with retry logic and exponential backoff.
5. Environment Configurations
•	Maintain separate configs per environment:
•	.env.local for frontend.
•	appsettings.{Environment}.json for backend.
•	Use Azure Key Vault for sensitive secrets (e.g., DB passwords, API keys).
•	Switch environments via DOTNET_ENVIRONMENT or AzureWebJobsEnvironment.
•	Ensure no secrets are committed to GitHub.
•	Use Infrastructure as Code (IaC) tools like Terraform, Bicep, or Pulumi for programmatic infrastructure management.
6. Security & Compliance
•	Authentication/Authorization: OAuth2 + OpenID Connect (Azure AD B2C or Identity microservice).
•	Password Management:
•	Argon2id hashing.
•	HIBP breach checks.
•	MFA enforcement.
•	Session Security:
•	Short-lived JWTs.
•	Refresh token rotation.
•	Revocation lists.
•	Consent Ledger: Required for sensitive operations (e.g., profile, insurance, SDOH).
•	Audit Ledger: Immutable, append-only, WORM-compliant.
•	PII/PHI Masking: In logs, notifications, exports.
•	Encryption:
•	TLS 1.2+ in transit.
•	AES-256 at rest.
•	HIPAA/GDPR: Data minimization, right-to-rectification, export, and deletion workflows.
•	Implement zero-trust architecture: Verify every request, regardless of source.
•	Ensure supply chain security:
•	Generate Software Bill of Materials (SBOM).
•	Perform dependency scanning for vulnerabilities.
7. Notifications & External APIs
•	Use a Notification Service microservice (one-stop for SMS, Email, WhatsApp).
•	Enforce template-based messaging for WhatsApp (Meta-approved).
•	Mock APIs in Local/SIT (WireMock, JSON Server).
•	Store API credentials in Key Vault, not in configs.
•	For external APIs (e.g., Insurance, Aadhaar, Payment Gateway), use a dedicated integration service.
•	Implement rate limiting and caching (e.g., Redis) for external API calls to improve performance and reduce costs.
8. DevOps, CI/CD & Testing
•	Local Dev: Docker Compose (Postgres, Adminer, API Gateway mock).
•	GitHub Actions: Per microservice CI/CD workflows.
•	Automated Tests:
•	Unit tests: xUnit for backend, Jest for frontend.
•	Integration tests with a seeded DB in CI.
•	End-to-End (E2E): Playwright/Cypress for portal workflows.
•	Static Analysis & Code Quality: SonarCloud or CodeQL.
•	Secrets Scanning: GitHub Advanced Security.
•	Implement blue-green deployments or canary releases for safer rollouts.
9. Monitoring & Observability
•	Use Application Insights for Azure Functions.
•	Forward security events to SIEM (Azure Sentinel).
•	Collect structured logs with Serilog, send to ELK/Splunk.
•	Define alert rules for:
•	Suspicious login spikes.
•	Failed OTP attempts.
•	API downtime.
•	Enable health checks (/healthz) for every microservice.
•	Implement real-time user monitoring (RUM) for frontend performance tracking.
10. Resilience & Recovery
•	Multi-region deployment for critical services (Identity, Profile, Billing).
•	Geo-replication for PostgreSQL Flexible Server.
•	Daily encrypted backups (RPO ≤ 15 min, RTO ≤ 1 hr).
•	Automated failover drills in PreProd.
•	Circuit breaker + retry policies for inter-service and external API calls.
•	Perform chaos engineering (e.g., using Chaos Mesh) to proactively test system resilience.
Key Takeaways
•	Microservices must stay independently deployable.
•	Local-first development with Docker, then promote to Azure with no code changes.
•	Compliance-first mindset: Consent, audit, masking built into workflows.
•	Copilot-driven dev: Prompts for scaffolding, migrations, boilerplate, tests.
•	Observability baked in: Every action traceable and auditable with OpenTelemetry.

## Initial Project Setup

Required:
- Node.js (LTS)
- npm or yarn
- .NET 8 SDK
- PostgreSQL
- Docker Desktop
- Azure Functions Core Tools
- GitHub CLI (for repo creation)

Recommended:
- Visual Studio Code (with extensions for JS/TS, .NET, Docker, Azure)
- pnpm (optional, for faster monorepo installs)
- Git (if not already included with GitHub CLI)
- Azure CLI (for cloud resource management)
- Environment variable manager (e.g., direnv or dotenv-cli)
- Prettier and ESLint (for code formatting and linting)
- Husky (for git hooks, e.g., pre-commit lint/test)
- Docker Compose (for local stack orchestration)
- Flyway or EF Core CLI (for database migrations)

---

# Setup Checklist
- [x] Monorepo folder structure created
- [x] Essential files scaffolded (README.md, package.json, .env.local, etc.)
- [x] Tailwind CSS, PostCSS, Autoprefixer installed and configured in all frontend projects
- [x] PostCSS config files created
- [x] styles.css imported in entry points
- [x] .gitignore and LICENSE added
- [x] copilot-instructions.md created for best practices
- [x] Prettier, ESLint, and Husky configs scaffolded for frontend and backend/services
- [x] Husky pre-commit hooks set up for lint/format (frontend) and dotnet format (backend)
- [x] EditorConfig files added to backend/services

## To Do (if not already done)
- [ ] Install recommended VS Code extensions
- [ ] Add Azure CLI and environment variable manager to dev machines
- [ ] Ensure Docker Compose is installed and working
- [ ] Add Flyway/EF Core CLI for database migrations

## Project Folder Structure

```
eye-hospital-portal/
│
├── frontend/
│   ├── patient-portal/
│   ├── hospital-portal/
│   ├── hr-portal/
│   └── shared-components/
│
├── services/
│   ├── identity-service/
│   ├── profile-service/
│   ├── appointment-service/
│   ├── billing-service/
│   ├── records-service/
│   ├── notifications-service/
│   ├── consent-service/
│   ├── audit-service/
│   └── gateway-service/
│
├── database/
│   ├── migrations/
│   ├── seed/
│   ├── scripts/
│   └── README.md
│
├── infra/
│   ├── docker-compose.yml
│   ├── k8s/
│   └── terraform/
│
├── .github/
│   └── workflows/
│
├── docs/
│   ├── architecture/
│   ├── requirements/
│   ├── ADRs/
│   └── README.md
│
├── .env.local
├── .gitignore
├── README.md
└── LICENSE
```

---

## Initial Project Setup & Tooling

Required:
- Node.js (LTS)
- npm or yarn
- .NET 8 SDK
- PostgreSQL
- Docker Desktop
- Azure Functions Core Tools
- GitHub CLI (for repo creation)

Recommended:
- Visual Studio Code (with extensions for JS/TS, .NET, Docker, Azure)
- pnpm (optional, for faster monorepo installs)
- Git (if not already included with GitHub CLI)
- Azure CLI (for cloud resource management)
- Environment variable manager (e.g., direnv or dotenv-cli)
- Prettier and ESLint (for code formatting and linting)
- Husky (for git hooks, e.g., pre-commit lint/test)
- Docker Compose (for local stack orchestration)
- Flyway or EF Core CLI (for database migrations)

---

## Setup Checklist
- [x] Monorepo folder structure created
- [x] Essential files scaffolded (README.md, package.json, .env.local, etc.)
- [x] Tailwind CSS, PostCSS, Autoprefixer installed and configured in all frontend projects
- [x] PostCSS config files created
- [x] styles.css imported in entry points
- [x] .gitignore and LICENSE added
- [x] copilot-instructions.md created for best practices
- [x] Prettier, ESLint, and Husky configs scaffolded for frontend and backend/services
- [x] Husky pre-commit hooks set up for lint/format (frontend) and dotnet format (backend)
- [x] EditorConfig files added to backend/services

## To Do (if not already done)
- [ ] Install recommended VS Code extensions
- [ ] Add Azure CLI and environment variable manager to dev machines
- [ ] Ensure Docker Compose is installed and working
- [ ] Add Flyway/EF Core CLI for database migrations

---

## Automation Policy
Going forward, any changes to the application stack (add/remove/update tools, configs, or structure) will be automatically reflected in this file for documentation and team reference.

