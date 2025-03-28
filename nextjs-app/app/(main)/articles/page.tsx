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
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-500">
          Educational Articles
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2 max-w-3xl">
          Expand your knowledge about spaced repetition and effective learning techniques
        </p>
      </div>
      
      <div className="grid md:grid-cols-2 gap-6">
        {articles.map((article) => (
          <Link
            key={article.slug}
            href={`/articles/${article.slug}`}
            className="group block rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm hover:shadow-md transition-all"
          >
            <div className="h-2 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500"></div>
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg flex items-center justify-center mr-3 group-hover:scale-110 transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {article.title}
                </h2>
              </div>
              {article.description && (
                <p className="text-gray-600 dark:text-gray-400 line-clamp-3">{article.description}</p>
              )}
              <div className="mt-4 flex items-center text-sm font-medium text-indigo-600 dark:text-indigo-400">
                <span>Read article</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}