"use strict";

const express = require("express");
const cors = require("cors");

const adminDashboardRoutes = require("./routes/adminDashboard");
const adminSocialRoutes = require("./routes/adminSocial");
const adminDiscoveryRoutes = require("./routes/adminDiscovery");
const adminTrialsRoutes = require("./routes/adminTrials");
const adminReputationRoutes = require("./routes/adminReputation");
const adminGenerationRoutes = require("./routes/adminGeneration");
const adminSourcesRoutes = require("./routes/adminSources");
const adminTrendsRoutes = require("./routes/adminTrends");
const adminSignalScanRoutes = require("./routes/adminSignalScan");
const adminTrendScoringRoutes = require("./routes/adminTrendScoring");
const adminTrendFeedRoutes = require("./routes/adminTrendFeed");
const adminTrendAutomationRoutes = require("./routes/adminTrendAutomation");
const adminSourceHealthRoutes = require("./routes/adminSourceHealth");

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/health", (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

app.use("/admin", adminDashboardRoutes);
app.use("/admin", adminSocialRoutes);
app.use("/admin", adminDiscoveryRoutes);
app.use("/admin", adminTrialsRoutes);
app.use("/admin", adminReputationRoutes);
app.use("/admin", adminGenerationRoutes);
app.use("/admin", adminSourcesRoutes);
app.use("/admin", adminTrendsRoutes);
app.use("/admin", adminSignalScanRoutes);
app.use("/admin", adminTrendScoringRoutes);
app.use("/admin", adminTrendFeedRoutes);
app.use("/admin", adminTrendAutomationRoutes);
app.use("/admin", adminSourceHealthRoutes);

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`ZapTrend API listening on ${PORT}`);
});