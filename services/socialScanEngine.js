async function fetchPublicSourceContent(source) {
  const url = String(source.url || "").trim();
  if (!url) {
    return {
      ok: false,
      source_text: "",
      fetch_status: null,
      error: "missing_url"
    };
  }

  const platform = inferPlatform(url);

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 ZapTrendLite/2.3",
        Accept: "text/html,application/xhtml+xml"
      }
    });

    const raw = await res.text();

    // --- Core metadata extraction ---
    const title = extractTitle(raw);
    const ogTitle = extractMetaContent(raw, "property", "og:title");
    const ogDesc = extractMetaContent(raw, "property", "og:description");
    const metaDesc = extractMetaContent(raw, "name", "description");
    const jsonLd = extractJsonLdText(raw);

    // --- Platform-aware strategy ---
    let mergedText = "";

    if (["instagram", "tiktok", "facebook", "lemon8"].includes(platform)) {
      // Social platforms → prioritize metadata only (avoid noisy body)
      mergedText = normalizeWhitespace(
        [title, ogTitle, ogDesc, metaDesc, jsonLd]
          .filter(Boolean)
          .join(" ")
      );
    } else {
      // YouTube / blogs / web → include structured body
      const interestingBlocks = extractInterestingTextBlocks(raw);
      const bodyText = stripHtml(raw);

      mergedText = normalizeWhitespace(
        [title, ogTitle, ogDesc, metaDesc, jsonLd, interestingBlocks, bodyText]
          .filter(Boolean)
          .join(" ")
      );
    }

    // --- Fallback if metadata too weak ---
    if (!mergedText || mergedText.length < 50) {
      const fallback = stripHtml(raw).slice(0, 800);
      mergedText = normalizeWhitespace(fallback);
    }

    return {
      ok: res.ok,
      source_text: mergedText,
      fetch_status: res.status,
      error: res.ok ? "" : `http_${res.status}`
    };
  } catch (error) {
    return {
      ok: false,
      source_text: "",
      fetch_status: null,
      error: error.message || "fetch_failed"
    };
  }
}

module.exports = {
  runSocialScan
};