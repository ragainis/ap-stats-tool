export const tree = [
  { q:"What are you trying to do?", opts:[
    { label:"Estimate a parameter (CI)", next:1 },
    { label:"Test a claim (HT)", next:1 },
    { label:"Check distribution fit", result:"gof" },
  ]},
  { q:"What type of data?", opts:[
    { label:"Categorical (proportions)", next:2 },
    { label:"Quantitative (means)", next:3 },
    { label:"Two categorical variables", result:"chi2" },
    { label:"Relationship between two quantitative (slope)", result:"lrt" },
  ]},
  { q:"How many groups?", opts:[
    { label:"One sample", result:"1pz" },
    { label:"Two independent samples", result:"2pz" },
  ]},
  { q:"How many groups?", opts:[
    { label:"One sample", result:"1t" },
    { label:"Two independent samples", result:"2t" },
    { label:"Matched pairs (natural pairing)", result:"pt" },
  ]},
];
