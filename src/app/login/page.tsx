"use client";

import { useState } from "react";
import { Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const signIn = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/auth/confirm` } });
      if (error) throw error;
      setSent(true);
    } finally {
      setLoading(false);
    }
  };
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-[#eef2f0] px-4"><div className="w-full max-w-sm rounded-[6px] border border-[#d5ddda] bg-white p-6 shadow-lg"><div className="flex h-10 w-10 items-center justify-center rounded-[5px] bg-[#18231f] text-white"><ShieldCheck className="h-5 w-5" /></div><h1 className="mt-5 text-xl font-semibold">Sign in to Kimsy</h1><p className="mt-1 text-sm leading-6 text-[#697671]">Invite-only access to your organization&apos;s compliance risk workspace.</p>{sent ? <div className="mt-5 rounded-[5px] border border-[#b9decf] bg-[#eaf7f1] px-4 py-3 text-sm text-[#176b4b]">Check your email for a secure sign-in link.</div> : <><label className="mt-5 block"><span className="text-xs font-semibold">Work email</span><div className="relative mt-2"><Mail className="absolute left-3 top-3 h-4 w-4 text-[#75817c]" /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-10 w-full rounded-[5px] border border-[#cfd7d3] pl-10 pr-3 text-sm" placeholder="name@company.com" /></div></label><Button className="mt-4 w-full" onClick={signIn} loading={loading} disabled={!email.includes("@")}>Email secure link</Button></>}</div></div>;
}
