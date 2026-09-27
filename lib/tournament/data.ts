import {notFound,redirect} from "next/navigation";import {createClient} from "@/lib/supabase/server";
export async function getTournament(slug:string){const supabase=await createClient();const {data}=await supabase.from("tournaments").select("*").eq("slug",slug).single();if(!data)notFound();return {supabase,tournament:data};}
export async function requireUser(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/sign-in");return {supabase,user};}
