import { Link, useLocation } from "wouter";
import {
  FileStack,
  Layout,
  Hammer,
  Send,
  Mail,
  LayoutTemplate,
  Blocks,
  Rocket,
  Copyright,
  Images,
  ChevronDown,
  ChevronRight,
  Folder,
  Globe2,
  Plug,
  KeyRound,
  Wand2,
  PlusSquare,
  Palette,
} from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import logoHorizontal from "@assets/wt-canvas-horizontal-logo.png";
import type { Integration } from "@shared/schema";
import { useAuth } from "@/lib/auth";
import { SiShopify } from "react-icons/si";
import { Mail as MailIcon } from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ size?: number }>;
  adminOnly?: boolean;
}

interface NavSection {
  section: string;
  items: NavItem[];
}

const navigationItems: NavSection[] = [
  {
    section: "Webpages",
    items: [
      { name: "Saved Pages",     href: "/pages",              icon: FileStack },
      { name: "Templates",       href: "/templates",           icon: Layout },
      { name: "Blank Builder",   href: "/pages/builder",       icon: Hammer },
      { name: "Deployment",      href: "/pages/deployment",    icon: Rocket },
      { name: "Keywords",        href: "/keywords",             icon: KeyRound },
    ],
  },
  {
    section: "Emails",
    items: [
      { name: "Saved Emails",    href: "/emails",             icon: Mail },
      { name: "Templates",       href: "/email-templates",    icon: LayoutTemplate },
      { name: "Blank Builder",   href: "/email-builder",      icon: Hammer },
      { name: "Deployment",      href: "/email-deployment",   icon: Send },
    ],
  },
  {
    section: "Blocks",
    items: [
      { name: "Block Library", href: "/blocks", icon: Blocks },
    ],
  },
  {
    section: "Settings",
    items: [
      { name: "Site Settings", href: "/site-settings", icon: Globe2 },
      { name: "Brand Context", href: "/settings/brand-context", icon: LayoutTemplate },
    ],
  },
];

interface CloudinaryFolder {
  name: string;
  path: string;
  children?: CloudinaryFolder[];
}

interface FolderTreeNode {
  name: string;
  path: string;
  children: FolderTreeNode[];
  isExpanded: boolean;
}

