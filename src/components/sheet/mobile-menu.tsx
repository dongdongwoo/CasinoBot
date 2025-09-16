"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/common/mobile-sheet";
import { APP_ROUTES } from "@/constant/routes";
import { X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const MobileMenu = ({ open, onOpenChange }: Props) => {
  const pathname = usePathname();

  const router = useRouter();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-screen desktop:hidden" side="left">
        <SheetHeader className="border-b border-border">
          <SheetTitle className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                {/* <Image
                  src="/logo/nexus_main_logo.png"
                  alt="logo"
                  width={72}
                  height={32}
                /> */}
                <p className="text-sm font-bold">Agent Jesse</p>
              </div>
              <div
                className="cursor-pointer"
                onClick={() => onOpenChange(false)}
              >
                <X className="size-6" />
              </div>
            </div>
          </SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-3 pt-6">
          {APP_ROUTES.map((route) => {
            const hasSelected = route.href === pathname;

            return (
              <div
                key={route.href}
                onClick={() => {
                  router.push(route.href);
                  onOpenChange(false);
                }}
                className="cursor-pointer rounded-md px-3"
              >
                <p
                  className={`cursor-pointer rounded-md px-3 py-4 text-sm font-medium text-foreground hover:bg-accent ${hasSelected && `bg-accent`}`}
                >
                  {route.label}
                </p>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
};
