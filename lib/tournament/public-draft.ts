import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type PublicDraftPackage = {
  tournament:{id:string;name:string;slug:string;season:string|null;status:string;team_size:number;mmr_target:number|null;mmr_min:number|null;mmr_max:number|null;spectator_delay_seconds:number};
  auction:null|{id:string;sequence_number:number;status:string;opening_bid:number;current_bid:number|null;started_at:string|null;closes_at:string|null;closed_at:string|null;ign:string;primary_role:string|null;secondary_role:string|null;tournament_mmr:number;leading_team:string|null};
  teams:Array<{id:string;team_slug:string;team_name:string;short_tag:string;logo_url:string|null;accent_color:string|null;current_team_mmr:number;credits_remaining:number;player_count:number;captain_slug:string;captain_name:string;captain_mmr:number}>;
  rosters:Array<{team_id:string;player_slug:string;ign:string;primary_role:string|null;secondary_role:string|null;tournament_mmr_at_draft:number;purchase_price:number|null}>;
  history:Array<{id:string;sequence_number:number;status:string;ign:string;nominating_team:string;winning_team:string|null;winning_bid:number|null;started_at:string|null;closed_at:string|null;duration_seconds:number|null;bid_count:number;bidding_teams:number}>;
  events:Array<{event_id:string;event_at:string;event_type:string;sequence_number:number;player_id:string;team_id:string|null;amount:number|null}>;
  snapshot:Record<string,unknown>|null;
  player_analytics:Array<{player_slug:string;ign:string;team_id:string;primary_role:string|null;tournament_mmr_at_draft:number;purchase_price:number;credits_per_1000_mmr:number;bid_count:number;unique_bidding_teams:number;wall_clock_duration_seconds:number;active_bidding_duration_seconds:number;anti_snipe_extension_count:number;nomination_round:number;draft_phase:"normal"|"unsold";expected_price:number;price_delta:number;price_ratio:number;price_indicator:string;price_rank:number;mmr_rank:number;auction_sequence:number}>;
  team_analytics:Array<{team_slug:string;team_name:string;team_tag:string;captain_slug:string;captain_name:string;captain_mmr:number;final_team_mmr:number;starting_credits:number;credits_remaining:number;recruit_count:number;credits_spent:number;average_purchase:number;highest_purchase:number;lowest_purchase:number;drafted_mmr:number;credits_per_1000_mmr:number;contested_wins:number;uncontested_wins:number;unsold_round_acquisitions:number;normal_round_spend:number;unsold_round_spend:number}>;
  nomination_order:Array<{id:string;round_number:number;position:number;team_name:string;status:string}>;
  recent_bids:Array<{id:string;team_name:string;amount:number;received_at:string;sequence_number:number}>;
  draft_health:{valid:boolean;code:string;message:string};
  spend_progression:Array<{team_slug:string;team_name:string;auction_sequence:number;player:string;purchase_price:number;credits_before:number;credits_after:number;cumulative_spent:number;remaining_roster_slots:number;team_mmr_after:number;draft_phase:string;nomination_round:number}>;
};

export async function getPublicDraft(slug:string){
  const supabase=await createClient();
  const {data,error}=await supabase.rpc("get_public_draft_package",{p_slug:slug});
  if(error||!data)notFound();
  return data as unknown as PublicDraftPackage;
}
