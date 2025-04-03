import { promises as fs } from "fs";
import path from "path";
import { notFound } from "next/navigation";
import matter from "gray-matter";
import Link from "next/link";
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
    <div className="container py-8 animate-fade-in">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <Link 
            href="/articles" 
            className="inline-flex items-center text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 mb-4"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to articles
          </Link>
          
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-500">
            {article.title}
          </h1>
        </div>
        
        <div className="prose prose-lg dark:prose-invert prose-indigo max-w-none">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-8 shadow-sm">
            <MarkdownRenderer content={article.content} />
          </div>
        </div>
        
        <div className="mt-12 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-xl p-6 border border-indigo-100 dark:border-indigo-800">
            <h3 className="text-xl font-bold mb-3">Ready to apply what you&apos;ve learned?</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Create flashcards based on this article and start practicing with spaced repetition.
            </p>
            <Link 
              href="/create" 
              className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium rounded-lg transition-all shadow-md hover:shadow-lg"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Create Flashcards
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}