import { Tv } from "lucide-react";
import { Link } from "react-router-dom";
import { detailsHref, type DetailsHrefItem } from "../lib/detailsHref";

export function PosterCardLink({
  item,
  title,
  meta,
  className = "",
  parentOnly = true
}: {
  item: DetailsHrefItem & { posterUrl?: string | null };
  title?: string;
  meta?: string;
  className?: string;
  parentOnly?: boolean;
}) {
  const hrefItem = parentOnly ? { ...item, season: undefined, episode: undefined } : item;
  return (
    <Link
      to={detailsHref(hrefItem)}
      className={`group block overflow-hidden rounded-xl border bg-card text-left shadow-sm transition hover:border-primary ${className}`}
      draggable={false}
      data-no-drag="true"
    >
      <div className="aspect-[2/3] bg-muted">
        {item.posterUrl ? (
          <img
            src={item.posterUrl}
            alt=""
            draggable={false}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full place-items-center text-muted-foreground">
            <Tv className="h-7 w-7" />
          </div>
        )}
      </div>
      <div className="space-y-1 p-2.5">
        <p className="truncate text-xs font-semibold sm:text-sm">{title ?? item.title}</p>
        {meta ? <p className="truncate text-[11px] text-muted-foreground">{meta}</p> : null}
      </div>
    </Link>
  );
}

export const posterGridClass = "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10";
