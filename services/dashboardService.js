"use strict";

const { Firestore } = require("@google-cloud/firestore");

const db = new Firestore();

async function getLatestDoc(collectionName, orderField = "created_at_iso") {
  const snap = await db.collection(collectionName).orderBy(orderField, "desc").limit(1).get();
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

async function getCollectionCount(collectionName) {
  const snap = await db.collection(collectionName).get();
  return snap.size || 0;
}

async function getDashboardOverview() {
  const [
    latestDiscoveryRun,
    latestSocialRun,
    latestTrendRun,
    sourceSnap,
    trendSnap,
    postCount
  ] = await Promise.all([
    getLatestDoc("source_discovery_runs"),
    getLatestDoc("social_scan_runs"),
    getLatestDoc("trend_consensus_runs"),
    db.collection("social_sources").get(),
    db.collection("trend_items").get(),
    getCollectionCount("social_posts")
  ]);

  const allSources = sourceSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const activeSources = allSources.filter((x) => x.status === "active").length;
  const healthySources = allSources.filter((x) => x.health_status === "healthy" && !x.auto_disabled).length;
  const unhealthySources = allSources.filter((x) => x.health_status !== "healthy" || x.auto_disabled).length;

  const allTrends = trendSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const newRising = allTrends.filter((x) => x.status_band === "new_rising").length;
  const trending = allTrends.filter((x) => x.status_band === "trending").length;
  const holding = allTrends.filter((x) => x.status_band === "holding").length;

  return {
    sources: {
      total: allSources.length,
      active: activeSources,
      healthy: healthySources,
      unhealthy: unhealthySources
    },
    posts: {
      total: postCount
    },
    trends: {
      total: allTrends.length,
      new_rising: newRising,
      trending,
      holding
    },
    latest_discovery_run: latestDiscoveryRun
      ? {
          run_id: latestDiscoveryRun.run_id || null,
          status: latestDiscoveryRun.status || "COMPLETED",
          discovered_count: latestDiscoveryRun.discovered_count || 0,
          healthy_count: latestDiscoveryRun.healthy_count || 0,
          unhealthy_count: latestDiscoveryRun.unhealthy_count || 0,
          created_at_iso:
            latestDiscoveryRun.completed_at_iso ||
            latestDiscoveryRun.started_at_iso ||
            latestDiscoveryRun.created_at_iso ||
            null
        }
      : null,
    latest_social_run: latestSocialRun
      ? {
          run_id: latestSocialRun.run_id || null,
          status: latestSocialRun.status || "COMPLETED",
          sources_scanned: latestSocialRun.sources_scanned || 0,
          posts_saved: latestSocialRun.posts_saved || 0,
          created_at_iso:
            latestSocialRun.completed_at_iso ||
            latestSocialRun.started_at_iso ||
            latestSocialRun.created_at_iso ||
            null
        }
      : null,
    latest_trend_run: latestTrendRun
      ? {
          run_id: latestTrendRun.run_id || null,
          status: latestTrendRun.status || "COMPLETED",
          generated_count: latestTrendRun.generated_count || 0,
          source_posts: latestTrendRun.source_posts || 0,
          created_at_iso:
            latestTrendRun.completed_at_iso ||
            latestTrendRun.started_at_iso ||
            latestTrendRun.created_at_iso ||
            null
        }
      : null
  };
}

async function getDashboardActivity(limit = 20) {
  const [discoverySnap, socialSnap, trendSnap] = await Promise.all([
    db.collection("source_discovery_runs").orderBy("created_at_iso", "desc").limit(limit).get(),
    db.collection("social_scan_runs").orderBy("created_at_iso", "desc").limit(limit).get(),
    db.collection("trend_consensus_runs").orderBy("created_at_iso", "desc").limit(limit).get()
  ]);

  const discoveryItems = discoverySnap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      type: "discovery_run",
      title: `Discovery run for ${data.country || "-"} / ${data.category || "-"}`,
      status: data.status || "COMPLETED",
      created_at: data.completed_at_iso || data.started_at_iso || data.created_at_iso || null,
      meta: {
        run_id: data.run_id || doc.id,
        discovered_count: data.discovered_count || 0,
        healthy_count: data.healthy_count || 0,
        unhealthy_count: data.unhealthy_count || 0
      }
    };
  });

  const socialItems = socialSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      type: "social_run",
      title: `Social scan for ${data.country || "-"} / ${data.category || "-"}`,
      status: data.status || "COMPLETED",
      created_at: data.completed_at_iso || data.started_at_iso || data.created_at_iso || null,
      meta: {
        run_id: data.run_id || doc.id,
        sources_scanned: data.sources_scanned || 0,
        posts_saved: data.posts_saved || 0
      }
    };
  });

  const trendItems = trendSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      type: "trend_run",
      title: `Trend scoring for ${data.country || "-"} / ${data.category || "-"}`,
      status: data.status || "COMPLETED",
      created_at: data.completed_at_iso || data.started_at_iso || data.created_at_iso || null,
      meta: {
        run_id: data.run_id || doc.id,
        generated_count: data.generated_count || 0,
        source_posts: data.source_posts || 0
      }
    };
  });

  const results = [...discoveryItems, ...socialItems, ...trendItems]
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
    .slice(0, limit);

  return { results };
}

module.exports = {
  getDashboardOverview,
  getDashboardActivity
};