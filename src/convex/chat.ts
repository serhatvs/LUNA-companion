"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { vly } from "../lib/vly-integrations";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";

const SYSTEM_PROMPT = `You are Nyang, a tiny pixel cat who lives in your teammate's browser and helps them code. You are concise, warm, and practical.

Rules:
- Answer directly. No preamble, no "Sure!" filler.
- When you show code, always use fenced code blocks with a language tag, like \`\`\`ts.
- Keep code minimal and complete enough to run or paste.
- If the user pastes an error, explain the cause in one line first, then give the fix.
- If the user asks something unrelated to coding, gently redirect to the task at hand.
- Stay short: under ~200 words unless the question genuinely needs more.`;

const MODEL = "gpt-4o-mini";
const CONTEXT_WINDOW = 30;

/**
 * Ask Nyang a question. Reads the user's recent conversation for context,
 * calls the lightweight AI gateway, and persists the reply.
 */
export const respond = action({
  args: { message: v.string() },
  handler: async (ctx, { message }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const recent = await ctx.runQuery(internal._messages.recentForUser, {
      userId,
      limit: CONTEXT_WINDOW,
    });

    const history = recent.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [{ role: "system", content: SYSTEM_PROMPT }, ...history];

    // The user's message was just persisted by the send mutation, but make
    // sure it is present even if it fell outside the context window.
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role !== "user") {
      messages.push({ role: "user", content: message });
    }

    const result = await vly.ai.completion({
      model: MODEL,
      messages,
      temperature: 0.6,
      maxTokens: 1200,
    });

    if (!result.success) {
      throw new Error(result.error ?? "Could not reach the model");
    }

    const reply =
      result.data?.choices[0]?.message.content?.trim() ??
      "Hmm, I got nothing back. Try asking again?";

    await ctx.runMutation(internal._messages.saveAssistant, {
      content: reply,
    });

    return reply;
  },
});
