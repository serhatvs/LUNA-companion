import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./users";

/** Max messages kept per user so the thread stays lightweight. */
const MAX_MESSAGES_PER_USER = 200;

/**
 * The current user's conversation, oldest first.
 * Reactive — the chat UI renders straight from this.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (user === null) return [];
    return ctx.db
      .query("messages")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("asc")
      .collect();
  },
});

/** Append a user message, trimming the oldest when the thread gets too long. */
export const send = mutation({
  args: { content: v.string() },
  handler: async (ctx, { content }) => {
    const user = await getCurrentUser(ctx);
    if (user === null) throw new Error("Not authenticated");
    const trimmed = content.trim();
    if (trimmed.length === 0) return;

    await ctx.db.insert("messages", {
      userId: user._id,
      role: "user",
      content: trimmed.slice(0, 4000),
    });

    const existing = await ctx.db
      .query("messages")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("asc")
      .collect();
    while (existing.length > MAX_MESSAGES_PER_USER) {
      const oldest = existing.shift();
      if (oldest) await ctx.db.delete(oldest._id);
    }
  },
});

/** Wipe the current user's conversation. */
export const clear = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (user === null) throw new Error("Not authenticated");
    const all = await ctx.db
      .query("messages")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    await Promise.all(all.map((m) => ctx.db.delete(m._id)));
  },
});
