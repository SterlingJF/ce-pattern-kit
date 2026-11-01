import { Button } from "@acme/components/component-core/button";
import { NavLink } from "@acme/components/component-elements/nav-link";
import { useCopy } from "@acme/components/lib/i18n";

export function SearchBar({ onSubmit }: { onSubmit: () => void }) {
  const t = useCopy();
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <NavLink active>{t("search.label")}</NavLink>
      <Button type="submit">{t("search.submit")}</Button>
    </form>
  );
}
