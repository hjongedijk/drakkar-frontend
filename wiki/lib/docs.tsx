import type { Root } from "fumadocs-core/page-tree";
import type { ReactNode } from "react";

export type DocsPageEntry = {
  title: string;
  description: string;
  content: ReactNode;
};

export const docsTree: Root = {
  name: "Drakkar Docs",
  children: [
    { type: "page", name: "Introduction", url: "/docs" },
    { type: "page", name: "Installation", url: "/docs/installation" },
    { type: "page", name: "Configuration", url: "/docs/configuration" },
    { type: "page", name: "API", url: "/docs/api" },
    { type: "page", name: "Upgrading", url: "/docs/upgrading" },
    { type: "page", name: "Troubleshooting", url: "/docs/troubleshooting" }
  ]
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2>{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Code({ children }: { children: ReactNode }) {
  return <pre>{children}</pre>;
}

export const docsPages: Record<string, DocsPageEntry> = {
  "": {
    title: "Drakkar Docs",
    description: "Overview of Drakkar, runtime layout, API entry points, and where to start.",
    content: (
      <>
        <p>Drakkar is a Usenet-first media automation stack with request sync from Seerr, NZBHydra2-backed search, direct and archived streaming through FUSE, Plex-targeted refreshes, and a library view that tracks requested, downloading, missing, and completed media.</p>
        <Section title="Start here">
          <ul>
            <li><a href="/docs/installation">Installation</a></li>
            <li><a href="/docs/configuration">Configuration</a></li>
            <li><a href="/docs/api">API</a></li>
            <li><a href="/docs/upgrading">Upgrading</a></li>
            <li><a href="/docs/troubleshooting">Troubleshooting</a></li>
          </ul>
        </Section>
        <Section title="Main endpoints">
          <ul>
            <li><code>/docs</code> Fumadocs site</li>
            <li><code>/api/docs</code> compact API reference</li>
            <li><code>/api/graphql</code> GraphiQL explorer</li>
            <li><code>/api/status</code> backend status</li>
          </ul>
        </Section>
      </>
    )
  },
  installation: {
    title: "Installation",
    description: "Public Docker Compose deployment, host mount requirements, and first boot.",
    content: (
      <>
        <Section title="Public Compose">
          <p>Use the published compose stack from the backend release repo. It includes frontend, backend, postgres, valkey, and seerr.</p>
        </Section>
        <Section title="Host mount setup">
          <p>Drakkar expects a shared host mount at <code>/mnt/drakkar</code>.</p>
          <Code>{`sudo systemctl daemon-reload\nsudo systemctl enable --now drakkar-mount.service`}</Code>
        </Section>
        <Section title="First boot">
          <ul>
            <li>open the frontend</li>
            <li>finish the setup wizard</li>
            <li>create the first admin</li>
            <li>connect NZBHydra2, Usenet, Seerr, metadata, and optionally Plex</li>
          </ul>
        </Section>
      </>
    )
  },
  configuration: {
    title: "Configuration",
    description: "Runtime paths, settings.json, and where Drakkar stores real working data.",
    content: (
      <>
        <Section title="Config file">
          <Code>{`/data/config/settings.json`}</Code>
        </Section>
        <Section title="Persistent local data">
          <ul>
            <li><code>/data/config/settings.json</code></li>
            <li><code>/data/nzb-backup</code></li>
          </ul>
        </Section>
        <Section title="Live working paths">
          <ul>
            <li><code>/mnt/downloads</code></li>
            <li><code>/mnt/completed</code></li>
            <li><code>/mnt/nzb</code></li>
            <li><code>/mnt/media/movies</code></li>
            <li><code>/mnt/media/tv</code></li>
          </ul>
        </Section>
        <Section title="FUSE views">
          <ul>
            <li><code>/mnt/fuse/nzb</code></li>
            <li><code>/mnt/fuse/completed</code></li>
            <li><code>/mnt/fuse/mounted/releases</code></li>
          </ul>
        </Section>
      </>
    )
  },
  api: {
    title: "API",
    description: "REST entry points, GraphQL, and authentication examples.",
    content: (
      <>
        <Section title="REST">
          <ul>
            <li><code>/api/status</code></li>
            <li><code>/api/library</code></li>
            <li><code>/api/requests</code></li>
            <li><code>/api/webhooks/seerr</code></li>
            <li><code>/api/downloads/queue/page</code></li>
            <li><code>/api/tasks</code></li>
          </ul>
        </Section>
        <Section title="GraphQL">
          <p>Use GraphiQL at <code>/api/graphql</code>.</p>
          <Code>{`{\n  status { version backend postgresql valkey }\n  downloads(limit: 5) { title status progress }\n  library(limit: 5) { title mediaType libraryStatus updatedAt }\n}`}</Code>
        </Section>
        <Section title="Authentication">
          <Code>{`curl -H 'x-api-token: YOUR_DRAKKAR_API_TOKEN' \\\n  -H 'Authorization: Bearer YOUR_DRAKKAR_API_TOKEN' \\\n  http://HOST:8080/api/requests`}</Code>
        </Section>
        <Section title="Seerr webhook">
          <p>Use this to push approved requests into Drakkar immediately instead of waiting for the next sync cycle. Webhook-origin requests are promoted to the front of the waiting queue, but the currently running download keeps running.</p>
          <Code>{`Webhook URL:\nhttp://HOST:8080/api/webhooks/seerr\n\nAuthorization Header:\nBearer YOUR_DRAKKAR_API_TOKEN\n\nCustom Header (optional instead of bearer):\nx-api-token: YOUR_DRAKKAR_API_TOKEN\n\nDefault Seerr payload is supported, including:\nrequest.request_id\nmedia.tmdbId\nmedia.tvdbId\nmedia.imdbId\nnotification_type\nevent`}</Code>
        </Section>
      </>
    )
  },
  upgrading: {
    title: "Upgrading",
    description: "Recommended Docker Compose upgrade flow for Drakkar.",
    content: (
      <>
        <Section title="Recommended flow">
          <Code>{`docker compose pull\ndocker compose up -d --force-recreate\ndocker compose ps`}</Code>
        </Section>
        <Section title="When to use full stop/start">
          <Code>{`docker compose down\ndocker compose up -d`}</Code>
          <p>Use this when bind mounts changed, when troubleshooting stale networking, or when you want a full container restart path.</p>
        </Section>
        <Section title="After upgrading">
          <Code>{`docker compose logs --tail 200 backend\ndocker compose ps`}</Code>
        </Section>
      </>
    )
  },
  troubleshooting: {
    title: "Troubleshooting",
    description: "Common startup, FUSE, queue, and storage issues.",
    content: (
      <>
        <Section title="FUSE not mounted after restart">
          <Code>{`docker compose logs --tail 200 backend\nfindmnt -T /mnt/drakkar -o TARGET,PROPAGATION`}</Code>
        </Section>
        <Section title="Unexpected folders under ./data">
          <p>Current public defaults only keep <code>./data/config/settings.json</code> and <code>./data/nzb-backup</code>. Working folders should be under <code>/mnt</code>.</p>
        </Section>
        <Section title="Slow request processing">
          <p>Check <code>/api/tasks</code>, <code>/api/status</code>, and <code>/api/downloads/queue/page?page=1&amp;limit=100</code>. If <code>request-sync</code> is stuck in <code>running</code>, redeploy with the latest backend image.</p>
        </Section>
      </>
    )
  }
};

export function getDocsPage(slug?: string[]) {
  const key = slug?.join("/") ?? "";
  return docsPages[key];
}

export function docsStaticParams() {
  return Object.keys(docsPages)
    .filter((key) => key.length > 0)
    .map((key) => ({ slug: key.split("/") }));
}
