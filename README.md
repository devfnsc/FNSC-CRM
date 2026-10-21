# FNSC-CRM

CRM web application for an independent marketing and onboarding business. This repository will host the application, automated tests, and DevOps configuration for the academic MVP and its continued evolution.

## Initial scope

- Private administrator access
- Customer records and service catalog
- Proposals and PDF export
- Contracts with revision history
- Onboarding checklist and client activity history
- Follow-up tasks
- Manual income/expense records and monthly summaries

## Planned technology

- Frontend: semantic HTML, CSS, and vanilla JavaScript
- Backend: Node.js and Express, exposed as a JSON API
- Database: MySQL
- Version control and CI: GitHub and GitHub Actions

Hosting and production deployment will be documented after we verify the service limits, security requirements, and data-privacy implications. Never commit credentials, `.env` files, or real customer/financial data.

## Development status

The repository is being initialized. The first implementation milestone is F01 (administrator authentication), followed by the customer and service workflows from the approved Trello backlog.
