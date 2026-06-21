import { createSupabaseServiceClient } from "@/lib/supabase/server";

const DAILY_LIMIT = 10;
const TOTAL_LIMIT = 100;

export type UserTier = "free" | "paid" | "contributor";

export type RateLimitResult = {
  allowed: boolean;
  tier: UserTier;
  dailyUsed?: number;
  dailyLimit?: number;
  totalUsed?: number;
  totalLimit?: number;
  reason?: string;
};

export async function getUserTier(userId: string): Promise<UserTier> {
  const supabase = createSupabaseServiceClient();
  const { data } = await supabase
    .from("user_profiles")
    .select("tier")
    .eq("user_id", userId)
    .maybeSingle();

  if (data?.tier === "paid" || data?.tier === "contributor") {
    return data.tier as UserTier;
  }
  return "free";
}

export async function checkRateLimit(userId: string): Promise<RateLimitResult> {
  const tier = await getUserTier(userId);

  // No limits for paid/contributor
  if (tier !== "free") {
    return { allowed: true, tier };
  }

  const supabase = createSupabaseServiceClient();

  // Get today's start (UTC)
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const [{ count: dailyCount }, { count: totalCount }] = await Promise.all([
    supabase
      .from("chat_usage")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("used_at", todayStart.toISOString()),
    supabase
      .from("chat_usage")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);

  const dailyUsed = dailyCount ?? 0;
  const totalUsed = totalCount ?? 0;

  if (totalUsed >= TOTAL_LIMIT) {
    return {
      allowed: false,
      tier,
      dailyUsed,
      dailyLimit: DAILY_LIMIT,
      totalUsed,
      totalLimit: TOTAL_LIMIT,
      reason: "Total usage limit reached",
    };
  }

  if (dailyUsed >= DAILY_LIMIT) {
    return {
      allowed: false,
      tier,
      dailyUsed,
      dailyLimit: DAILY_LIMIT,
      totalUsed,
      totalLimit: TOTAL_LIMIT,
      reason: "Daily usage limit reached",
    };
  }

  return {
    allowed: true,
    tier,
    dailyUsed,
    dailyLimit: DAILY_LIMIT,
    totalUsed,
    totalLimit: TOTAL_LIMIT,
  };
}

export async function recordChatUsage(userId: string): Promise<void> {
  const supabase = createSupabaseServiceClient();
  await supabase.from("chat_usage").insert({ user_id: userId });
}

export async function ensureUserProfile(userId: string): Promise<void> {
  const supabase = createSupabaseServiceClient();
  await supabase
    .from("user_profiles")
    .upsert({ user_id: userId, tier: "free" }, { onConflict: "user_id" })
    .select()
    .maybeSingle();
}


const GOAL_LIMIT_FREE = 3;

export type GoalLimitResult = {
  allowed: boolean;
  tier: UserTier;
  activeGoals: number;
  limit: number | null;
  reason?: string;
};

export async function checkGoalLimit(userId: string): Promise<GoalLimitResult> {
  const tier = await getUserTier(userId);

  if (tier !== "free") {
    return { allowed: true, tier, activeGoals: 0, limit: null };
  }

  const supabase = createSupabaseServiceClient();
  const { count, error } = await supabase
    .from("goals")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "active");

  if (error) throw error;

  const activeGoals = count ?? 0;

  if (activeGoals >= GOAL_LIMIT_FREE) {
    return {
      allowed: false,
      tier,
      activeGoals,
      limit: GOAL_LIMIT_FREE,
      reason: `Free plan allows up to ${GOAL_LIMIT_FREE} active goals`,
    };
  }

  return { allowed: true, tier, activeGoals, limit: GOAL_LIMIT_FREE };
}
