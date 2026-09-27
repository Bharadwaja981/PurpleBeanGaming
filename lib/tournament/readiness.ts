export function availableTeamMmr(target:number|null,captainMmr:number){return target===null?null:Math.max(0,target-captainMmr)}

export type ReadinessInput={
  eligiblePlayers:number;
  teamCount:number;
  teamSize:number;
  unresolvedAppeals:number;
  assignedCaptains:number;
  confirmedCaptains:number;
  finalizedRatings:number;
};

export function isPlayerPoolReady(input:ReadinessInput){
  const required=input.teamCount*input.teamSize;
  return input.teamCount>0&&input.eligiblePlayers>=required&&input.finalizedRatings>=input.eligiblePlayers&&input.unresolvedAppeals===0&&input.assignedCaptains===input.teamCount&&input.confirmedCaptains===input.teamCount;
}
