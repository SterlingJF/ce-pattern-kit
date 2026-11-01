import { Button, type ButtonProps } from "@/component-core/button";

export type PrimaryProps = ButtonProps;

export function Primary(props: PrimaryProps) {
  return <Button {...props} />;
}
