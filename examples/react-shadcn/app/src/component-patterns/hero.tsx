import { SearchBar } from "@acme/components";
import { useCopy } from "@acme/components/lib/i18n";

import { Button } from "../component-core";

export function Hero() {
  const t = useCopy();
  return (
    <header>
      <SearchBar onSubmit={() => undefined} />
      <Button>{t("hero.start")}</Button>
    </header>
  );
}
