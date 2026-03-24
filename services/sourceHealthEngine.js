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
      fetch(url, { method: "GET" }),
      timeoutPromise(5000)
    ]);

    const duration = Date.now() - start;

    const httpStatus = res.status;

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
        http_status: httpStatus
      };
    }

    if (httpStatus >= 500) {
      return {
        status: "warning",
        reason: "server_error",
        http_status: httpStatus
      };
    }

    return {
      status: "warning",
      reason: "unknown_status",
      http_status: httpStatus
    };

  } catch (err) {
    return {
      status: "dead",
      reason: err.message || "network_error"
    };
  }
}

async function runSourceHealthCheck({
  country,
  category,
  limit = 50
}) {
  const snap = await db
    .collection(COLLECTIONS.AI_SOURCES)
    .limit(limit)
    .get();

  let checked = 0;
  let updated = 0;

  for (const doc of snap.docs) {
    const data = doc.data();

    if (country && data.country !== country) continue;
    if (category && data.category !== category) continue;

    checked++;

    const health = await checkUrlHealth(data.url);

    const failCount = data.health_fail_count || 0;
    const consecutiveFail = data.health_consecutive_fail_count || 0;

    const isFail = health.status === "dead";

    const newFailCount = isFail ? failCount + 1 : failCount;
    const newConsecutiveFail = isFail ? consecutiveFail + 1 : 0;

    const autoDisabled =
      newConsecutiveFail >= 3 || newFailCount >= 5;

    await doc.ref.set(
      {
        health_status: health.status,
        health_reason: health.reason,
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

    updated++;
  }

  return {
    ok: true,
    checked,
    updated
  };
}

module.exports = {
  runSourceHealthCheck
};