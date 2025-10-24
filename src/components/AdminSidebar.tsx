import { NavLink } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { LayoutDashboard, Users, FileText, Settings, MonitorPlay } from "lucide-react";

const menuItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Live Markets", url: "/admin/live-markets", icon: MonitorPlay },
  { title: "All Sessions", url: "/admin/sessions", icon: FileText },
  { title: "Users", url: "/admin/users", icon: Users },
  { title: "Settings", url: "/admin/settings", icon: Settings },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    [
      "flex w-full items-center gap-2 rounded-md px-2 py-2 transition",
      isActive ? "bg-accent text-accent-foreground font-medium" : "hover:bg-accent/50",
    ].join(" ");

  return (
    <Sidebar className={collapsed ? "w-14" : "w-60"} collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className={collapsed ? "sr-only" : ""}>Admin Panel</SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="flex items-center gap-2">
                    <NavLink to={item.url} end className={linkClass}>
                      {/* Ensure the icon has an explicit text color so it’s visible in all themes */}
                      <item.icon className="h-4 w-4 flex-shrink-0 text-foreground" />
                      {!collapsed && <span className="ml-1">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
