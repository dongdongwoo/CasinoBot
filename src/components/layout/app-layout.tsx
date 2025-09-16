"use client";

import Link from "next/link";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";

import { APP_ROUTES } from "@/constant/routes";
import { Separator } from "@/components/ui/separator";

interface Props {
  children: React.ReactNode;
}

export const AppLayout = ({ children }: Props) => {
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);

  const pathname = usePathname();
  const router = useRouter();

  const changeMobileMenuVisibility = (status: boolean) => {
    setIsMenuOpen(status);
  };

  return (
    <div className="h-full w-screen">
      <div className="flex w-screen items-center justify-between px-4 py-3 desktop:p-4">
        <div className="flex items-center space-x-[60px]">
          <div className="cursor-pointer" onClick={() => router.push("/")}>
            <div className="text-sm font-bold">CasinoBot</div>
            {/* <Image
              src="/logo/jesse_profile.png"
              alt="logo"
              width={32}
              height={32}
            /> */}
          </div>
          <div className="hidden items-center gap-6 desktop:visible desktop:flex">
            {APP_ROUTES.map((route) => {
              const hasSelected = route.href === pathname;

              return (
                <Link
                  key={route.href}
                  href={route.href}
                  className={`cursor-pointer rounded-md px-3 py-2 hover:bg-accent ${hasSelected && `bg-accent`}`}
                >
                  <p className="text-sm font-medium text-foreground">
                    {route.label}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
        {/* <div className="cursor-pointer desktop:hidden">
          <AlignJustify
            className="size-6"
            onClick={() => changeMobileMenuVisibility(!isMenuOpen)}
          />
          <MobileMenu
            open={isMenuOpen}
            onOpenChange={changeMobileMenuVisibility}
          />
        </div> */}
      </div>
      <Separator className="h-px w-full bg-border" />
      <div className="h-[calc(100svh-48px)] w-screen desktop:h-[calc(100svh-64px)]">
        {children}
      </div>
    </div>
  );
};