export function Sidebar() {
  const [location] = useLocation();
  const [isCloudinaryExpanded, setIsCloudinaryExpanded] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const { data: user } = useAuth();

  const isAdminOrDev = user?.role === "admin" || user?.role === "developer";

  const { data: integrationsList = [] } = useQuery<Integration[]>({
    queryKey: ["/api/integrations"],
    staleTime: 60_000,
  });

  const { data: cloudinaryFolders = [] } = useQuery<CloudinaryFolder[]>({
    queryKey: ["/api/cloudinary/folders"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/cloudinary/folders");
      if (!response.ok) return [];
      return response.json();
    },
    enabled: isCloudinaryExpanded,
  });

  const buildFolderTree = (folders: CloudinaryFolder[]): FolderTreeNode[] => {
    const tree: FolderTreeNode[] = [];
    const folderMap = new Map<string, FolderTreeNode>();

    folders.forEach((folder) => {
      folderMap.set(folder.path, {
        name: folder.name,
        path: folder.path,
        children: [],
        isExpanded: expandedFolders.has(folder.path),
      });
    });

    folders.forEach((folder) => {
      const node = folderMap.get(folder.path)!;
      const pathParts = folder.path.split("/");
      if (pathParts.length === 1) {
        tree.push(node);
      } else {
        const parentPath = pathParts.slice(0, -1).join("/");
        const parent = folderMap.get(parentPath);
        if (parent) {
          parent.children.push(node);
        } else {
          tree.push(node);
        }
      }
    });

    return tree;
  };

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(folderPath)) {
        newSet.delete(folderPath);
      } else {
        newSet.add(folderPath);
      }
      return newSet;
    });
  };

  const renderFolderTree = (nodes: FolderTreeNode[], level = 0) => {
    return nodes.map((node) => (
      <div key={node.path}>
        <li style={{ marginLeft: `${(level + 1) * 16}px` }}>
          <div className="flex items-center">
            {node.children.length > 0 ? (
              <button
                onClick={() => toggleFolder(node.path)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
              >
                {node.isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>
            ) : (
              <div className="w-5" />
            )}
            <Link
              href={`/cloudinary?folder=${encodeURIComponent(node.path)}`}
              className={`flex-1 ${location.includes(`folder=${encodeURIComponent(node.path)}`) ? "active" : ""}`}
            >
              <Folder size={18} />
              {node.name}
            </Link>
          </div>
        </li>

        {node.isExpanded && node.children.length > 0 && renderFolderTree(node.children, level + 1)}
      </div>
    ));
  };

  const folderTree = buildFolderTree(cloudinaryFolders);

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    return location === href || location.startsWith(href + "/") || location.startsWith(href + "?");
  };

  return (
    <aside className="wt-sidebar">
      <Link href="/">
        <div className="wt-sidebar-logo cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <img src={logoHorizontal} alt="WT Canvas" className="h-8 w-auto" />
        </div>
      </Link>

      {navigationItems.map((section) => (
        <div key={section.section} className="wt-sidebar-section">
          <div className="wt-sidebar-section-title">{section.section}</div>
          <ul className="wt-sidebar-nav">
            {section.items.map((item) => {
              if (item.adminOnly && !isAdminOrDev) return null;
              const IconComponent = item.icon;
              return (
                <li key={item.href}>
                  <Link href={item.href} className={isActive(item.href) ? "active" : ""}>
                    <IconComponent size={18} />
                    {item.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {/* Content Section */}
      <div className="wt-sidebar-section">
        <div className="wt-sidebar-section-title">Content</div>
        <ul className="wt-sidebar-nav">
          <li>
            <Link href="/brand-logos" className={isActive("/brand-logos") ? "active" : ""}>
              <Copyright size={18} />
              Brand Content
            </Link>
          </li>

          {/* Cloudinary expandable */}
          <li>
            <button
              onClick={() => setIsCloudinaryExpanded(!isCloudinaryExpanded)}
              className="w-full flex items-center justify-between text-left px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
            >
              <div className="flex items-center gap-2">
                <Images size={18} />
                <span>Cloudinary</span>
              </div>
              {isCloudinaryExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          </li>

          {isCloudinaryExpanded && (
            <>
              <li className="ml-4">
                <Link href="/cloudinary" className={location === "/cloudinary" ? "active" : ""}>
                  <Images size={18} />
                  All Assets
                </Link>
              </li>
              {renderFolderTree(folderTree)}
            </>
          )}

          <li>
            <Link href="/content/create" className={isActive("/content/create") ? "active" : ""}>
              <Wand2 size={18} />
              Create Content
            </Link>
          </li>

          {isAdminOrDev && (
            <li>
              <Link href="/content/image-templates" className={isActive("/content/image-templates") ? "active" : ""}>
                <Palette size={18} />
                Image Templates
              </Link>
            </li>
          )}
        </ul>
      </div>

      {/* Integrations Section */}
      <div className="wt-sidebar-section">
        <div className="wt-sidebar-section-title">Integrations</div>
        <ul className="wt-sidebar-nav">
          <li>
            <Link href="/integrations" className={isActive("/integrations") ? "active" : ""}>
              <Plug size={18} />
              Manage Integrations
            </Link>
          </li>
          {integrationsList.map((integration) => {
            const IntIcon = integration.type === "shopify" ? SiShopify : integration.type === "klaviyo" ? MailIcon : null;
            const dotColor =
              integration.status === "connected"
                ? "bg-green-500"
                : integration.status === "error"
                ? "bg-red-500"
                : "bg-gray-400";
            const statusLabel =
              integration.status === "connected"
                ? "Connected"
                : integration.status === "error"
                ? "Error"
                : "Not Connected";
            return (
              <li key={integration.id} className="ml-3">
                <Link href="/integrations" className={isActive("/integrations") ? "active" : ""}>
                  {IntIcon ? <IntIcon size={15} className="shrink-0" /> : <Plug size={15} className="shrink-0" />}
                  <span className="flex-1 truncate">{integration.name}</span>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} title={statusLabel} />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
