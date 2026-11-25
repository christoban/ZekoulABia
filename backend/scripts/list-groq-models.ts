import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.GROQ_API_KEY;
if (!apiKey) {
  console.error('GROQ_API_KEY is not set');
  process.exit(1);
}

async function listModels() {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const json = await res.json();
    console.log(JSON.stringify(json, null, 2));
  } catch (e: any) {
    console.error('Error fetching Groq models:', e.message || e);
  }
}

listModels();
