import { promises as fs } from "fs";
import path from "path";
import Link from "next/link";
import matter from "gray-matter";

interface Article {
  slug: string;
  title: string;
  description?: string;
}

async function getArticles(): Promise<Article[]> {
  const articlesDirectory = path.join(process.cwd(), "content/articles");
  const files = await fs.readdir(articlesDirectory);

  const articles = await Promise.all(
    files
      .filter((file) => file.endsWith(".md"))
      .map(async (file) => {
        const filePath = path.join(articlesDirectory, file);
        const fileContent = await fs.readFile(filePath, "utf8");
        const { data } = matter(fileContent);
        const slug = file.replace(/\.md$/, "");

        return {
          slug,
          title: data.title || slug.replace(/-/g, " "),
          description: data.description,
        };
      })
  );

  return articles;
}

export default async function ArticlesPage() {
  const articles = await getArticles();

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-8">Educational Articles</h1>
      <div className="grid gap-6">
        {articles.map((article) => (
          <Link
            key={article.slug}
            href={`/articles/${article.slug}`}
            className="block p-6 rounded-lg border bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow"
          >
            <h2 className="text-2xl font-semibold mb-2">{article.title}</h2>
            {article.description && (
              <p className="text-muted-foreground">{article.description}</p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
} 