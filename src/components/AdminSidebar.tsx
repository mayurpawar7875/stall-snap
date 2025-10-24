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
  // Force visible text for both states
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    [
      "flex w-full items-center gap-2 rounded-md px-2 py-2 transition",
      "text-foreground", // <-- make label always visible
      isActive ? "bg-accent text-accent-foreground font-medium" : "hover:bg-accent/50 hover:text-foreground",
    ].join(" ");

  return (
    <Sidebar className="w-64">
      <SidebarContent>
        <SidebarGroup>
          {/* ensure group label is also visible */}
          <SidebarGroupLabel className="ml-1 !text-foreground">Admin Panel</SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  {/* Keep button wrapper but control text color on the NavLink */}
                  <SidebarMenuButton asChild className="flex items-center gap-2">
                    <NavLink to={item.url} end className={linkClass}>
                      <item.icon className="h-4 w-4 flex-shrink-0 text-foreground" />
                      <span className="ml-1">{item.title}</span>
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
