import {describe,expect,it} from "vitest";
import {availableTeamMmr,isPlayerPoolReady} from "@/lib/tournament/readiness";

describe("pre-draft calculations",()=>{
  it("deducts captain MMR from the team target",()=>expect(availableTeamMmr(12000,2600)).toBe(9400));
  it("does not present a negative remaining allowance",()=>expect(availableTeamMmr(2000,2600)).toBe(0));
  it("requires players, finalized ratings, appeals, teams, and confirmations",()=>{
    const ready={eligiblePlayers:10,teamCount:2,teamSize:5,unresolvedAppeals:0,assignedCaptains:2,confirmedCaptains:2,finalizedRatings:10};
    expect(isPlayerPoolReady(ready)).toBe(true);
    expect(isPlayerPoolReady({...ready,unresolvedAppeals:1})).toBe(false);
    expect(isPlayerPoolReady({...ready,confirmedCaptains:1})).toBe(false);
    expect(isPlayerPoolReady({...ready,eligiblePlayers:9})).toBe(false);
  });
});
