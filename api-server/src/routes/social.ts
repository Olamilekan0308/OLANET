import { Router, type IRouter, type Request, type Response } from "express";
import { ReplitConnectors } from "@replit/connectors-sdk";

const router: IRouter = Router();
const ACCESS_COOKIE = "skillhub_access_token";
type User = { id: string; email?: string | null };

async function readJson<T>(response: { text(): Promise<string> }): Promise<T | null> {
  const text = await response.text();
  try { return text ? JSON.parse(text) as T : null; } catch { return null; }
}
async function supabase(path: string, token: string, init: { method?: string; body?: unknown; headers?: Record<string,string> } = {}) {
  const connectors = new ReplitConnectors();
  return connectors.proxy("supabase", path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers || {}) } });
}
async function auth(req: Request, res: Response): Promise<{ user: User; token: string } | null> {
  const token = req.signedCookies?.[ACCESS_COOKIE] as string | undefined;
  if (!token) { res.status(401).json({ error: "Not authenticated" }); return null; }
  const r = await supabase("/auth/v1/user", token, { method: "GET" });
  const user = await readJson<User>(r);
  if (!r.ok || !user?.id) { res.status(401).json({ error: "Session expired. Please log in again." }); return null; }
  return { user, token };
}
function jsonBody(value: unknown) { return JSON.stringify(value); }

router.get("/groups", async (req,res): Promise<void> => {
  const a = await auth(req,res); if (!a) return;
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const path = `/rest/v1/groups?select=*&${q ? `name=ilike.*${encodeURIComponent(q)}*&` : ""}order=created_at.desc&limit=50`;
  const r = await supabase(path,a.token,{method:"GET"});
  res.status(r.status).json(await readJson<unknown>(r) ?? []);
});

router.post("/groups", async (req,res): Promise<void> => {
  const a = await auth(req,res); if (!a) return;
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name) { res.status(400).json({error:"Group name is required"}); return; }
  const r = await supabase("/rest/v1/groups?select=*",a.token,{method:"POST",body:jsonBody({name,description:req.body?.description ?? null,avatar_url:req.body?.avatar_url ?? null,created_by:a.user.id}),headers:{Prefer:"return=representation"}});
  const data = await readJson<unknown>(r); if (!r.ok) { res.status(r.status).json(data ?? {error:"Could not create group"}); return; }
  const group = Array.isArray(data) ? data[0] : data;
  if (group && typeof (group as {id?:unknown}).id === "number") {
    await supabase("/rest/v1/group_members",a.token,{method:"POST",body:jsonBody({group_id:(group as {id:number}).id,user_id:a.user.id,role:"owner"})});
  }
  res.status(201).json(group);
});

router.get("/groups/:id", async (req,res): Promise<void> => {
  const a=await auth(req,res); if(!a)return;
  const id=encodeURIComponent(req.params.id);
  const r=await supabase(`/rest/v1/groups?id=eq.${id}&select=*`,a.token,{method:"GET"});
  const data=await readJson<unknown>(r); res.status(r.ok ? 200 : r.status).json(Array.isArray(data)?data[0]??null:data);
});
router.post("/groups/:id/join", async(req,res):Promise<void>=>{
  const a=await auth(req,res);if(!a)return;
  const r=await supabase("/rest/v1/group_members",a.token,{method:"POST",body:jsonBody({group_id:Number(req.params.id),user_id:a.user.id,role:"member"}),headers:{Prefer:"return=representation"}});
  res.status(r.ok?201:r.status).json(await readJson<unknown>(r)??{});
});
router.delete("/groups/:id/leave", async(req,res):Promise<void>=>{
  const a=await auth(req,res);if(!a)return;
  const r=await supabase(`/rest/v1/group_members?group_id=eq.${encodeURIComponent(req.params.id)}&user_id=eq.${a.user.id}`,a.token,{method:"DELETE"});
  res.status(r.ok?204:r.status).send();
});

router.get("/groups/:id/messages", async(req,res):Promise<void>=>{
  const a=await auth(req,res);if(!a)return;
  const limit=Math.min(Math.max(Number(req.query.limit)||50,1),100);
  const r=await supabase(`/rest/v1/chat_messages?group_id=eq.${encodeURIComponent(req.params.id)}&select=*&order=created_at.desc&limit=${limit}`,a.token,{method:"GET"});
  const data=await readJson<unknown>(r);res.status(r.status).json(Array.isArray(data)?data.reverse():data??[]);
});
router.post("/groups/:id/messages", async(req,res):Promise<void>=>{
  const a=await auth(req,res);if(!a)return;
  const body=typeof req.body?.body === "string" ? req.body.body.trim() : "";
  if(!body){res.status(400).json({error:"Message is required"});return;}
  const r=await supabase("/rest/v1/chat_messages?select=*",a.token,{method:"POST",body:jsonBody({group_id:Number(req.params.id),sender_id:a.user.id,body,reply_to_id:req.body?.reply_to_id??null}),headers:{Prefer:"return=representation"}});
  res.status(r.ok?201:r.status).json(await readJson<unknown>(r)??{});
});

