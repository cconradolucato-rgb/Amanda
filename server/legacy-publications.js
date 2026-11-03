'use strict';
// Verified metadata from the original dashboard/report. These are availability dates,
// not ingestion timestamps or calculated legal publication dates.
const caseIds=['2229395-14.2026.8.26.0000','0004587-70.2026.8.26.0320','0004585-03.2026.8.26.0320','1002396-74.2022.8.26.0320','4015625-11.2026.8.26.0320'];
function backfillLegacyPublications(data){
 const id='aasp-original-20261029';if((data.publicationReports||[]).some(r=>r.id===id)||!caseIds.every(id=>data.base.some(b=>b.id===id)))return {data,changed:false};
 return {data:{...data,publicationReports:[...(data.publicationReports||[]),{id,file:'Relatório AASP original',availableOn:'2026-10-29',publicationCount:7,caseIds:[...caseIds]}]},changed:true};
}
module.exports={backfillLegacyPublications};
