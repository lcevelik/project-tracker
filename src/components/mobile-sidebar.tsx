"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Sidebar, type SidebarProject } from "@/components/sidebar";
import { useState } from "react";

export function MobileSidebar({
  projects,
  groups,
}: {
  projects: SidebarProject[];
  groups: string[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="fixed left-4 top-3 z-40 md:hidden"
            >
              <Menu className="h-5 w-5 text-zinc-400" />
            </Button>
          }
        />
        <SheetContent side="left" className="w-64 p-0">
          <Sidebar projects={projects} groups={groups} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
