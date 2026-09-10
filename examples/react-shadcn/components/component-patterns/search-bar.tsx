import { Button } from "@acme/components/component-core/button";
import { NavLink } from "@acme/components/component-elements/nav-link";

export function SearchBar({ onSubmit }: { onSubmit: () => void }) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <NavLink active>Search</NavLink>
      <Button type="submit">Go</Button>
    </form>
  );
}
