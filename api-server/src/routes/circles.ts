import { Router, type IRouter, type Request, type Response } from "express";
import { ReplitConnectors } from "@replit/connectors-sdk";

const router: IRouter = Router();
const ACCESS_COOKIE = "skillhub_access_token";
type User = { id: string };
async function readJson<T>(response: { text(): Promise<string> }): Promise<T | null> { const text = await response.text(); try { return text ? JSON.parse(text) as T : null; } catch { return null; } }
async function supabase(path: string, accessToken: string, init: { method?: string; body?: unknown; headers?: Record<string,string> } = {}) { const connectors = new ReplitConnectors(); return connectors.proxy("supabase", path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}`, ...(init.headers || {}) } }); }
async function auth(req: Request, res: Response): Promise<{user:User; token:string}|null> { const token=req.signedCookies?.[ACCESS_COOKIE] as string|undefined; if(!token){res.status(401).json({error:"Not authenticated"});return null;} const r=await supabase("/auth/v1/user",token,{method:"GET"}); const user=await readJson<User>(r); if(!r.ok||!user?.id){res.status(401).json({error:"Session expired. Please log in again."});return null;} return {user,token}; }

const calculatorCatalog: Record<string, Array<{id:string;name:string;description:string}>> = {
  "electrical": [
    { id:"ohms-law", name:"Ohm's Law", description:"Calculate voltage, current, resistance or power." },
    { id:"power", name:"Electrical Power", description:"Calculate AC/DC power from voltage, current and power factor." },
    { id:"voltage-drop", name:"Voltage Drop", description:"Estimate conductor voltage drop for practical installations." },
    { id:"wire-size", name:"Wire Size", description:"Select a practical conductor size from load and installation inputs." },
    { id:"lighting", name:"Lighting Load", description:"Estimate lighting load and circuit requirements." },
    { id:"energy", name:"Energy Consumption", description:"Estimate energy use and running cost." },
  ],
  "civil": [
    { id:"concrete-volume", name:"Concrete Volume", description:"Estimate concrete quantity for common structural shapes." },
    { id:"rebar", name:"Rebar Estimate", description:"Estimate reinforcement quantity from basic project inputs." },
    { id:"area", name:"Area Calculator", description:"Calculate areas for common site and structural shapes." },
  ],
  "mechanical": [
    { id:"torque", name:"Torque", description:"Calculate torque from force and lever arm." },
    { id:"power-torque", name:"Motor Power", description:"Estimate shaft power from torque and speed." },
    { id:"rpm", name:"RPM Converter", description:"Convert rotational speed and related values." },
  ],
  "computer-science": [
    { id:"binary", name:"Binary Converter", description:"Convert decimal, binary, hexadecimal and octal values." },
    { id:"storage", name:"Storage Converter", description:"Convert common digital storage units." },
  ],
  "phone-repair": [
    { id:"battery-runtime", name:"Battery Runtime", description:"Estimate device runtime from battery capacity and load." },
    { id:"resistor", name:"Resistor Code", description:"Decode common resistor colour bands." },
  ],
  "fashion": [
    { id:"fabric", name:"Fabric Estimate", description:"Estimate fabric quantity from garment dimensions." },
  ],
  "carpentry": [
    { id:"board-foot", name:"Board Feet", description:"Calculate lumber volume in board feet." },
  ],
  "agriculture": [
    { id:"plant-spacing", name:"Plant Spacing", description:"Estimate plant population from field dimensions and spacing." },
    { id:"yield", name:"Yield Estimate", description:"Estimate crop yield from area and expected productivity." },
  ],
  "catering": [
    { id:"portion", name:"Portion Calculator", description:"Scale ingredient quantities for a target number of servings." },
    { id:"food-cost", name:"Food Cost", description:"Estimate recipe cost and cost per serving." },
  ],
};

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

router.get("/circles/:id", async(req,res):Promise<void>=>{
  try {
    const session=await auth(req,res); if(!session)return;
    const id=Number(req.params.id); if(!Number.isInteger(id)||id<=0){res.status(400).json({error:"Invalid Circle."});return;}
    const r=await supabase(`/rest/v1/circles?id=eq.${id}&select=id,name,description,icon_url,created_by,created_at&limit=1`,session.token,{method:"GET"});
    const rows=await readJson<Array<Record<string,unknown>>>(r) || [];
    if(!r.ok){res.status(r.status).json({error:"Unable to load Circle."});return;}
    if(!rows.length){res.status(404).json({error:"Circle not found."});return;}
    const membershipResponse=await supabase(`/rest/v1/circle_members?select=user_id,role,created_at&circle_id=eq.${id}&user_id=eq.${encodeURIComponent(session.user.id)}&limit=1`,session.token,{method:"GET"});
    const membership=await readJson<Array<Record<string,unknown>>>(membershipResponse) || [];
    const countResponse=await supabase(`/rest/v1/circle_members?select=user_id&circle_id=eq.${id}`,session.token,{method:"GET"});
    const members=await readJson<Array<{user_id:string}>>(countResponse) || [];
    res.json({...rows[0],memberCount:members.length,isMember:membership.length>0,role:membership[0]?.role ?? null});
  } catch(error){req.log.error({error},"Circle detail failed");res.status(502).json({error:"Unable to load Circle."});}
});

router.get("/circles/:id/members", async(req,res):Promise<void>=>{
  try {
    const session=await auth(req,res); if(!session)return;
    const id=Number(req.params.id); if(!Number.isInteger(id)||id<=0){res.status(400).json({error:"Invalid Circle."});return;}
    const membership=await supabase(`/rest/v1/circle_members?select=user_id,role,created_at&circle_id=eq.${id}&order=created_at.asc&limit=200`,session.token,{method:"GET"});
    const rows=await readJson<Array<{user_id:string;role?:string;created_at?:string}>>(membership) || [];
    if(!membership.ok){res.status(membership.status).json({error:"Unable to load Circle members."});return;}
    if(!rows.length){res.json({members:[]});return;}
    const ids=rows.map(row=>row.user_id).join(",");
    const profiles=await supabase(`/rest/v1/profiles?id=in.(${ids})&select=id,full_name,username,avatar_url,bio`,session.token,{method:"GET"});
    const profileRows=await readJson<Array<Record<string,unknown>>>(profiles) || [];
    const profileMap=new Map(profileRows.map(profile=>[String(profile.id),profile]));
    res.json({members:rows.map(row=>({...profileMap.get(row.user_id),role:row.role ?? "member",joined_at:row.created_at ?? null}))});
  } catch(error){req.log.error({error},"Circle members failed");res.status(502).json({error:"Unable to load Circle members."});}
});

router.get("/circles/:id/calculators", async(req,res):Promise<void>=>{
  try {
    const session=await auth(req,res); if(!session)return;
    const id=Number(req.params.id); if(!Number.isInteger(id)||id<=0){res.status(400).json({error:"Invalid Circle."});return;}
    const r=await supabase(`/rest/v1/circles?id=eq.${id}&select=id,name&limit=1`,session.token,{method:"GET"});
    const rows=await readJson<Array<{id:number;name:string}>>(r) || [];
    if(!r.ok){res.status(r.status).json({error:"Unable to load Circle."});return;}
    if(!rows.length){res.status(404).json({error:"Circle not found."});return;}
    const slug=rows[0].name.toLowerCase().replace(/&/g,"and").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
    res.json({circle_id:rows[0].id,circle_name:rows[0].name,calculators:calculatorCatalog[slug] ?? []});
  } catch(error){req.log.error({error},"Circle calculators failed");res.status(502).json({error:"Unable to load Circle calculators."});}
});

router.post("/circles/:id/join", async(req,res):Promise<void=>{
  try{const session=await auth(req,res);if(!session)return;const id=Number(req.params.id);if(!Number.isInteger(id)||id<=0){res.status(400).json({error:"Invalid Circle."});return;}const r=await supabase("/rest/v1/circle_members",session.token,{method:"POST",headers:{Prefer:"resolution=ignore-duplicates,return=minimal"},body:JSON.stringify({circle_id:id,user_id:session.user.id,role:"member"})});if(!r.ok&&r.status!==409){res.status(400).json({error:"Unable to join this Circle."});return;}res.json({joined:true});}catch(error){req.log.error({error},"Circle join failed");res.status(502).json({error:"Unable to join this Circle."});}}
);

router.delete("/circles/:id/join", async(req,res):Promise<void=>{
  try{const session=await auth(req,res);if(!session)return;const id=Number(req.params.id);if(!Number.isInteger(id)||id<=0){res.status(400).json({error:"Invalid Circle."});return;}const r=await supabase(`/rest/v1/circle_members?circle_id=eq.${id}&user_id=eq.${encodeURIComponent(session.user.id)}`,session.token,{method:"DELETE"});if(!r.ok&&r.status!==404){res.status(400).json({error:"Unable to leave this Circle."});return;}res.json({joined:false});}catch(error){req.log.error({error},"Circle leave failed");res.status(502).json({error:"Unable to leave this Circle."});}}
);

export default router;
