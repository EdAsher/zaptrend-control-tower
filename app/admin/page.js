"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import AdminShell from "../../components/admin/AdminShell";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import AdminSurface from "../../components/admin/AdminSurface";
import AdminMetricCard from "../../components/admin/AdminMetricCard";
import AdminStatusPill from "../../components/admin/AdminStatusPill";
import AdminActionButton from "../../components/admin/AdminActionButton";
import AdminSectionTitle from "../../components/admin/AdminSectionTitle";

import ActivityFeed from "../../components/admin/ActivityFeed";
import {
  getDashboardActivity,
  getDashboardOverview,
  runGuidedDiscovery,
  runSocialScan,
  evaluateTrials,
  recalculateReputation,
  processQueue
} from "../../lib/zaptrend";

function NavLinkCard({ href, title, desc, accent = "cyan" }) {
  const accentMap = {
    cyan: "text-cyan-300 border-cyan-400/20 bg-cyan-400/10",
    orange: "text-orange-300 border-orange-400/20 bg-orange-400/10",
    pink: "text-pink-300 border-pink-400/20 bg-pink-400/10",
    emerald: "text-emerald-300 border-emerald-400/20 bg-emerald-400/10"
  };

  return (
    <Link href={href}>
      <AdminSurface hover className="h-full">
        <div
          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
            accentMap[accent] || accentMap.cyan
          }`}
        >
          Open
        </div>

        <div className="mt-4 text-lg font-semibold text-white">{title}</div>
        <div className="mt-2 text-sm leading-6 text-zinc-400">{desc}</div>
      </AdminSurface>
    </Link>
  );
}

function RunStatusCard({ title, status, lines = [] }) {
  return (
    <AdminSurface>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
            {title}
          </div>
          <div className="mt-3 text-xl font-semibold text-white">
            {String(status || "UNKNOWN").toUpperCase()}
          </div>
        </div>

        <AdminStatusPill value={status} />
      </div>

      <div className="mt-5 space-y-3">
        {lines.map((line) => (
          <div
            key={line.label}
            className="flex items-start justify-between gap-4 border-b border-white/5 pb-3 last:border-b-0 last:pb-0"
          >
            <div className="text-sm text-zinc-400">{line.label}</div>
            <div className="max-w-[60%] break-words text-right text-sm text-white">
              {line.value ?? "-"}
            </div>
          </div>
        ))}
      </div>
    </AdminSurface>
  );
}

export default function AdminOverviewPage() {
  const [overview, setOverview] = useState(null);
  const [activity, setActivity] = useState([]);
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState("");

  async function load() {
    try {
      setError("");
      const [overviewData, activityData] = await Promise.all([
        getDashboardOverview(),
        getDashboardActivity(20)
      ]);
      setOverview(overviewData);
      setActivity(activityData.results || []);
    } catch (err) {
      setError(err.message || String(err));
    }
  }

  useEffect(() => {
    load();
  }, []);

  const stable = overview?.stable_sources || {};
  const social = overview?.social_sources || {};
  const mentions = overview?.social_mentions || {};

  const summary = useMemo(() => {
    return {
      stableActive: stable.active ?? 0,
      candidates: stable.candidate ?? 0,
      disabled: stable.disabled ?? 0,
      socialActive: social.active ?? 0,
      mentions: mentions.total ?? 0
    };
  }, [stable, social, mentions]);

  async function runAction(label, fn) {
    try {
      setBusyAction(label);
      setError("");
      await fn();
      await load();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusyAction("");
    }
  }

  return (
    <AdminShell>
      <AdminPageHeader
        title="Overview"
        subtitle="Futuristic command center for social signals, discovery, trials, reputation, promotion, sources intelligence, and trend scoring."
      />

      {error ? (
        <div className="mb-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4 zt-fade-up">
        <NavLinkCard
          href="/admin/sources"
          title="Sources Intelligence"
          desc="Operate AI sources, candidate states, reputation, and promotion outcomes."
          accent="cyan"
        />
        <NavLinkCard
          href="/admin/trends"
          title="Trends Intelligence"
          desc="See ranked trend outputs, trend runs, and hot product signals."
          accent="pink"
        />
        <NavLinkCard
          href="/admin/generation"
          title="Generation Console"
          desc="Open generation controls, queue processing, and output preview."
          accent="orange"
        />
        <NavLinkCard
          href="/admin/automation"
          title="Automation Command Center"
          desc="Monitor single-market and multi-market autonomous trend runs."
          accent="emerald"
        />
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5 zt-fade-up">
        <AdminMetricCard
          title="Active Stable Sources"
          value={stable.active ?? "-"}
          subtitle={`Total ${stable.total ?? 0}`}
          accent="emerald"
        />
        <AdminMetricCard
          title="Trial Sources"
          value={stable.candidate ?? "-"}
          subtitle="Awaiting promotion or disable"
          accent="cyan"
        />
        <AdminMetricCard
          title="Disabled Sources"
          value={stable.disabled ?? "-"}
          subtitle="Needs review"
          accent="rose"
        />
        <AdminMetricCard
          title="Social Sources"
          value={social.active ?? "-"}
          subtitle={`Total ${social.total ?? 0}`}
          accent="violet"
        />
        <AdminMetricCard
          title="Social Mentions"
          value={mentions.total ?? "-"}
          subtitle="Current signal pool"
          accent="orange"
        />
      </div>

      <div className="mb-8 grid gap-4 xl:grid-cols-3 zt-fade-up">
        <RunStatusCard
          title="Latest Social Run"
          status={overview?.latest_social_run?.status}
          lines={[
            { label: "Run ID", value: overview?.latest_social_run?.run_id || "-" },
            { label: "Mentions", value: overview?.latest_social_run?.mentions_found ?? 0 },
            { label: "Created", value: overview?.latest_social_run?.created_at_iso || "-" }
          ]}
        />

        <RunStatusCard
          title="Latest Discovery Run"
          status={overview?.latest_discovery_run?.status}
          lines={[
            { label: "Run ID", value: overview?.latest_discovery_run?.run_id || "-" },
            { label: "Accepted", value: overview?.latest_discovery_run?.accepted_count ?? 0 },
            { label: "Trialed", value: overview?.latest_discovery_run?.trialed_count ?? 0 }
          ]}
        />

        <RunStatusCard
          title="Latest Trend Run"
          status={overview?.latest_trend_run?.status}
          lines={[
            { label: "Run ID", value: overview?.latest_trend_run?.run_id || "-" },
            { label: "Generated", value: overview?.latest_trend_run?.generated_count ?? 0 },
            {
              label: "Updated",
              value:
                overview?.latest_trend_run?.updated_at_iso ||
                overview?.latest_trend_run?.created_at_iso ||
                "-"
            }
          ]}
        />
      </div>

      <div className="mb-8 grid gap-6 xl:grid-cols-[1.25fr_0.95fr] zt-fade-up">
        <AdminSurface>
          <div className="mb-4 flex items-center justify-between gap-4">
            <AdminSectionTitle
              eyebrow="Live Activity"
              title="Recent Engine Events"
              subtitle="Latest events produced by the ZapTrend engines and workflows."
            />

            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
              {activity.length} items
            </div>
          </div>

          <ActivityFeed items={activity} />
        </AdminSurface>

        <AdminSurface>
          <AdminSectionTitle
            eyebrow="Quick Actions"
            title="Engine Controls"
            subtitle="Trigger live engine runs and refresh dashboard state."
          />

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <AdminActionButton
              label={busyAction === "Run Social Scan" ? "Running..." : "Run Social Scan"}
              onClick={() =>
                runAction("Run Social Scan", async () => {
                  await runSocialScan();
                })
              }
              tone="orange"
              disabled={busyAction !== ""}
            />

            <AdminActionButton
              label={busyAction === "Guided Discovery" ? "Running..." : "Guided Discovery"}
              onClick={() =>
                runAction("Guided Discovery", async () => {
                  await runGuidedDiscovery();
                })
              }
              tone="cyan"
              disabled={busyAction !== ""}
            />

            <AdminActionButton
              label={busyAction === "Evaluate Trials" ? "Running..." : "Evaluate Trials"}
              onClick={() =>
                runAction("Evaluate Trials", async () => {
                  await evaluateTrials();
                })
              }
              tone="emerald"
              disabled={busyAction !== ""}
            />

            <AdminActionButton
              label={
                busyAction === "Recalculate Reputation"
                  ? "Running..."
                  : "Recalculate Reputation"
              }
              onClick={() =>
                runAction("Recalculate Reputation", async () => {
                  await recalculateReputation();
                })
              }
              tone="dark"
              disabled={busyAction !== ""}
            />

            <AdminActionButton
              label={busyAction === "Process Queue" ? "Running..." : "Process Queue"}
              onClick={() =>
                runAction("Process Queue", async () => {
                  await processQueue();
                })
              }
              tone="dark"
              disabled={busyAction !== ""}
            />

            <AdminActionButton
              label={busyAction === "Refresh Dashboard" ? "Refreshing..." : "Refresh Dashboard"}
              onClick={() =>
                runAction("Refresh Dashboard", async () => {
                  await load();
                })
              }
              tone="dark"
              disabled={busyAction !== ""}
            />
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
              Live Summary
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-zinc-500">Stable Active</div>
                <div className="mt-1 text-2xl font-semibold text-white">
                  {summary.stableActive}
                </div>
              </div>

              <div>
                <div className="text-xs text-zinc-500">Candidates</div>
                <div className="mt-1 text-2xl font-semibold text-white">
                  {summary.candidates}
                </div>
              </div>

              <div>
                <div className="text-xs text-zinc-500">Social Sources</div>
                <div className="mt-1 text-2xl font-semibold text-white">
                  {summary.socialActive}
                </div>
              </div>

              <div>
                <div className="text-xs text-zinc-500">Mentions Pool</div>
                <div className="mt-1 text-2xl font-semibold text-white">
                  {summary.mentions}
                </div>
              </div>
            </div>
          </div>
        </AdminSurface>
      </div>
    </AdminShell>
  );
}