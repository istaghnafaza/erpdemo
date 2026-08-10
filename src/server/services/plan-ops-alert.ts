// =============================================================================
// Plan ops alerts — Telegram Bot API (gratis, opsional)
// =============================================================================

import { readEnv } from "@/server/env";

export async function sendPlanOpsTelegram(message: string): Promise<boolean> {
  const token = readEnv("PLAN_OPS_TELEGRAM_BOT_TOKEN");
  const chatId = readEnv("PLAN_OPS_TELEGRAM_CHAT_ID");
  if (!token || !chatId) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message.slice(0, 3900),
        disable_web_page_preview: true,
      }),
    });
    return res.ok;
  } catch (err) {
    console.error("[plan-ops] Telegram send failed:", err);
    return false;
  }
}
