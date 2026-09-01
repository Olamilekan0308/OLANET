import { Router, type IRouter, type Request, type Response } from "express";
import { ReplitConnectors } from "@replit/connectors-sdk";

const router: IRouter = Router();
const ACCESS_COOKIE = "skillhub_access_token";
type User = { id: string };
async function readJson<T>(response: { text(): Promise<string> }): Promise<T | null> { const text = await response.text(); try { return text ? JSON.parse(text) as T : null; } catch { return null; } }
async function supabase(path: string, accessToken: string, init: { method?: string; body?: unknown; headers?: Record<string,string> } = {}) { const connectors = new ReplitConnectors(); return connectors.proxy("supabase", path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}`, ...(init.headers || {}) } }); }
async function auth(req: Request, res: Response): Promise<{user:User; token:string}|null> { const token=req.signedCookies?.[ACCESS_COOKIE] as string|undefined; if(!token){res.status(401).json({error:"Not authenticated"});return null;} const r=await supabase("/auth/v1/user",token,{method:"GET"}); const user=await readJson<User>(r); if(!r.ok||!user?.id){res.status(401).json({error:"Session expired. Please log in again."});return null;} return {user,token}; }

router.get("/circles", async (req,res):Promise<void>=>{
  try {
    const session=await auth(req,res); if(!session)return;
    const r=await supabase("/rest/v1/circles?select=id,name,description,icon_url,created_by,created_at&order=id",session.token,{method:"GET"});
    const circles=await readJson<Array<Record<string,unknown>>>(r); if(!r.ok||!circles){res.status(502).json({error:"Unable to load Circles."});return;}
    const countsResponse=await supabase("/rest/v1/rpc/get_circle_member_counts",session.token,{method:"POST",body:"{}"});
    const counts=await readJson<Array<{circle_id:number;member_count:number}>>(countsResponse) || [];
    const countMap=new Map(counts.map(item=>[Number(item.circle_id),Number(item.member_count)]));
    const result=[];
    for(const circle of circles){
      const id=Number(circle.id);
      const membershipResponse=await supabase(`/rest/v1/circle_members?select=user_id&circle_id=eq.${id}&user_id=eq.${encodeURIComponent(session.user.id)}&limit=1`,session.token,{method:"GET"});
      const membership=await readJson<Array<{user_id:string}>>(membershipResponse) || [];
      result.push({...circle,memberCount:countMap.get(id)||0,isMember:membership.length>0});
    }
    res.json({circles:result});
  }catch(error){req.log.error({error},"Circle list failed");res.status(502).json({error:"Unable to load Circles."});}
});

router.post("/circles/:id/join", async(req,res):Promise<void>=>{
  try{const session=await auth(req,res);if(!session)return;const id=Number(req.params.id);if(!Number.isInteger(id)||id<=0){res.status(400).json({error:"Invalid Circle."});return;}const r=await supabase("/rest/v1/circle_members",session.token,{method:"POST",headers:{Prefer:"resolution=ignore-duplicates,return=minimal"},body:JSON.stringify({circle_id:id,user_id:session.user.id,role:"member"})});if(!r.ok&&r.status!==409){res.status(400).json({error:"Unable to join this Circle."});return;}res.json({joined:true});}catch(error){req.log.error({error},"Circle join failed");res.status(502).json({error:"Unable to join this Circle."});}}
);

router.delete("/circles/:id/join", async(req,res):Promise<void>=>{
  try{const session=await auth(req,res);if(!session)return;const id=Number(req.params.id);if(!Number.isInteger(id)||id<=0){res.status(400).json({error:"Invalid Circle."});return;}const r=await supabase(`/rest/v1/circle_members?circle_id=eq.${id}&user_id=eq.${encodeURIComponent(session.user.id)}`,session.token,{method:"DELETE"});if(!r.ok&&r.status!==404){res.status(400).json({error:"Unable to leave this Circle."});return;}res.json({joined:false});}catch(error){req.log.error({error},"Circle leave failed");res.status(502).json({error:"Unable to leave this Circle."});}}
);

export default router;
