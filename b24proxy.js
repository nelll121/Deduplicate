// netlify/functions/b24proxy.js
// Проксирует запросы к Битрикс24 REST API, обходя CORS

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  // Preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { webhook, method, params } = body;

  if (!webhook || !method) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "webhook and method are required" }) };
  }

  // Базовая валидация — разрешаем только bitrix24 домены
  let webhookUrl;
  try {
    webhookUrl = new URL(webhook);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid webhook URL" }) };
  }

  if (!webhookUrl.hostname.includes("bitrix24")) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: "Only bitrix24 domains allowed" }) };
  }

  const targetUrl = `${webhook.replace(/\/$/, "")}/${method}`;

  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params || {}),
    });

    const data = await response.json();
    return { statusCode: 200, headers, body: JSON.stringify(data) };

  } catch (err) {
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: "Proxy fetch failed", detail: err.message }),
    };
  }
};
