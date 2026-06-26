"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function HelpMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="icon" className="size-10" aria-label="Open help menu">
          ?
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Help and support</DropdownMenuLabel>
        <DropdownMenuItem asChild><Link href="/app/help">Help center</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link href="/app/getting-started">Quick start wizard</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><a href="mailto:support@aegisweb.com">Email support</a></DropdownMenuItem>
        <DropdownMenuItem asChild><a href="https://status.aegisweb.com" target="_blank" rel="noreferrer">System status</a></DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><a href="mailto:support@aegisweb.com?subject=AegisWeb%20pilot%20feedback">Send feedback</a></DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
