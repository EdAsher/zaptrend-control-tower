const { db, FieldValue } = require("../config/firestore");
const { COLLECTIONS } = require("../config/constants");

function timeoutPromise(ms) {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), ms)
  );
}

async function checkUrlHealth(url) {
  if (!url) {
    return {
      status: "dead",
      reason: "invalid_url"
    };
  }

  try {
    const start = Date.now();

    const res = await Promise.race([
      fetch(url, {
        method: "GET",
        redirect: "follow",
        headers: {
          "user-agent": "Mozilla/5.0 ZapTrendBot/1.0"
        }
      }),
      timeoutPromise(5000)
    ]);

    const duration = Date.now() - start;
    const httpStatus = Number(res.status || 0);

    if (httpStatus >= 200 && httpStatus < 300) {
      return {
        status: "healthy",
        reason: "200_ok",
        http_status: httpStatus,
        response_ms: duration
      };
    }

    if (httpStatus >= 300 && httpStatus < 400) {
      return {
        status: "warning",
        reason: "redirect",
        http_status: httpStatus,
        response_ms: duration
      };
    }

    if (httpStatus === 404) {
      return {
        status: "dead",
        reason: "404",
        http_status: httpStatus,
        response_ms: duration
      };
    }

    if (httpStatus === 401 || httpStatus === 403) {
      return {
        status: "unknown",
        reason: "access_restricted",
        http_status: httpStatus,
        response_ms: duration
      };
    }

    if (httpStatus === 408 || httpStatus === 429) {
      return {
        status: "unknown",
        reason: "temporary_block_or_timeout",
        http_status: httpStatus,
        response_ms: duration
      };
    }

    if (httpStatus >= 500) {
      return {
        status: "warning",
        reason: "server_error",
        http_status: httpStatus,
        response_ms: duration
      };
    }

    return {
      status: "unknown",
      reason: "unknown_status",
      http_status: httpStatus,
      response_ms: duration
    };
  } catch (err) {
    const message = String(err?.message || "network_error").toLowerCase();

    if (
      message.includes("timeout") ||
      message.includes("network") ||
      message.includes("fetch") ||
      message.includes("tls") ||
      message.includes("socket") ||
      message.includes("certificate")
    ) {
      return {
        status: "unknown",
        reason: "fetch_failed_non_blocking"
      };
    }

    return {
      status: "unknown",
      reason: err?.message || "fetch_failed_non_blocking"
    };
  }
}

async function updateHealthDoc(docRef, data) {
  const health = await checkUrlHealth(data.url);

  const failCount = Number(data.health_fail_count || 0);
  const consecutiveFail = Number(data.health_consecutive_fail_count || 0);

  const isFail = health.status === "dead";
  const newFailCount = isFail ? failCount + 1 : failCount;
  const newConsecutiveFail = isFail ? consecutiveFail + 1 : 0;

  const autoDisabled = newConsecutiveFail >= 3 || newFailCount >= 5;

  await docRef.set(
    {
      health_status: autoDisabled ? "disabled" : health.status,
      health_reason: autoDisabled
        ? "health_threshold_exceeded"
        : health.reason,
      health_http_status: health.http_status || null,
      health_fail_count: newFailCount,
      health_consecutive_fail_count: newConsecutiveFail,
      health_response_ms: health.response_ms || null,
      health_last_checked_at: FieldValue.serverTimestamp(),
      is_active: autoDisabled ? false : true,
      auto_disabled: autoDisabled,
      auto_disabled_reason: autoDisabled
        ? "health_threshold_exceeded"
        : ""
    },
    { merge: true }
  );

  return {
    collection: docRef.parent.id,
    id: docRef.id,
    url: data.url || "",
    health_status: autoDisabled ? "disabled" : health.status,
    health_reason: autoDisabled ? "health_threshold_exceeded" : health.reason
  };
}

async function runHealthCheckForCollection(collectionName, {
  country,
  category,
  limit = 50
}) {
  const snap = await db.collection(collectionName).limit(limit).get();

  let checked = 0;
  let updated = 0;
  const results = [];

  for (const doc of snap.docs) {
    const data = doc.data();

    if (
      country &&
      String(data.country || "").toUpperCase() !== String(country).toUpperCase()
    ) {
      continue;
    }

    if (category && String(data.category || "") !== String(category || "")) {
      continue;
    }

    checked++;

    const result = await updateHealthDoc(doc.ref, data);
    results.push(result);
    updated++;
  }

  return {
    checked,
    updated,
    results
  };
}

async function runSourceHealthCheck({
  country,
  category,
  limit = 50,
  include_candidates = true
}) {
  const aiResult = await runHealthCheckForCollection(
    COLLECTIONS.AI_SOURCES,
    { country, category, limit }
  );

  let candidateResult = {
    checked: 0,
    updated: 0,
    results: []
  };

  if (include_candidates) {
    candidateResult = await runHealthCheckForCollection(
      COLLECTIONS.SOURCE_DISCOVERY_CANDIDATES,
      { country, category, limit }
    );
  }

  return {
    ok: true,
    checked: aiResult.checked + candidateResult.checked,
    updated: aiResult.updated + candidateResult.updated,
    ai_sources_checked: aiResult.checked,
    ai_sources_updated: aiResult.updated,
    candidates_checked: candidateResult.checked,
    candidates_updated: candidateResult.updated,
    results: [...aiResult.results, ...candidateResult.results]
  };
}

module.exports = {
  runSourceHealthCheck
};