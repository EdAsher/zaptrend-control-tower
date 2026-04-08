const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// ❌ These are NOT SG-local snack brands
const NON_SG_BRANDS = [
  "mama",
  "ichitan",
  "tao kae noi",
  "pocky thailand",
  "dutch mill"
];

// ❌ Keywords indicating foreign / wrong signals
const NON_SG_KEYWORDS = [
  "thai",
  "thailand",
  "tom yum",
  "thai milk tea"
];

function isContaminated(data = {}) {
  const text = `${data.brand || ""} ${data.product || ""} ${data.memory_key || ""}`.toLowerCase();

  const isSG = data.country === "SG";
  const isSnack = data.category === "snacks_drinks";

  if (!isSG || !isSnack) return false;

  const badBrand = NON_SG_BRANDS.some(b => text.includes(b));
  const badKeyword = NON_SG_KEYWORDS.some(k => text.includes(k));

  return badBrand || badKeyword;
}

async function cleanupCollection(name) {
  const snap = await db.collection(name).get();
  let deleted = 0;

  for (const doc of snap.docs) {
    const data = doc.data();

    if (isContaminated(data)) {
      console.log(`❌ Deleting ${name}:`, doc.id);
      await doc.ref.delete();
      deleted++;
    }
  }

  return deleted;
}

async function main() {
  console.log("🔥 Cleaning SG snack contamination...");

  const memory = await cleanupCollection("signal_memory");
  const events = await cleanupCollection("signal_events");
  const trends = await cleanupCollection("trend_outputs");

  console.log("✅ Done cleanup:");
  console.log({
    signal_memory_deleted: memory,
    signal_events_deleted: events,
    trend_outputs_deleted: trends
  });
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Cleanup failed:", err);
    process.exit(1);
  });