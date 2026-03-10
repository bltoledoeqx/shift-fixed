import { LayoutDashboard, CalendarDays, PhoneCall, Users, Settings, LogOut } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";

const menuItems = [
  { title: "Painel", url: "/", icon: LayoutDashboard },
  { title: "Escala Normal", url: "/escala", icon: CalendarDays },
  { title: "Sobreaviso", url: "/sobreaviso", icon: PhoneCall },
  { title: "Equipe", url: "/equipe", icon: Users },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

function LogoutButton() {
  const { logout } = useAuth();
  return (
    <button
      onClick={logout}
      className="flex items-center gap-2 w-full px-3 py-2 mt-2 text-xs text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/40 rounded-md transition-colors"
    >
      <LogOut className="w-3.5 h-3.5" />
      Sair
    </button>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg overflow-hidden flex-shrink-0">
            <img src="/logo.svg" alt="Equinix" className="h-8 w-8 object-contain" />
          </div>
          {!collapsed && (
            <div className="animate-fade-in">
              <h2 className="text-sm font-semibold text-sidebar-foreground">Shift Navigator</h2>
              <p className="text-xs text-sidebar-foreground/60">Gestão de Escalas</p>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/40 uppercase text-[10px] tracking-wider">
            {!collapsed ? "Menu" : ""}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-sidebar-accent/60 transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        {!collapsed && (
          <>
            <p className="text-[10px] text-sidebar-foreground/30 text-center">24/7 Operações</p>
            <LogoutButton />
          </>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
