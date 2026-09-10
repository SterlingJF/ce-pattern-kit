import type { ComponentProps } from "react";

import { Button, buttonVariants } from "@acme/components/component-core/button";

export const navLinkVariants = (active: boolean): string =>
  buttonVariants({ variant: active ? "default" : "ghost", size: "sm" });

export function NavLink({
  active = false,
  ...props
}: ComponentProps<typeof Button> & { active?: boolean }) {
  return <Button className={navLinkVariants(active)} {...props} />;
}
