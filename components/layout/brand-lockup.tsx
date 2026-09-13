import Image from "next/image";
import Link from "next/link";
import { brand } from "@/lib/config";
import { cn } from "@/lib/utils";

export function BrandLockup({compact=false,className}:{compact?:boolean;className?:string}){
  return <Link href="/" aria-label={`${brand.displayName} home`} className={cn("brand-lockup",className)}><Image src={brand.mark} alt="" width={52} height={52} className="brand-mark" priority/><span className={compact?"sr-only":"brand-type"}><strong>{brand.wordmark}</strong><small>GAMING</small></span></Link>;
}
