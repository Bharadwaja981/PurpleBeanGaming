import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function getOrganizedTournaments() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const { data: memberships } = await supabase.from("tournament_members").select("id,tournament_id").eq("user_id", user.id).eq("status", "active");
  const memberIds = memberships?.map(({ id }) => id) ?? [];
  if (!memberIds.length) redirect("/dashboard");
  const { data: roles } = await supabase.from("tournament_member_roles").select("member_id").in("member_id", memberIds).eq("role", "organizer");
  const organizerIds = new Set(roles?.map(({ member_id }) => member_id));
  const tournamentIds = memberships?.filter(({ id }) => organizerIds.has(id)).map(({ tournament_id }) => tournament_id) ?? [];
  if (!tournamentIds.length) redirect("/dashboard");
  const { data: tournaments } = await supabase.from("tournaments").select("id,name,slug,status").in("id", tournamentIds);
  return tournaments ?? [];
}
