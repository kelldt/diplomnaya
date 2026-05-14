import crypto from "node:crypto";
import { Agent } from "undici";
import { config } from "./config.js";

export const GEOECO_AI_SYSTEM_PROMPT = [
  "Ты встроенный помощник русскоязычного образовательного веб-сайта «Геоэкология • Водные ресурсы».",
  "",
  "Тематика ресурса: геоэкология и водные ресурсы Земли (водосборы, русла и поймы, состояние пресных вод и морей, загрязнение, антропогенная нагрузка на гидросферу, мониторинг качества воды, очистные сооружения, устойчивое водопользование и смежные аспекты).",
  "",
  "Разделы сайта:",
  "- Главная — обзор, ключевые цифры и карточки переходов в темы;",
  "- Основы — концептуальное вводное по дисциплине;",
  "- Кризис пресных вод — нагрузка на пресную воду и кризисные проявления;",
  "- Океан — загрязнение морей и связь суходола с морем;",
  "- Фактор — антропогенное влияние на водные системы (стоки, перенос веществ);",
  "- Решения — защита водной среды и инструменты снижения нагрузки (обобщённо);",
  "- Контакты — сообщения от посетителей;",
  "- Личный кабинет (после входа) — профиль пользователя и сводная статистика; часть метрик браузера (посещения разделов, сообщения помощнику) хранится только локально.",
  "",
  "Ответы — на русском, лаконично, в тон учебному проекту. Помогаешь с формулировками, структурой текста, краткими объяснениями и черновиками выводов. Если точные данные или ссылки нужны пользователю, но их нет во входящих сообщениях, явно помечай неопределённость и предлагай, что проверить в надёжных источниках.",
  "",
  "Не давай медицинских советов и не подменяешь юридическую экспертизу. Вне тематики воды и геоэкологии можно дать общий совет и мягко вернуть диалог к целям сайта.",
].join("\n");

let cachedToken = null;
let cachedTokenExpiresAtMs = 0;

const dispatcher =
  config?.gigachat?.verifySsl === false
    ? new Agent({ connect: { rejectUnauthorized: false } })
    : undefined;

function assertConfigured() {
  if (!config?.gigachat?.credentials) {
    const hint =
      "Set GIGACHAT_CREDENTIALS (or gigachat.credentials in config.local.json).";
    const e = new Error(`GigaChat is not configured. ${hint}`);
    e.code = "GIGACHAT_NOT_CONFIGURED";
    throw e;
  }
}

async function getAccessToken() {
  assertConfigured();

  const now = Date.now();
  if (cachedToken && now < cachedTokenExpiresAtMs) return cachedToken;

  const rqUid = crypto.randomUUID();
  const body = new URLSearchParams({ scope: config.gigachat.scope }).toString();

  const res = await fetch(config.gigachat.authUrl, {
    method: "POST",
    dispatcher,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      RqUID: rqUid,
      Authorization: `Basic ${config.gigachat.credentials}`
    },
    body
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const e = new Error(
      `GigaChat OAuth failed: ${res.status} ${res.statusText}${
        text ? ` - ${text}` : ""
      }`
    );
    e.code = "GIGACHAT_OAUTH_FAILED";
    throw e;
  }

  const data = await res.json();
  const token = data?.access_token;
  if (!token) {
    const e = new Error("GigaChat OAuth did not return access_token.");
    e.code = "GIGACHAT_OAUTH_BAD_RESPONSE";
    throw e;
  }

  const expiresInSec =
    Number(data?.expires_in) || Number(data?.expiresIn) || 30 * 60;
  cachedToken = token;
  cachedTokenExpiresAtMs = Date.now() + Math.max(60, expiresInSec - 30) * 1000;

  return token;
}

const MAX_MESSAGES = 24;
const MAX_MESSAGE_CHARS = 8000;

function sanitizeContent(s) {
  const t = String(s ?? "").replace(/\u0000/g, "");
  return t.length > MAX_MESSAGE_CHARS ? t.slice(0, MAX_MESSAGE_CHARS) : t;
}

function sanitizePagePath(raw) {
  const s = String(raw ?? "").trim().slice(0, 140);
  if (!s.startsWith("/") && !/^[a-z0-9_.-]+\.html$/i.test(s)) return "";
  if (!/^[/a-zа-яё0-9._\-]+$/iu.test(s)) return "";
  return s;
}

export function composeGigachatMessages(inputMessages, singleUserFallback, pageHint) {
  let list = [];
  if (Array.isArray(inputMessages) && inputMessages.length) {
    list = inputMessages
      .filter(
        (m) =>
          m &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string" &&
          m.content.trim()
      )
      .map((m) => ({
        role: m.role,
        content: sanitizeContent(m.content).trim(),
      }));
  }
  if (!list.length && singleUserFallback != null && String(singleUserFallback).trim()) {
    list = [{ role: "user", content: sanitizeContent(singleUserFallback).trim() }];
  }
  if (!list.length) return null;
  list = list.slice(-MAX_MESSAGES);
  const hint = sanitizePagePath(pageHint);
  const systemPrompt = hint
    ? `${GEOECO_AI_SYSTEM_PROMPT}\n\nТекущая страница (путь): ${hint}. Если уместно, связывай ответ с этим разделом и остальной структурой сайта.`
    : GEOECO_AI_SYSTEM_PROMPT;
  return [{ role: "system", content: systemPrompt }, ...list];
}

export async function gigachatChat({
  message,
  messages: inputMsgs,
  pagePath,
  model = "GigaChat",
  temperature = 0.2,
  maxTokens,
}) {
  const accessToken = await getAccessToken();

  const built = composeGigachatMessages(inputMsgs, message, pagePath);
  if (!built) {
    const e = new Error("Nothing to send to GigaChat.");
    e.code = "GIGACHAT_EMPTY_MESSAGES";
    throw e;
  }

  const payload = {
    model,
    messages: built,
    temperature,
  };
  if (Number.isFinite(maxTokens)) payload.max_tokens = maxTokens;

  const res = await fetch(`${config.gigachat.baseUrl}/chat/completions`, {
    method: "POST",
    dispatcher,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const e = new Error(
      `GigaChat completion failed: ${res.status} ${res.statusText}${
        text ? ` - ${text}` : ""
      }`
    );
    e.code = "GIGACHAT_COMPLETION_FAILED";
    throw e;
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  return { content: content ?? "", raw: data };
}

