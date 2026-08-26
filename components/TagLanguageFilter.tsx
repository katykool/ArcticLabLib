"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { Tag } from "@/lib/models/Tag";
import type { Language } from "@/lib/models/Language";

interface TagLanguageFilterProps {
  initialTag?: string;
  initialLang?: string;
}

// Фильтр по тегу и языку поверх текстового поиска. Списки подтягиваются из
// вспомогательных справочных коллекций tags/languages (см. /api/tags,
// /api/languages), которые пересобирает scripts/csv-to-mongo.ts — как в
// arcticlab_lib. Выбор пишется в URL (?tag=...&lang=...), поэтому фильтром
// можно поделиться ссылкой и он переживает переход по страницам.
export function TagLanguageFilter({
  initialTag = "",
  initialLang = "",
}: TagLanguageFilterProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    Promise.all([
      fetch("/api/tags").then((r) => (r.ok ? r.json() : { tags: [] })),
      fetch("/api/languages").then((r) => (r.ok ? r.json() : { languages: [] })),
    ])
      .then(([tagsData, langData]) => {
        setTags(tagsData.tags || []);
        setLanguages(langData.languages || []);
      })
      .catch((error) => {
        console.error("Error fetching filters:", error);
      })
      .finally(() => setLoading(false));
  }, []);

  const updateParam = (key: "tag" | "lang", value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    router.push(`/?${params.toString()}`, { scroll: false });
  };

  const clearFilters = () => {
    const params = new URLSearchParams(searchParams);
    params.delete("tag");
    params.delete("lang");
    params.delete("page");
    router.push(`/?${params.toString()}`, { scroll: false });
  };

  const hasActiveFilters = Boolean(initialTag || initialLang);

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 max-w-2xl mx-auto mt-3">
      <select
        value={initialTag}
        disabled={loading}
        onChange={(e) => updateParam("tag", e.target.value)}
        className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:opacity-50"
      >
        <option value="">Все теги</option>
        {tags.map((tag) => (
          <option key={tag.name} value={tag.name}>
            {tag.name} ({tag.bookCount})
          </option>
        ))}
      </select>

      <select
        value={initialLang}
        disabled={loading}
        onChange={(e) => updateParam("lang", e.target.value)}
        className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:opacity-50"
      >
        <option value="">Все языки</option>
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.name} ({lang.bookCount})
          </option>
        ))}
      </select>

      {hasActiveFilters && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="h-9 text-muted-foreground"
        >
          <X className="h-3 w-3 mr-1" />
          Сбросить фильтры
        </Button>
      )}
    </div>
  );
}
