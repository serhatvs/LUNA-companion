import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { getCurrentUser } from "./users";

/**
 * Internal — recent messages for a given user (used by the chat action to
 * build context). Lives in an underscore file so it is not exposed to
 * the client. Do not remove.
 */
export const recentForUser = internalQuery({
  args: { userId: v.id("users"), limit: v.optional(v.number()) },
  handler: async (ctx, { userId, limit }) => {
    const q = ctx.db
      .query("messages")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("asc");
    return limit ? q.take(limit) : q.collect();
  },
});

/**
 * Internal — persists Luna's reply after the AI call.
 * Lives in an underscore file so it is not exposed to the client.
 */
export const saveAssistant = internalMutation({
  args: { content: v.string() },
  handler: async (ctx, { content }) => {
    const user = await getCurrentUser(ctx);
    if (user === null) throw new Error("Not authenticated");
    await ctx.db.insert("messages", {
      userId: user._id,
      role: "assistant",
      content,
    });
  },
});
