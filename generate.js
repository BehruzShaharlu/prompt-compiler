// Vercel serverless function: sends the prompt to Google Gemini and returns code.
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: "Server is missing GEMINI_API_KEY" });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const prompt = String(body.prompt || "").slice(0, 3000);
  const lang = String(body.lang || "C++").slice(0, 20);
  if (!prompt.trim()) return res.status(400).json({ error: "Empty prompt" });

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const instruction =
    "You are an expert programmer inside an online compiler. Solve the problem below in " + lang +
    ". Output ONLY the complete, ready-to-run source code. No markdown fences and no text outside the code. " +
    "Put short helpful comments inside the code.\n\nProblem:\n" + prompt;

  try {
    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({ contents: [{ parts: [{ text: instruction }] }] }),
      }
    );
    const data = await r.json();
    if (!r.ok) {
      const m = (data.error && data.error.message) || "Gemini error";
      return res.status(r.status === 429 ? 429 : 502).json({
        error: r.status === 429 ? "Free limit reached. Try again in a minute." : m,
      });
    }
    const parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
    const code = parts.map((p) => p.text || "").join("");
    if (!code) return res.status(502).json({ error: "The AI returned no code. Try rephrasing." });
    return res.status(200).json({ code });
  } catch (e) {
    return res.status(500).json({ error: "Could not reach the AI service." });
  }
};
