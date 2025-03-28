import { promises as fs } from "fs";
import path from "path";
import { notFound } from "next/navigation";
import matter from "gray-matter";
import { MarkdownRenderer } from "@/components/shared/markdown-renderer";

interface ArticlePageProps {
  params: {
    slug: string;
  };
}

async function getArticle(slug: string) {
  const articlesDirectory = path.join(process.cwd(), "content/articles");
  const filePath = path.join(articlesDirectory, `${slug}.md`);

  try {
    const fileContent = await fs.readFile(filePath, "utf8");
    const { data, content } = matter(fileContent);

    return {
      title: data.title || slug.replace(/-/g, " "),
      content,
    };
  } catch (error) {
    return null;
  }
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const article = await getArticle(params.slug);

  if (!article) {
    notFound();
  }

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-8">{article.title}</h1>
      <MarkdownRenderer content={article.content} />
    </div>
  );
} 