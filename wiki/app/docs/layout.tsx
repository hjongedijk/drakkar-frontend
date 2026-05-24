import { docsTree } from "@/lib/docs";
import { DocsLayout } from "fumadocs-ui/layouts/docs";

import type { ReactNode } from "react";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={docsTree}
      nav={{ title: <span className="font-bold tracking-tight">Drakkar</span> }}
      links={[
        { text: "GraphQL", url: "/api/graphql" },
        { text: "API", url: "/api/docs" }
      ]}
    >
      {children}
    </DocsLayout>
  );
}
