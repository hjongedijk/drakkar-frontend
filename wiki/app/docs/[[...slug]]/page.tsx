import { docsStaticParams, getDocsPage } from "@/lib/docs";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/page";
import { notFound } from "next/navigation";

export default async function Page(props: { params: Promise<{ slug?: string[] }> }) {
  const params = await props.params;
  const page = getDocsPage(params.slug);
  if (!page) notFound();

  return (
    <DocsPage>
      <DocsTitle>{page.title}</DocsTitle>
      <DocsDescription>{page.description}</DocsDescription>
      <DocsBody>
        {page.content}
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return docsStaticParams();
}

export async function generateMetadata(props: { params: Promise<{ slug?: string[] }> }) {
  const params = await props.params;
  const page = getDocsPage(params.slug);
  if (!page) notFound();

  return {
    title: page.title,
    description: page.description
  };
}
