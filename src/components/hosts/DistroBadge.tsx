import {
  siUbuntu,
  siDebian,
  siAlpinelinux,
  siArchlinux,
  siManjaro,
  siFedora,
  siCentos,
  siRedhat,
  siRockylinux,
  siAlmalinux,
  siOpensuse,
  siKalilinux,
  siLinuxmint,
  siPopos,
  siElementary,
  siNixos,
  siGentoo,
  siVoidlinux,
  siSlackware,
  siRaspberrypi,
  siEndeavouros,
  siLinux,
  type SimpleIcon,
} from "simple-icons";
import { Host } from "../../lib/api";

// ══════════════════════════════════════════════════════════════════════════════
// Distro Types & Metadata powered by official Simple Icons
// ══════════════════════════════════════════════════════════════════════════════

export type DistroType =
  | "ubuntu"
  | "debian"
  | "alpine"
  | "arch"
  | "manjaro"
  | "endeavour"
  | "fedora"
  | "centos"
  | "rhel"
  | "rocky"
  | "almalinux"
  | "opensuse"
  | "kali"
  | "mint"
  | "popos"
  | "elementary"
  | "nixos"
  | "gentoo"
  | "void"
  | "slackware"
  | "raspbian"
  | "amazon"
  | "linux"
  | "generic";

interface DistroMeta {
  type: DistroType;
  label: string;
  icon: SimpleIcon;
  bgColor: string;
}

const DISTRO_MAP: Record<DistroType, DistroMeta> = {
  ubuntu: {
    type: "ubuntu",
    label: siUbuntu.title,
    icon: siUbuntu,
    bgColor: `#${siUbuntu.hex}`,
  },
  debian: {
    type: "debian",
    label: siDebian.title,
    icon: siDebian,
    bgColor: `#${siDebian.hex}`,
  },
  alpine: {
    type: "alpine",
    label: siAlpinelinux.title,
    icon: siAlpinelinux,
    bgColor: `#${siAlpinelinux.hex}`,
  },
  arch: {
    type: "arch",
    label: siArchlinux.title,
    icon: siArchlinux,
    bgColor: `#${siArchlinux.hex}`,
  },
  manjaro: {
    type: "manjaro",
    label: siManjaro.title,
    icon: siManjaro,
    bgColor: `#${siManjaro.hex}`,
  },
  endeavour: {
    type: "endeavour",
    label: siEndeavouros.title,
    icon: siEndeavouros,
    bgColor: `#${siEndeavouros.hex}`,
  },
  fedora: {
    type: "fedora",
    label: siFedora.title,
    icon: siFedora,
    bgColor: `#${siFedora.hex}`,
  },
  centos: {
    type: "centos",
    label: siCentos.title,
    icon: siCentos,
    bgColor: `#${siCentos.hex}`,
  },
  rhel: {
    type: "rhel",
    label: siRedhat.title,
    icon: siRedhat,
    bgColor: `#${siRedhat.hex}`,
  },
  rocky: {
    type: "rocky",
    label: siRockylinux.title,
    icon: siRockylinux,
    bgColor: `#${siRockylinux.hex}`,
  },
  almalinux: {
    type: "almalinux",
    label: siAlmalinux.title,
    icon: siAlmalinux,
    bgColor: `#${siAlmalinux.hex}`,
  },
  opensuse: {
    type: "opensuse",
    label: siOpensuse.title,
    icon: siOpensuse,
    bgColor: `#${siOpensuse.hex}`,
  },
  kali: {
    type: "kali",
    label: siKalilinux.title,
    icon: siKalilinux,
    bgColor: `#${siKalilinux.hex}`,
  },
  mint: {
    type: "mint",
    label: siLinuxmint.title,
    icon: siLinuxmint,
    bgColor: `#${siLinuxmint.hex}`,
  },
  popos: {
    type: "popos",
    label: siPopos.title,
    icon: siPopos,
    bgColor: `#${siPopos.hex}`,
  },
  elementary: {
    type: "elementary",
    label: siElementary.title,
    icon: siElementary,
    bgColor: `#${siElementary.hex}`,
  },
  nixos: {
    type: "nixos",
    label: siNixos.title,
    icon: siNixos,
    bgColor: `#${siNixos.hex}`,
  },
  gentoo: {
    type: "gentoo",
    label: siGentoo.title,
    icon: siGentoo,
    bgColor: `#${siGentoo.hex}`,
  },
  void: {
    type: "void",
    label: siVoidlinux.title,
    icon: siVoidlinux,
    bgColor: `#${siVoidlinux.hex}`,
  },
  slackware: {
    type: "slackware",
    label: siSlackware.title,
    icon: siSlackware,
    bgColor: `#${siSlackware.hex}`,
  },
  raspbian: {
    type: "raspbian",
    label: siRaspberrypi.title,
    icon: siRaspberrypi,
    bgColor: `#${siRaspberrypi.hex}`,
  },
  amazon: {
    type: "amazon",
    label: "Amazon Linux",
    icon: siLinux,
    bgColor: "#FF9900",
  },
  linux: {
    type: "linux",
    label: "Linux",
    icon: siLinux,
    bgColor: "#2563eb",
  },
  generic: {
    type: "generic",
    label: "Linux",
    icon: siLinux,
    bgColor: "#2563eb",
  },
};

