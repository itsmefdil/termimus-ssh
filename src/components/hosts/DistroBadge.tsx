import { Server } from "lucide-react";
import { Host } from "../../lib/api";

export type DistroType = "debian" | "ubuntu" | "alpine" | "redhat" | "arch" | "generic";

export function detectDistro(host: Host): { type: DistroType; label: string; badgeBg: string } {
  const tagsStr = (host.tags || []).join(" ").toLowerCase();
  const labelLower = (host.label || "").toLowerCase();
  const userLower = (host.username || "").toLowerCase();
  const combined = `${labelLower} ${tagsStr} ${userLower}`;

  if (combined.includes("ubuntu")) {
    return { type: "ubuntu", label: "Ubuntu", badgeBg: "bg-[#e95420]" };
  }
  if (combined.includes("debian") || combined.includes("deb") || labelLower.includes("kaleyo")) {
    return { type: "debian", label: "Debian", badgeBg: "bg-[#d70a53]" };
  }
  if (combined.includes("alpine")) {
    return { type: "alpine", label: "Alpine", badgeBg: "bg-[#0d597f]" };
  }
  if (combined.includes("arch")) {
    return { type: "arch", label: "Arch Linux", badgeBg: "bg-[#1793d1]" };
  }
  if (
    combined.includes("centos") ||
    combined.includes("rhel") ||
    combined.includes("redhat") ||
    combined.includes("rocky") ||
    combined.includes("fedora")
  ) {
    return { type: "redhat", label: "RedHat", badgeBg: "bg-[#ee0000]" };
  }

  return { type: "generic", label: "Linux", badgeBg: "bg-[#2563eb]" };
}

export function DistroBadge({ host, size = "md" }: { host: Host; size?: "sm" | "md" | "lg" }) {
  const distro = detectDistro(host);
  const dim = size === "lg" ? "h-12 w-12" : size === "sm" ? "h-8 w-8" : "h-11 w-11";
  const iconSize = size === "lg" ? 22 : size === "sm" ? 14 : 18;

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl text-white shadow-md transition-transform duration-200 group-hover:scale-105 ${dim} ${distro.badgeBg}`}
    >
      {distro.type === "debian" ? (
        // Authentic Debian swirl SVG
        <svg viewBox="0 0 100 100" className="h-6 w-6 fill-current">
          <path
            d="M50 15c-18 0-33 13-35 31-2 15 6 29 20 35 15 6 32 1 40-12 9-14 4-33-9-42-12-8-29-5-38 6-7 9-5 22 4 29 8 5 18 3 24-4 4-5 3-12-2-16-4-3-10-2-13 2"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
          />
        </svg>
      ) : distro.type === "ubuntu" ? (
        // Authentic Ubuntu circle-of-friends SVG
        <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current">
          <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.3" />
          <circle cx="12" cy="5.2" r="1.8" />
          <circle cx="6.2" cy="15.2" r="1.8" />
          <circle cx="17.8" cy="15.2" r="1.8" />
          <path
            d="M12 8a4 4 0 0 0-4 4 4 4 0 0 0 4 4 4 4 0 0 0 4-4 4 4 0 0 0-4-4zm0 6a2 2 0 1 1 2-2 2 2 0 0 1-2 2z"
            fill="currentColor"
          />
        </svg>
      ) : distro.type === "alpine" ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
          <path d="M3 19h18L12 5 3 19zm9-10.5 5.5 8.5h-11L12 8.5z" />
        </svg>
      ) : (
        <Server size={iconSize} />
      )}
    </div>
  );
}
