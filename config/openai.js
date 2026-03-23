const OpenAI = require("openai");
const { env } = require("./env");

let openai = null;

if (env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY
  });
}

module.exports = {
  openai
};