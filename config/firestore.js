const { Firestore, FieldValue } = require("@google-cloud/firestore");
const { env } = require("./env");

const firestoreOptions = {};

if (env.FIRESTORE_PROJECT_ID) {
  firestoreOptions.projectId = env.FIRESTORE_PROJECT_ID;
}

const db = new Firestore(firestoreOptions);

module.exports = {
  db,
  FieldValue
};