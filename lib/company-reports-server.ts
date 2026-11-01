import "server-only";
import {createClient} from "./supabase/server";
import {EMPTY_LIBRARY,type CampaignLibrary} from "./campaign-library";
import {validCampaignLibrary} from "./campaign-library-validation";
export async function getPublishedCompanyReports(companyId:string):Promise<CampaignLibrary>{
 const db=await createClient();
 const {data,error}=await db.from("company_report_publications").select("library").eq("company_id",companyId).eq("active",true).order("published_at",{ascending:false}).limit(1).maybeSingle();
 return !error&&validCampaignLibrary(data?.library)?data!.library:EMPTY_LIBRARY;
}
