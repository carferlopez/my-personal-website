const express = require("express");
const path = require("path");
const { Resend } = require("resend");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;
const TRUST_PROXY = String(process.env.TRUST_PROXY || "").toLowerCase() === "true";

app.disable("x-powered-by");
if (TRUST_PROXY) app.set("trust proxy", true);

if (!process.env.RESEND_API_KEY) {
  throw new Error("Missing RESEND_API_KEY in environment variables.");
}

const resend = new Resend(process.env.RESEND_API_KEY);
const EMAIL_FROM = process.env.RESEND_FROM || "onboarding@resend.dev";
const EMAIL_TO = process.env.RESEND_TO || "hola@carlosmakes.com";
const RATE_LIMIT_WINDOW_MS = Number(process.env.CONTACT_RATE_WINDOW_MS || 15 * 60 * 1000);
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.CONTACT_RATE_MAX_REQUESTS || 5);
const RATE_LIMIT_COOLDOWN_MS = Number(process.env.CONTACT_RATE_COOLDOWN_MS || 30 * 1000);
const MIN_SUBMIT_TIME_MS = Number(process.env.CONTACT_MIN_SUBMIT_TIME_MS || 2500);

app.use(express.json({ limit: "32kb" }));
app.use(express.static(path.join(__dirname)));

const contactRateStore = new Map();

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
}

function applyContactRateLimit(ip) {
  const now = Date.now();
  const state = contactRateStore.get(ip) || { hits: [], blockedUntil: 0 };
  state.hits = state.hits.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);

  if (state.blockedUntil > now) {
    contactRateStore.set(ip, state);
    return false;
  }

  if (state.hits.length >= RATE_LIMIT_MAX_REQUESTS) {
    state.blockedUntil = now + RATE_LIMIT_WINDOW_MS;
    contactRateStore.set(ip, state);
    return false;
  }

  const lastHit = state.hits[state.hits.length - 1];
  if (typeof lastHit === "number" && now - lastHit < RATE_LIMIT_COOLDOWN_MS) {
    contactRateStore.set(ip, state);
    return false;
  }

  state.hits.push(now);
  contactRateStore.set(ip, state);
  return true;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

app.post("/api/send-email", async (req, res) => {
  const { name, email, message, website, startedAt } = req.body ?? {};
  const ip = getClientIp(req);
  const startedAtMs = Number(startedAt);
  const safeName = typeof name === "string" ? name.trim() : "";
  const safeEmail = typeof email === "string" ? email.trim() : "";
  const safeMessage = typeof message === "string" ? message.trim() : "";
  const safeWebsite = typeof website === "string" ? website.trim() : "";
  const now = Date.now();

  if (safeWebsite.length > 0) {
    return res.status(400).json({ error: "Rejected." });
  }

  if (!Number.isFinite(startedAtMs) || now - startedAtMs < MIN_SUBMIT_TIME_MS || startedAtMs > now + 10_000) {
    return res.status(400).json({ error: "Rejected." });
  }

  if (!applyContactRateLimit(ip)) {
    return res.status(429).json({ error: "Too many requests. Please try again later." });
  }

  if (safeName.length < 2 || safeName.length > 120) {
    return res.status(400).json({ error: "Invalid name." });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail) || safeEmail.length > 254) {
    return res.status(400).json({ error: "Invalid email." });
  }

  if (safeMessage.length < 10 || safeMessage.length > 5000) {
    return res.status(400).json({ error: "Invalid message." });
  }

  const urlCount = (safeMessage.match(/https?:\/\//gi) || []).length;
  if (urlCount > 3) {
    return res.status(400).json({ error: "Invalid message." });
  }

  try {
    const subject = `Nuevo contacto web - ${safeName}`;
    const html = `
      <h2>Nuevo mensaje desde carlosmakes.com</h2>
      <p><strong>Nombre:</strong> ${escapeHtml(safeName)}</p>
      <p><strong>Email:</strong> ${escapeHtml(safeEmail)}</p>
      <p><strong>Mensaje:</strong></p>
      <p>${escapeHtml(safeMessage).replace(/\n/g, "<br>")}</p>
    `;

    const response = await resend.emails.send({
      from: EMAIL_FROM,
      to: EMAIL_TO,
      subject,
      html,
      replyTo: safeEmail,
    });

    return res.status(200).json({
      ok: true,
      id: response?.data?.id ?? null,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "Failed to send email with Resend.",
      details: error?.message ?? "Unknown error",
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
