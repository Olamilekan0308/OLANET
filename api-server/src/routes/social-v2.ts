import { Router, type IRouter, type Request, type Response } from "express";
import { ReplitConnectors } from "@replit/connectors-sdk";

const router: IRouter = Router();
const ACCESS_COOKIE = "skillhub_access_token";

type User = { id: string; email?: string | null };
async function readJson<T>(response: { text(): Promise<string> }): Promise<T | null> { const text = await response.text(); try { return text ? JSON.parse(text) as T : null; } catch { return null; } }
async function supabase(path: string, token: string, init: { method?: string; body?: unknown; headers?: Record<string,string> } = {}) { const connectors = new ReplitConnectors(); return connectors.proxy("supabase", path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers || {}) } }); }
async function auth(req: Request, res: Response): Promise<{ user: User; token: string } | null> { const token = req.signedCookies?.[ACCESS_COOKIE] as string | undefined; if (!token) { res.status(401).json({ error: "Not authenticated" }); return null; } const r = await supabase("/auth/v1/user", token, { method: "GET" }); const user = await readJson<User>(r); if (!r.ok || !user?.id) { res.status(401).json({ error: "Session expired. Please log in again." }); return null; } return { user, token }; }
const json = (value: unknown) => JSON.stringify(value);

router.get("/feed", async (req,res):Promise<void> => {
  const a=await auth(req,res); if(!a)return;
  const limit=Math.min(Math.max(Number(req.query.limit)||30,1),60);
  const r=await supabase(`/rest/v1/posts?select=*,profiles:user_id(id,full_name,username,avatar_url,bio)&order=created_at.desc&limit=${limit}`,a.token,{method:"GET"});
  const posts=await readJson<any[]>(r)??[];
  if(!r.ok){res.status(r.status).json(posts);return;}
  const ids=posts.map(p=>p.id).filter(Boolean);
  if(!ids.length){res.json([]);return;}
  const [likes,comments,shares]=await Promise.all([
    supabase(`/rest/v1/post_likes?post_id=in.(${ids.join(",")})&select=post_id,user_id`,a.token,{method:"GET"}),
    supabase(`/rest/v1/post_comments?post_id=in.(${ids.join(",")})&select=*&order=created_at.asc`,a.token,{method:"GET"}),
    supabase(`/rest/v1/post_shares?post_id=in.(${ids.join(",")})&select=post_id,user_id`,a.token,{method:"GET"})
  ]);
  const l=await readJson<any[]>(likes)??[], c=await readJson<any[]>(comments)??[], s=await readJson<any[]>(shares)??[];
  const commenterIds=[...new Set(c.map(x=>x.user_id).filter(Boolean))];
  let commentProfiles:any[]=[];
  if(commenterIds.length){const cp=await supabase(`/rest/v1/profiles?id=in.(${commenterIds.map(encodeURIComponent).join(",")})&select=id,full_name,username,avatar_url`,a.token,{method:"GET"});commentProfiles=await readJson<any[]>(cp)??[];}
  const profileById=new Map(commentProfiles.map(p=>[p.id,p]));
  res.json(posts.map(p=>({
    ...p,
    author:p.profiles,
    likes:l.filter(x=>x.post_id===p.id).length,
    liked:l.some(x=>x.post_id===p.id&&x.user_id===a.user.id),
    shares:s.filter(x=>x.post_id===p.id).length,
    comments:c.filter(x=>x.post_id===p.id).map(x=>({...x,author:profileById.get(x.user_id)||null}))
  })));
});

router.post("/feed", async(req,res):Promise<void>=>{
  const a=await auth(req,res);if(!a)return;
  const content=typeof req.body?.content==="string"?req.body.content.trim():"";
  const mediaUrl=typeof req.body?.media_url==="string"?req.body.media_url.trim():null;
  const mediaType=typeof req.body?.media_type==="string"?req.body.media_type.trim():null;
  if(!content&&!mediaUrl){res.status(400).json({error:"Write something before publishing."});return;}
  const r=await supabase("/rest/v1/posts?select=*",a.token,{method:"POST",body:json({user_id:a.user.id,content:content||null,media_url:mediaUrl,media_type:mediaType}),headers:{Prefer:"return=representation"}});
  const data=await readJson<any>(r);res.status(r.ok?201:r.status).json(Array.isArray(data)?data[0]:data??{error:"Could not publish post"});
});

router.get("/friendships", async(req,res):Promise<void>=>{
  const a=await auth(req,res);if(!a)return;
  const r=await supabase(`/rest/v1/friendships?or=(requester_id.eq.${a.user.id},addressee_id.eq.${a.user.id})&select=*`,a.token,{method:"GET"});
  const rows=await readJson<any[]>(r)??[];
  const ids=[...new Set(rows.flatMap(x=>[x.requester_id,x.addressee_id]).filter((id:string)=>id!==a.user.id))];
  let profiles:any[]=[];if(ids.length){const p=await supabase(`/rest/v1/profiles?id=in.(${ids.map(encodeURIComponent).join(",")})&select=id,full_name,username,avatar_url,bio`,a.token,{method:"GET"});profiles=await readJson<any[]>(p)??[];}
  const by=new Map(profiles.map(p=>[p.id,p]));res.status(r.ok?200:r.status).json(rows.map(x=>({...x,other:by.get(x.requester_id===a.user.id?x.addressee_id:x.requester_id)||null})));
});

