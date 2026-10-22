const express = require("express");
const { createAuthRouter } = require("./auth");
const { createCompanyRouter } = require("./company");
const { createCustomersRouter } = require("./customers");
const { createServicesRouter } = require("./services");
const { createProposalsRouter } = require("./proposals");
const { createContractsRouter } = require("./contracts");
const { createFinanceRouter } = require("./finance");
const { createOnboardingRouter } = require("./onboarding");
const { createCustomerActivityRouter } = require("./customer-activities");

function createApiRouter({ pool, appOrigin }) {
  const router = express.Router();

  router.get("/health", (_req, res) => res.json({ status: "ok" }));
  router.use("/auth", createAuthRouter({ pool, appOrigin }));
  router.use("/company", createCompanyRouter({ pool, appOrigin }));
  router.use("/customers", createCustomersRouter({ pool, appOrigin }));
  router.use("/services", createServicesRouter({ pool, appOrigin }));
  router.use("/proposals", createProposalsRouter({ pool, appOrigin }));
  router.use("/contracts", createContractsRouter({ pool, appOrigin }));
  router.use("/finance", createFinanceRouter({ pool, appOrigin }));
  router.use("/onboarding", createOnboardingRouter({ pool, appOrigin }));
  router.use("/customer-activities", createCustomerActivityRouter({ pool, appOrigin }));

  return router;
}

module.exports = { createApiRouter };
