import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { SocialHub } from '@/components/social-hub';

export type AuthUser = { id: string; email?: string | null; user_metadata?: Record<string, unknown> | null; profile?: { id?: string; full_name?: string | null; username?: string | null; avatar_url?: string | null; bio?: string | null; department?: string | null; course?: string | null; } | null; };
export type ProfileUpdateInput = { username?: string | null; full_name?: string | null; bio?: string | null; avatar_url?: string | null; department?: string | null; course?: string | null; };
type ProfileResponse = { profile?: AuthUser['profile']; error?: string };
type AuthResponse = { user?: AuthUser; error?: string; needsEmailConfirmation?: boolean; verified?: boolean; profileCreated?: boolean; profileError?: { status: number; code?: string; message: string; details?: string; hint?: string } | null };
type AuthContextValue = { status: 'loading'|'authenticated'|'unauthenticated'; user: AuthUser|null; login:(email:string,password:string)=>Promise<AuthResponse>; signup:(fullName:string,email:string,password:string)=>Promise<AuthResponse>; verifyEmail:(email:string,token:string)=>Promise<AuthResponse>; resendEmailCode:(email:string)=>Promise<void>; logout:()=>Promise<void>; updateProfile:(updates:ProfileUpdateInput)=>Promise<NonNullable<AuthUser['profile']>>; uploadAvatar:(file:File)=>Promise<NonNullable<AuthUser['profile']>> };
const AuthContext=createContext<AuthContextValue|null>(null);
async function request(path:string,init?:RequestInit){const response=await fetch(`/api/auth/${path}`,{...init,credentials:'include',headers:{'Content-Type':'application/json',...init?.headers}});const data=(await response.json().catch(()=>({}))) as AuthResponse;if(!response.ok)throw new Error(data.error??'Something went wrong. Please try again.');return data;}
async function profileRequest(path:string,init?:RequestInit){const isBinary=init?.body instanceof Blob||init?.body instanceof ArrayBuffer;const response=await fetch(`/api/profile/${path}`,{...init,credentials:'include',headers:{...(isBinary?{}:{'Content-Type':'application/json'}),...init?.headers}});const data=(await response.json().catch(()=>({}))) as ProfileResponse;if(!response.ok)throw new Error(data.error??'Unable to update your profile.');if(!data.profile)throw new Error('Supabase returned no profile after saving.');return data.profile;}
export function AuthProvider({children}:{children:ReactNode}){
 const [status,setStatus]=useState<AuthContextValue['status']>('loading'); const [user,setUser]=useState<AuthUser|null>(null);
 useEffect(()=>{let active=true;request('session').then(data=>{if(!active)return;setUser(data.user??null);setStatus(data.user?'authenticated':'unauthenticated')}).catch(()=>{if(!active)return;setUser(null);setStatus('unauthenticated')});return()=>{active=false}},[]);
 const value=useMemo<AuthContextValue>(()=>({status,user,
  async login(email,password){const data=await request('login',{method:'POST',body:JSON.stringify({email,password})});setUser(data.user??null);setStatus('authenticated');return data;},
  async signup(fullName,email,password){const data=await request('signup',{method:'POST',body:JSON.stringify({fullName,email,password})});if(data.user&&!data.needsEmailConfirmation&&!data.profileError){setUser(data.user);setStatus('authenticated')}return data;},
  async verifyEmail(email,token){const data=await request('verify-email',{method:'POST',body:JSON.stringify({email,token})});if(data.user){setUser(data.user);setStatus('authenticated')}return data;},
  async resendEmailCode(email){await request('resend-email',{method:'POST',body:JSON.stringify({email}))},
  async logout(){await request('logout',{method:'POST'}).catch(()=>undefined);setUser(null);setStatus('unauthenticated');},
  async updateProfile(updates){const profile=await profileRequest('me',{method:'PUT',body:JSON.stringify(updates)});setUser(current=>current?{...current,profile}:current);return profile;},
  async uploadAvatar(file){const profile=await profileRequest('avatar',{method:'POST',headers:{'Content-Type':file.type},body:file});setUser(current=>current?{...current,profile}:current);return profile;}
 }),[status,user]);
 return <AuthContext.Provider value={value}>{children}{status==='authenticated'&&<SocialHub/>}</AuthContext.Provider>;
}
export function useAuth(){const context=useContext(AuthContext);if(!context)throw new Error('useAuth must be used within AuthProvider');return context;}
