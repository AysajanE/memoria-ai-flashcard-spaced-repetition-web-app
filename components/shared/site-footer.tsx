export function SiteFooter() {
  return (
    <footer className="border-t py-6 md:py-0">
      <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
        <div className="text-center text-sm leading-loose text-muted-foreground md:text-left">
          Built by{" "}
          <a
            href="https://github.com/aeziz"
            target="_blank"
            rel="noreferrer"
            className="font-medium underline underline-offset-4"
          >
            aeziz
          </a>
          . The source code is available on{" "}
          <a
            href="https://github.com/aeziz/memoria-ai-flashcard-spaced-repetition-web-app"
            target="_blank"
            rel="noreferrer"
            className="font-medium underline underline-offset-4"
          >
            GitHub
          </a>
          .
        </div>
      </div>
    </footer>
  )
} 