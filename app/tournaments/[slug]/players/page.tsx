import {notFound} from "next/navigation";
import {AppShell} from "@/components/layout/app-shell";
import {Card} from "@/components/ui/card";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {createClient} from "@/lib/supabase/server";
import {submitRatingReview} from "../actions";

export default async function PlayersPage({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;
  const supabase=await createClient();
  const {data:tournament}=await supabase.from("public_tournament_summary").select("id,name").eq("slug",slug).single();
  if(!tournament?.id)notFound();
  const [{data:players},{data:{user}}]=await Promise.all([
    supabase.from("public_player_pool").select("*").eq("tournament_id",tournament.id).order("tournament_mmr",{ascending:false}),
    supabase.auth.getUser(),
  ]);
  let isCaptain=false,isOrganizer=false;
  if(user){
    const {data:member}=await supabase.from("tournament_members").select("id").eq("tournament_id",tournament.id).eq("user_id",user.id).maybeSingle();
    if(member){
      const {data:roles}=await supabase.from("tournament_member_roles").select("role").eq("member_id",member.id).in("role",["captain","organizer"]);isCaptain=Boolean(roles?.some(x=>x.role==="captain"));isOrganizer=Boolean(roles?.some(x=>x.role==="organizer"));
    }
  }
  const{data:dotaEvidence}=isOrganizer?await supabase.from("organizer_dota_verification").select("*").eq("tournament_id",tournament.id):{data:[]};const evidence=new Map((dotaEvidence??[]).map(x=>[x.tournament_player_id,x]));
  return <AppShell slug={slug}>
    <h1 className="text-3xl font-bold">Player Pool</h1>
    <p className="muted mt-2">Eligible, reviewed players available for the draft.</p>
    <Card className="mt-6 overflow-x-auto p-0"><table className="w-full text-left text-sm">
      <thead className="border-b border-[var(--line)] text-xs uppercase text-[var(--muted)]"><tr>{["Player","Tournament MMR","Roles","Region","Status",...(isOrganizer?["Dota evidence"]:[]),...(isCaptain?["Private review"]:[])].map(label=><th className="px-5 py-4" key={label}>{label}</th>)}</tr></thead>
      <tbody>{players?.map(player=><tr key={player.id} className="border-b border-[var(--line)] last:border-0">
        <td className="px-5 py-4 font-semibold">{player.ign}</td><td className="px-5 py-4 text-[var(--amber)]">{player.tournament_mmr}</td><td className="px-5 py-4 muted">{player.primary_role}{player.secondary_role?` / ${player.secondary_role}`:""}</td><td className="px-5 py-4 muted">{player.region}</td><td className="px-5 py-4"><Badge tone={player.is_drafted?"warning":"success"}>{player.is_drafted?"Drafted":"Eligible"}</Badge></td>
        {isOrganizer?<td className="px-5 py-4 text-xs">{evidence.get(player.id??"")?<><strong className="uppercase">{evidence.get(player.id!)!.verification_status?.replaceAll("_"," ")??"unverified"}</strong><p className="muted">Dota {evidence.get(player.id!)!.dota_account_id??"not linked"} · {evidence.get(player.id!)!.profile_visibility??"unavailable"} · rank {evidence.get(player.id!)!.rank_tier??"—"}</p><p className="muted">{evidence.get(player.id!)!.provider??"No provider snapshot"}</p></>:<span className="muted">No linked Dota account</span>}</td>:null}
        {isCaptain?<td className="px-5 py-4"><form action={submitRatingReview} className="flex gap-2"><input type="hidden" name="playerId" value={player.id??""}/><input type="hidden" name="slug" value={slug}/><select name="assessment" aria-label={`Private review for ${player.ign}`} className="rounded border border-[var(--line)] bg-[#081016] px-2"><option value="unknown">Unknown</option><option value="much_weaker">Much weaker</option><option value="slightly_weaker">Slightly weaker</option><option value="accurate">Accurate</option><option value="slightly_stronger">Slightly stronger</option><option value="much_stronger">Much stronger</option></select><Button variant="secondary">Save</Button></form></td>:null}
      </tr>)}</tbody>
    </table></Card>
  </AppShell>;
}
