import { Router, type IRouter, type Request, type Response } from "express";
import { ReplitConnectors } from "@replit/connectors-sdk";

const router: IRouter = Router();
const ACCESS_COOKIE = "skillhub_access_token";

type User = { id: string };
async function readJson<T>(response: { text(): Promise<string> }): Promise<T | null> { const text = await response.text(); try { return text ? JSON.parse(text) as T : null; } catch { return null; } }
async function supabase(path: string, token: string, init: { method?: string; body?: unknown; headers?: Record<string,string> } = {}) { const connectors = new ReplitConnectors(); return connectors.proxy("supabase", path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers || {}) } }); }
async function auth(req: Request, res: Response): Promise<{user:User;token:string}|null> { const token=req.signedCookies?.[ACCESS_COOKIE] as string|undefined; if(!token){res.status(401).json({error:"Not authenticated"});return null;} const r=await supabase("/auth/v1/user",token,{method:"GET"}); const user=await readJson<User>(r); if(!r.ok||!user?.id){res.status(401).json({error:"Session expired. Please log in again."});return null;} return {user,token}; }

async function isMember(circleId:number,userId:string,token:string){
  const r=await supabase(`/rest/v1/circle_members?circle_id=eq.${circleId}&user_id=eq.${encodeURIComponent(userId)}&select=user_id&limit=1`,token,{method:"GET"});
  const rows=await readJson<Array<{user_id:string}>>(r) || [];
  return r.ok && rows.length>0;
}

router.get("/circles/:id/posts", async (req,res):Promise<void>=>{
  const a=await auth(req,res); if(!a)return;
  const id=Number(req.params.id); if(!Number.isInteger(id)||id<=0){res.status(400).json({error:"Invalid Circle."});return;}
  const r=await supabase(`/rest/v1/posts?circle_id=eq.${id}&select=*&order=created_at.desc&limit=50`,a.token,{method:"GET"});
  const posts=await readJson<unknown>(r); res.status(r.status).json(posts ?? []);
});

router.post("/circles/:id/posts", async (req,res):Promise<void>=>{
  const a=await auth(req,res); if(!a)return;
  const id=Number(req.params.id); if(!Number.isInteger(id)||id<=0){res.status(400).json({error:"Invalid Circle."});return;}
  if(!(await isMember(id,a.user.id,a.token))){res.status(403).json({error:"Join this department before posting."});return;}
  const content=typeof req.body?.content === "string" ? req.body.content.trim() : "";
  if(!content){res.status(400).json({error:"Post content is required."});return;}
  const payload={circle_id:id,user_id:a.user.id,content};
  const r=await supabase("/rest/v1/posts?select=*",a.token,{method:"POST",body:JSON.stringify(payload),headers:{Prefer:"return=representation"}});
  const data=await readJson<unknown>(r); res.status(r.ok?201:r.status).json(data ?? {error:"Unable to create department post."});
});

export default router;
