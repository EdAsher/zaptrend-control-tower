const { Firestore } = require("@google-cloud/firestore");

const db = new Firestore();

async function getDashboardOverview() {
  const [socialRunsSnap, socialMentionsSnap, discoveryRunsSnap, candidateSnap] =
    await Promise.all([
      db.collection("social_runs").orderBy("created_at", "desc").limit(1).get(),
      db.collection("social_mentions").get(),
      db.collection("discovery_runs").orderBy("created_at", "desc").limit(1).get(),
      db.collection("source_discovery_candidates").get()
    ]);

  const latestSocialRun = socialRunsSnap.empty ? null : socialRunsSnap.docs[0].data();
  const latestDiscoveryRun = discoveryRunsSnap.empty
    ? null
    : discoveryRunsSnap.docs[0].data();

  const candidateTotal = candidateSnap.size || 0;

  return {
    stable_sources: {
      active: 0,
      total: 0,
      candidate: candidateTotal,
      disabled: 0
    },
    social_sources: {
      active: latestSocialRun?.source_ids?.length || 0,
      total: latestSocialRun?.source_ids?.length || 0
    },
    social_mentions: {
      total: socialMentionsSnap.size || 0
    },
    latest_social_run: latestSocialRun
      ? {
          run_id: latestSocialRun.run_id || null,
          status: latestSocialRun.status || "COMPLETED",
          mentions_found: latestSocialRun.mentions_detected || 0,
          created_at_iso:
            latestSocialRun.finished_at ||
            latestSocialRun.started_at ||
            null
        }
      : null,
    latest_discovery_run: latestDiscoveryRun
      ? {
          run_id: latestDiscoveryRun.discovery_run_id || null,
          status: latestDiscoveryRun.status || "COMPLETED",
          accepted_count: latestDiscoveryRun.accepted_count || 0,
          trialed_count: latestDiscoveryRun.trialed_count || 0
        }
      : null,
    latest_trend_run: null
  };
}

async function getDashboardActivity(limit = 20) {
  const [socialSnap, discoverySnap] = await Promise.all([
    db.collection("social_runs").orderBy("created_at", "desc").limit(limit).get(),
    db.collection("discovery_runs").orderBy("created_at", "desc").limit(limit).get()
  ]);

  const socialItems = socialSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      type: "social_run",
      title: `Social run completed for ${data.country || "-"} / ${data.category || "-"}`,
      status: data.status || "COMPLETED",
      created_at: data.finished_at || data.started_at || null,
      meta: {
        run_id: data.run_id || doc.id,
        mentions_detected: data.mentions_detected || 0,
        sources_scanned: data.sources_scanned || 0
      }
    };
  });

  const discoveryItems = discoverySnap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      type: "discovery_run",
      title: `Discovery run completed for ${data.country || "-"} / ${data.category || "-"}`,
      status: data.status || "COMPLETED",
      created_at: data.created_at?.toDate?.().toISOString?.() || null,
      meta: {
        run_id: data.discovery_run_id || doc.id,
        candidates_created: data.candidates_created || 0,
        accepted_count: data.accepted_count || 0
      }
    };
  });

  const results = [...socialItems, ...discoveryItems]
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
    .slice(0, limit);

  return { results };
}

module.exports = {
  getDashboardOverview,
  getDashboardActivity
};