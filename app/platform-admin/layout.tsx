import { PlatformShell } from "@/components/platform/platform-shell";
import { requirePlatformRole } from "@/lib/platform/auth";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const { role } = await requirePlatformRole(["super_admin", "platform_moderator", "support_agent"]);
  return <PlatformShell role={role}>{children}</PlatformShell>;
}
