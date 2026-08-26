"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { Tag } from "@/lib/models/Tag";
import { LanguageTree } from "@/components/LanguageTree";

interface TagLanguageFilterProps {
  initialTag?: string;
  initialLang?: string;
}

export function TagLanguageFilter({
  initialTag = "",
  initialLang = "",
}: TagLanguageFilterProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedTags = initialTag
    ? initialTag.split(",").filter(Boolean)
    : [];

  const selectedLanguages = initialLang
    ? initialLang.split(",").filter(Boolean)
    : [];

  useEffect(() => {
    fetch("/api/tags")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Не удалось загрузить теги");
        }

        return response.json();
      })
      .then((data) => {
        setTags(data.tags || []);
      })
      .catch((error) => {
        console.error("Tags error:", error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const updateFilters = (
    languages: string[],
    tagList: string[]
  ) => {
    const params = new URLSearchParams(searchParams);

    if (languages.length > 0) {
      params.set("lang", languages.join(","));
    } else {
      params.delete("lang");
    }

    if (tagList.length > 0) {
      params.set("tag", tagList.join(","));
    } else {
      params.delete("tag");
    }

    params.delete("page");

    router.push(`/?${params.toString()}`, {
      scroll: false,
    });
  };

  const toggleTag = (tagName: string) => {
    const nextTags = selectedTags.includes(tagName)
      ? selectedTags.filter((tag) => tag !== tagName)
      : [...selectedTags, tagName];

    updateFilters(selectedLanguages, nextTags);
  };

  const clearFilters = () => {
    const params = new URLSearchParams(searchParams);

    params.delete("tag");
    params.delete("lang");
    params.delete("page");

    router.push(`/?${params.toString()}`, {
      scroll: false,
    });
  };

  const hasActiveFilters =
    selectedTags.length > 0 ||
    selectedLanguages.length > 0;

  return (
    <div className="w-full max-w-5xl mx-auto mt-3">
      {/* На компьютере блоки рядом, на мобильном друг под другом */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        {/* ==================== ТЕГИ ==================== */}

        <div className="w-full rounded-md border bg-background">
          <div className="border-b px-3 py-2">
            <span className="text-sm font-medium">
              Теги
              {selectedTags.length > 0 &&
                ` (${selectedTags.length})`}
            </span>
          </div>

          <div className="max-h-96 overflow-y-auto p-2">
            {loading ? (
              <div className="text-sm text-muted-foreground">
                Загружаем теги...
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {tags.map((tag) => {
                  const selected =
                    selectedTags.includes(tag.name);

                  return (
                    <label
                      key={tag.name}
                      className={`flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer text-sm ${
                        selected
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-muted"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleTag(tag.name)}
                        className="h-4 w-4 shrink-0"
                      />

                      <span className="truncate">
                        {tag.name}
                      </span>

                      <span className="ml-auto text-xs text-muted-foreground">
                        {tag.bookCount}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {selectedTags.length > 0 && (
            <div className="border-t px-3 py-2">
              <button
                type="button"
                onClick={() =>
                  updateFilters(
                    selectedLanguages,
                    []
                  )
                }
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Сбросить теги
              </button>
            </div>
          )}
        </div>

        {/* ==================== ЯЗЫКИ ==================== */}

        <div className="w-full">
          <LanguageTree
            value={selectedLanguages}
            onChange={(languages) =>
              updateFilters(
                languages,
                selectedTags
              )
            }
            disabled={loading}
          />
        </div>
      </div>

      {/* ==================== СБРОС ВСЕХ ФИЛЬТРОВ ==================== */}

      {hasActiveFilters && (
        <div className="flex justify-center mt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-9 text-muted-foreground"
          >
            <X className="h-3 w-3 mr-1" />
            Сбросить все фильтры
          </Button>
        </div>
      )}
    </div>
  );
}
