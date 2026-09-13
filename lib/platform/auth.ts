import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type PlatformRole = "super_admin" | "platform_moderator" | "support_agent";

const getPlatformContext = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/platform-admin");
  const { data: membership } = await supabase.from("platform_admins").select("role,status").eq("user_id", user.id).maybeSingle();
  return { supabase, user, membership };
});

export async function requirePlatformRole(allowed: PlatformRole[]) {
  const { supabase, user, membership } = await getPlatformContext();
  if (!membership || membership.status !== "active" || !allowed.includes(membership.role)) redirect("/dashboard");
  return { supabase, user, role: membership.role };
}

export async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  return { supabase, user };
}