router.post("/friendships", async(req,res):Promise<void>=>{
  const a=await auth(req,res);if(!a)return;const other=typeof req.body?.user_id==="string"?req.body.user_id:"";if(!other||other===a.user.id){res.status(400).json({error:"Choose another member."});return;}
  const existing=await supabase(`/rest/v1/friendships?or=(and(requester_id.eq.${a.user.id},addressee_id.eq.${other}),and(requester_id.eq.${other},addressee_id.eq.${a.user.id}))&select=*`,a.token,{method:"GET"});const rows=await readJson<any[]>(existing)??[];
  if(rows[0]){res.json(rows[0]);return;}
  const r=await supabase("/rest/v1/friendships?select=*",a.token,{method:"POST",body:json({requester_id:a.user.id,addressee_id:other,status:"pending"}),headers:{Prefer:"return=representation"}});
  const data=await readJson<any>(r);if(r.ok){await supabase("/rest/v1/notifications",a.token,{method:"POST",body:json({user_id:other,actor_id:a.user.id,type:"friend_request",title:"New friend request",body:"You have a new friend request.",entity_id:Array.isArray(data)?data[0]?.id:data?.id}),headers:{Prefer:"return=minimal"}}).catch(()=>undefined);}
  res.status(r.ok?201:r.status).json(Array.isArray(data)?data[0]:data??{error:"Could not send request"});
});

router.patch("/friendships/:id", async(req,res):Promise<void>=>{
  const a=await auth(req,res);if(!a)return;const status=req.body?.status;if(!["accepted","declined","blocked"].includes(status)){res.status(400).json({error:"Invalid friendship status."});return;}
  const r=await supabase(`/rest/v1/friendships?id=eq.${encodeURIComponent(req.params.id)}&addressee_id=eq.${a.user.id}&select=*`,a.token,{method:"PATCH",body:json({status}),headers:{Prefer:"return=representation"}});const data=await readJson<any>(r);res.status(r.ok?200:r.status).json(Array.isArray(data)?data[0]:data??{});
});

router.get("/notifications", async(req,res):Promise<void>=>{const a=await auth(req,res);if(!a)return;const r=await supabase(`/rest/v1/notifications?user_id=eq.${a.user.id}&select=*&order=created_at.desc&limit=50`,a.token,{method:"GET"});res.status(r.status).json(await readJson<any[]>(r)??[]);});
router.patch("/notifications/read", async(req,res):Promise<void>=>{const a=await auth(req,res);if(!a)return;const r=await supabase(`/rest/v1/notifications?user_id=eq.${a.user.id}&read_at=is.null`,a.token,{method:"PATCH",body:json({read_at:new Date().toISOString()})});res.status(r.ok?204:r.status).send();});

router.get("/messages/:userId", async(req,res):Promise<void>=>{const a=await auth(req,res);if(!a)return;const other=encodeURIComponent(req.params.userId);const r=await supabase(`/rest/v1/messages?or=(and(sender_id.eq.${a.user.id},receiver_id.eq.${other}),and(sender_id.eq.${other},receiver_id.eq.${a.user.id}))&select=*&order=created_at.asc&limit=200`,a.token,{method:"GET"});res.status(r.status).json(await readJson<any[]>(r)??[]);});
router.post("/messages/:userId", async(req,res):Promise<void>=>{const a=await auth(req,res);if(!a)return;const content=typeof req.body?.content==="string"?req.body.content.trim():"";if(!content){res.status(400).json({error:"Message cannot be empty."});return;}const r=await supabase("/rest/v1/messages?select=*",a.token,{method:"POST",body:json({sender_id:a.user.id,receiver_id:req.params.userId,content}),headers:{Prefer:"return=representation"}});const data=await readJson<any>(r);if(r.ok){await supabase("/rest/v1/notifications",a.token,{method:"POST",body:json({user_id:req.params.userId,actor_id:a.user.id,type:"message",title:"New message",body:content.slice(0,120)}),headers:{Prefer:"return=minimal"}}).catch(()=>undefined);}res.status(r.ok?201:r.status).json(Array.isArray(data)?data[0]:data??{});});

router.get("/profile/:id", async(req,res):Promise<void>=>{const a=await auth(req,res);if(!a)return;const id=encodeURIComponent(req.params.id);const [p,posts,friend]=await Promise.all([supabase(`/rest/v1/profiles?id=eq.${id}&select=*`,a.token,{method:"GET"}),supabase(`/rest/v1/posts?user_id=eq.${id}&select=*&order=created_at.desc&limit=30`,a.token,{method:"GET"}),supabase(`/rest/v1/friendships?or=(and(requester_id.eq.${a.user.id},addressee_id.eq.${id}),and(requester_id.eq.${id},addressee_id.eq.${a.user.id}))&select=*`,a.token,{method:"GET"})]);res.json({profile:(await readJson<any[]>(p)??[])[0]??null,posts:await readJson<any[]>(posts)??[],friendship:(await readJson<any[]>(friend)??[])[0]??null});});

export default router;
