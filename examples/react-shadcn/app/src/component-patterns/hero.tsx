import { SearchBar } from "@acme/components";

import { Button } from "../component-core";

export function Hero() {
  return (
    <header>
      <SearchBar onSubmit={() => undefined} />
      <Button>Start</Button>
    </header>
  );
}