export const DISTRO_OPTIONS: { id: string; label: string }[] = [
  { id: "", label: "Auto-detect on SSH login" },
  { id: "ubuntu", label: siUbuntu.title },
  { id: "debian", label: siDebian.title },
  { id: "alpine", label: siAlpinelinux.title },
  { id: "arch", label: siArchlinux.title },
  { id: "manjaro", label: siManjaro.title },
  { id: "endeavour", label: siEndeavouros.title },
  { id: "fedora", label: siFedora.title },
  { id: "centos", label: siCentos.title },
  { id: "rhel", label: "Red Hat (RHEL)" },
  { id: "rocky", label: siRockylinux.title },
  { id: "almalinux", label: siAlmalinux.title },
  { id: "opensuse", label: siOpensuse.title },
  { id: "kali", label: siKalilinux.title },
  { id: "mint", label: siLinuxmint.title },
  { id: "popos", label: siPopos.title },
  { id: "elementary", label: siElementary.title },
  { id: "nixos", label: siNixos.title },
  { id: "gentoo", label: siGentoo.title },
  { id: "void", label: siVoidlinux.title },
  { id: "slackware", label: siSlackware.title },
  { id: "raspbian", label: siRaspberrypi.title },
  { id: "amazon", label: "Amazon Linux" },
  { id: "generic", label: "Generic Linux" },
];

// ══════════════════════════════════════════════════════════════════════════════
// Distro resolution (stored os_icon -> label/tag heuristic -> generic Linux)
// ══════════════════════════════════════════════════════════════════════════════

function heuristicDistro(host: Host): DistroType {
  const combined = [
    host.label ?? "",
    (host.tags ?? []).join(" "),
    host.username ?? "",
  ]
    .join(" ")
    .toLowerCase();

  if (combined.includes("ubuntu")) return "ubuntu";
  if (combined.includes("kali")) return "kali";
  if (combined.includes("mint")) return "mint";
  if (combined.includes("pop_os") || combined.includes("popos")) return "popos";
  if (combined.includes("elementary")) return "elementary";
  if (combined.includes("debian") || combined.includes("deb")) return "debian";
  if (combined.includes("alpine")) return "alpine";
  if (combined.includes("manjaro")) return "manjaro";
  if (combined.includes("endeavour")) return "endeavour";
  if (combined.includes("arch")) return "arch";
  if (combined.includes("fedora")) return "fedora";
  if (combined.includes("rocky")) return "rocky";
  if (combined.includes("alma")) return "almalinux";
  if (combined.includes("centos")) return "centos";
  if (combined.includes("rhel") || combined.includes("redhat") || combined.includes("red hat")) return "rhel";
  if (combined.includes("opensuse") || combined.includes("suse")) return "opensuse";
  if (combined.includes("nixos")) return "nixos";
  if (combined.includes("gentoo")) return "gentoo";
  if (combined.includes("void")) return "void";
  if (combined.includes("slackware")) return "slackware";
  if (combined.includes("pi") || combined.includes("raspberry") || combined.includes("raspbian")) return "raspbian";
  if (combined.includes("amazon") || combined.includes("amzn")) return "amazon";
  return "generic";
}

export function detectDistro(host: Host): DistroMeta {
  if (host.os_icon) {
    const slug = host.os_icon as DistroType;
    const meta = DISTRO_MAP[slug];
    if (meta) return meta;
  }
  const type = heuristicDistro(host);
  return DISTRO_MAP[type];
}

// ══════════════════════════════════════════════════════════════════════════════
// DistroBadge Component
// ══════════════════════════════════════════════════════════════════════════════

export function DistroBadge({ host, size = "md" }: { host: Host; size?: "sm" | "md" | "lg" }) {
  const distro = detectDistro(host);
  const dim = size === "lg" ? "h-12 w-12" : size === "sm" ? "h-8 w-8" : "h-11 w-11";
  const iconSize = size === "lg" ? 24 : size === "sm" ? 16 : 20;

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl text-white shadow-md transition-transform duration-200 group-hover:scale-105 ${dim}`}
      style={{ backgroundColor: distro.bgColor }}
      title={distro.label}
    >
      <svg
        viewBox="0 0 24 24"
        width={iconSize}
        height={iconSize}
        className="shrink-0 fill-current"
      >
        <path d={distro.icon.path} />
      </svg>
    </div>
  );
}
