import Link from "next/link";
import { BrandLockup } from "./brand-lockup";

const navigation=[["/","Home"],["/tournaments/history","Tournaments"],["/leaderboards","Players"],["/search","Search"]] as const;
export function SiteHeader(){return <header className="site-header"><div className="site-header-inner"><BrandLockup/><nav aria-label="Primary navigation" className="top-nav">{navigation.map(([href,label])=><Link href={href} key={href}>{label}</Link>)}</nav><div className="header-actions"><Link className="button button-secondary" href="/search">Search</Link><Link className="button button-primary" href="/sign-in">Sign In</Link></div></div></header>}
