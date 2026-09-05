import { Router, type IRouter, type Request, type Response } from "express";
import { ReplitConnectors } from "@replit/connectors-sdk";

const router: IRouter = Router();
const ACCESS_COOKIE = "skillhub_access_token";
type User = { id: string };
type Profile = { id: string; full_name?: string | null; username?: string | null; avatar_url?: string | null; bio?: string | null; };
type Post = { id: string; user_id: string; content?: string | null; created_at?: string | null; circle_id?: number | null; media_url?: string | null; media_type?: string | null; };
async function readJson<T>(response: { text(): Promise<string> }): Promise<T | null> { const text = await response.text(); try { return text ? JSON.parse(text) as T : null; } catch { return null; } }
async function supabase(path: string, token: string, init: { method?: string; body?: unknown; headers?: Record<string,string> } = {}) { const connectors = new ReplitConnectors(); return connectors.proxy("supabase", path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers || {}) } }); }
async function auth(req: Request, res: Response): Promise<{ user: User; token: string } | null> { const token = req.signedCookies?.[ACCESS_COOKIE] as string | undefined; if (!token) { res.status(401).json({ error: "Not authenticated" }); return null; } const r = await supabase("/auth/v1/user", token, { method: "GET" }); const user = await readJson<User>(r); if (!r.ok || !user?.id) { res.status(401).json({ error: "Session expired. Please log in again." }); return null; } return { user, token }; }
async function interactionCounts(postId:string, token:string, userId:string){
 const [likes,comments,shares]=await Promise.all([
  supabase(`/rest/v1/post_likes?post_id=eq.${encodeURIComponent(postId)}&select=user_id`,token,{method:"GET"}),
  supabase(`/rest/v1/post_comments?post_id=eq.${encodeURIComponent(postId)}&select=id`,token,{method:"GET"}),
  supabase(`/rest/v1/post_shares?post_id=eq.${encodeURIComponent(postId)}&select=user_id`,token,{method:"GET"})
 ]);
 const l=await readJson<Array<{user_id:string}>>(likes)??[];
 const c=await readJson<Array<{id:number}>>(comments)??[];
 const s=await readJson<Array<{user_id:string}>>(shares)??[];
 return {likes:l.length,liked:l.some(x=>x.user_id===userId),comments:c.length,shares:s.length};
}
router.get("/feed", async (req,res):Promise<void=>{
 const a=await auth(req,res);if(!a)return;
 const limit=Math.min(Math.max(Number(req.query.limit)||30,1),50);
 const postsResponse=await supabase(`/rest/v1/posts?select=*&order=created_at.desc&limit=${limit}`,a.token,{method:"GET"});
 const posts=await readJson<Post[]>(postsResponse)??[];
 if(!postsResponse.ok){res.status(postsResponse.status).json(posts);return;}
 if(!posts.length){res.json({posts:[]});return;}
 const ids=[...new Set(posts.map(p=>p.user_id).filter(Boolean))];
 const profilesResponse=await supabase(`/rest/v1/profiles?id=in.(${ids.map(encodeURIComponent).join(",")})&select=id,full_name,username,avatar_url,bio`,a.token,{method:"GET"});
 const profiles=await readJson<Profile[]>(profilesResponse)??[];const byUser=new Map(profiles.map(p=>[p.id,p]));
 const enriched=await Promise.all(posts.map(async post=>({...post,author:byUser.get(post.user_id)??{id:post.user_id,full_name:"OLANET member"},...(await interactionCounts(post.id,a.token,a.user.id))})));
 res.json({posts:enriched});
});
router.post("/feed", async(req,res):Promise<void=>{
 const a=await auth(req,res);if(!a)return;
 const content=typeof req.body?.content==="string"?req.body.content.trim():"";
 const mediaUrl=typeof req.body?.media_url==="string"?req.body.media_url.trim():"";
 if(!content&&!mediaUrl){res.status(400).json({error:"Post content or an image is required."});return;}
 if(content.length>5000){res.status(400).json({error:"Post is too long."});return;}
 if(mediaUrl && mediaUrl.length>2200000){res.status(413).json({error:"Image is too large. Please choose a smaller image."});return;}
 if(mediaUrl && !/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(mediaUrl)){res.status(400).json({error:"Unsupported image format."});return;}
 const payload={user_id:a.user.id,content,circle_id:typeof req.body?.circle_id==="number"?req.body.circle_id:null,media_url:mediaUrl||null,media_type:mediaUrl?"image":null};
 const created=await supabase("/rest/v1/posts?select=*",a.token,{method:"POST",body:JSON.stringify(payload),headers:{Prefer:"return=representation"}});
 const data=await readJson<unknown>(created);if(!created.ok){res.status(created.status).json(data??{error:"Could not create post."});return;}
 res.status(201).json(Array.isArray(data)?data[0]:data);
});
export default router;
