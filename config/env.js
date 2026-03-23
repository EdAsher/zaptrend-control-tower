function required(name, fallback = "") {
  const value = process.env[name] ?? fallback;

  if (value === undefined || value === null || value === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function optional(name, fallback = "") {
  const value = process.env[name];
  return value === undefined || value === null || value === "" ? fallback : value;
}

const env = {
  NODE_ENV: optional("NODE_ENV", "development"),
  PORT: Number(optional("PORT", "8080")),

  OPENAI_API_KEY: optional("OPENAI_API_KEY", ""),

  FIRESTORE_PROJECT_ID: optional("FIRESTORE_PROJECT_ID", ""),

  ZAPTREND_DEFAULT_COUNTRY: optional("ZAPTREND_DEFAULT_COUNTRY", "TH"),
  ZAPTREND_DEFAULT_CATEGORY: optional(
    "ZAPTREND_DEFAULT_CATEGORY",
    "beauty_skincare"
  ),

  ZAPTREND_SIGNAL_LIMIT: Number(optional("ZAPTREND_SIGNAL_LIMIT", "10")),
  ZAPTREND_DISCOVERY_LIMIT: Number(optional("ZAPTREND_DISCOVERY_LIMIT", "10")),
  ZAPTREND_TRIAL_LIMIT: Number(optional("ZAPTREND_TRIAL_LIMIT", "10")),
  ZAPTREND_REPUTATION_LIMIT: Number(optional("ZAPTREND_REPUTATION_LIMIT", "20")),
  ZAPTREND_PROMOTION_LIMIT: Number(optional("ZAPTREND_PROMOTION_LIMIT", "10")),
  ZAPTREND_AUTOMATION_TOKEN: optional("ZAPTREND_AUTOMATION_TOKEN", "")
};

module.exports = {
  env,
  required,
  optional
};