router.get("/conversations", async(req,res):Promise<void>=>{
  const a=await auth(req,res);if(!a)return;
  const m=await supabase(`/rest/v1/direct_conversation_members?user_id=eq.${a.user.id}&select=conversation_id`,a.token,{method:"GET"});
  const members=await readJson<Array<{conversation_id:number}>>(m)??[]; const ids=members.map(x=>x.conversation_id);
  if(!ids.length){res.json([]);return;}
  const r=await supabase(`/rest/v1/direct_conversations?id=in.(${ids.join(",")})&select=*`,a.token,{method:"GET"});
  res.status(r.status).json(await readJson<unknown>(r)??[]);
});
router.post("/conversations", async(req,res):Promise<void>=>{
  const a=await auth(req,res);if(!a)return;
  const ids=Array.isArray(req.body?.user_ids)?req.body.user_ids.filter((x:unknown)=>typeof x==="string"&&x!==a.user.id):[];
  if(!ids.length){res.status(400).json({error:"At least one other user is required"});return;}
  const c=await supabase("/rest/v1/direct_conversations?select=*",a.token,{method:"POST",body:"{}",headers:{Prefer:"return=representation"}});
  const cd=await readJson<Array<{id:number}>>(c); if(!c.ok||!cd?.[0]){res.status(c.status).json(cd??{error:"Could not create conversation"});return;}
  const members=[a.user.id,...ids].map(user_id=>({conversation_id:cd[0].id,user_id}));
  const mr=await supabase("/rest/v1/direct_conversation_members",a.token,{method:"POST",body:jsonBody(members)});
  if(!mr.ok){res.status(mr.status).json(await readJson<unknown>(mr)??{error:"Could not add conversation members"});return;}
  res.status(201).json(cd[0]);
});
router.get("/conversations/:id/messages", async(req,res):Promise<void>=>{
  const a=await auth(req,res);if(!a)return;
  const r=await supabase(`/rest/v1/chat_messages?conversation_id=eq.${encodeURIComponent(req.params.id)}&select=*&order=created_at.desc&limit=100`,a.token,{method:"GET"});
  const data=await readJson<unknown>(r);res.status(r.status).json(Array.isArray(data)?data.reverse():data??[]);
});
router.post("/conversations/:id/messages", async(req,res):Promise<void>=>{
  const a=await auth(req,res);if(!a)return;
  const body=typeof req.body?.body === "string" ? req.body.body.trim() : "";
  if(!body){res.status(400).json({error:"Message is required"});return;}
  const r=await supabase("/rest/v1/chat_messages?select=*",a.token,{method:"POST",body:jsonBody({conversation_id:Number(req.params.id),sender_id:a.user.id,body,reply_to_id:req.body?.reply_to_id??null}),headers:{Prefer:"return=representation"}});
  res.status(r.ok?201:r.status).json(await readJson<unknown>(r)??{});
});

router.post("/posts/:id/like", async(req,res):Promise<void>=>{
  const a=await auth(req,res);if(!a)return;
  const existing=await supabase(`/rest/v1/post_likes?post_id=eq.${encodeURIComponent(req.params.id)}&user_id=eq.${a.user.id}&select=post_id`,a.token,{method:"GET"});
  const rows=await readJson<unknown[]>(existing)??[];
  if(rows.length){await supabase(`/rest/v1/post_likes?post_id=eq.${encodeURIComponent(req.params.id)}&user_id=eq.${a.user.id}`,a.token,{method:"DELETE"});res.json({liked:false});return;}
  const r=await supabase("/rest/v1/post_likes",a.token,{method:"POST",body:jsonBody({post_id:req.params.id,user_id:a.user.id})});
  res.status(r.ok?201:r.status).json({liked:true});
});
router.get("/posts/:id/interactions", async(req,res):Promise<void>=>{
  const a=await auth(req,res);if(!a)return;
  const [likes,comments,shares]=await Promise.all([
    supabase(`/rest/v1/post_likes?post_id=eq.${encodeURIComponent(req.params.id)}&select=user_id`,a.token,{method:"GET"}),
    supabase(`/rest/v1/post_comments?post_id=eq.${encodeURIComponent(req.params.id)}&select=*&order=created_at.asc`,a.token,{method:"GET"}),
    supabase(`/rest/v1/post_shares?post_id=eq.${encodeURIComponent(req.params.id)}&select=user_id`,a.token,{method:"GET"})
  ]);
  const l=await readJson<Array<{user_id:string}>>(likes)??[]; const c=await readJson<unknown[]>(comments)??[]; const s=await readJson<Array<{user_id:string}>>(shares)??[];
  res.json({likes:l.length,liked:l.some(x=>x.user_id===a.user.id),comments:c,shares:s.length});
});
router.post("/posts/:id/comments", async(req,res):Promise<void>=>{
  const a=await auth(req,res);if(!a)return; const body=typeof req.body?.body==="string"?req.body.body.trim():"";
  if(!body){res.status(400).json({error:"Comment is required"});return;}
  const r=await supabase("/rest/v1/post_comments?select=*",a.token,{method:"POST",body:jsonBody({post_id:req.params.id,user_id:a.user.id,body,parent_id:req.body?.parent_id??null}),headers:{Prefer:"return=representation"}});
  res.status(r.ok?201:r.status).json(await readJson<unknown>(r)??{});
});
router.post("/posts/:id/share", async(req,res):Promise<void>=>{
  const a=await auth(req,res);if(!a)return;
  const r=await supabase("/rest/v1/post_shares?select=*",a.token,{method:"POST",body:jsonBody({post_id:req.params.id,user_id:a.user.id}),headers:{Prefer:"return=representation"}});
  if(r.status===409){res.json({shared:true,duplicate:true});return;} res.status(r.ok?201:r.status).json({shared:r.ok});
});
router.delete("/posts/:postId/comments/:commentId", async(req,res):Promise<void>=>{
  const a=await auth(req,res);if(!a)return;
  const r=await supabase(`/rest/v1/post_comments?id=eq.${encodeURIComponent(req.params.commentId)}&user_id=eq.${a.user.id}`,a.token,{method:"DELETE"});res.status(r.ok?204:r.status).send();
});

export default router;
