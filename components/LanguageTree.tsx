"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";

interface LanguageTreeNode {
  code: string;
  name: string;
  type: string;
  parentCode: string | null;
  level: number;
}

interface LanguageTreeProps {
  value?: string[];
  onChange: (codes: string[]) => void;
  disabled?: boolean;
}

export function LanguageTree({
  value = [],
  onChange,
  disabled = false,
}: LanguageTreeProps) {
  const [nodes, setNodes] = useState<LanguageTreeNode[]>([]);
  const [loading, setLoading] = useState(true);

  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(["root"])
  );

  /*
   * Загружаем дерево языков
   */
  useEffect(() => {
    fetch("/api/languages/tree")
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            "Не удалось загрузить дерево языков"
          );
        }

        return response.json();
      })
      .then((data) => {
        setNodes(data.nodes || []);
      })
      .catch((error) => {
        console.error(
          "Language tree error:",
          error
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  /*
   * Создаём карту:
   *
   * parentCode -> дети
   *
   * Например:
   *
   * root -> палеоазиатские
   * палеоазиатские -> чукотско-камчатские
   * чукотско-камчатские -> чукотский
   */
  const childrenMap = useMemo(() => {
    const map = new Map<
      string | null,
      LanguageTreeNode[]
    >();

    for (const node of nodes) {
      const parent = node.parentCode ?? null;

      if (!map.has(parent)) {
        map.set(parent, []);
      }

      map.get(parent)!.push(node);
    }

    return map;
  }, [nodes]);

  /*
   * Открыть / закрыть ветку
   */
  const toggleExpanded = (code: string) => {
    setExpanded((previous) => {
      const next = new Set(previous);

      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }

      return next;
    });
  };

  /*
   * Получить всех потомков узла
   */
  const getDescendantCodes = (
    code: string
  ): string[] => {
    const result: string[] = [];

    const collect = (parentCode: string) => {
      const children =
        childrenMap.get(parentCode) || [];

      for (const child of children) {
        result.push(child.code);
        collect(child.code);
      }
    };

    collect(code);

    return result;
  };

  /*
   * Проверяем, выбран ли узел
   */
  const isSelected = (code: string) => {
    return value.includes(code);
  };

  /*
   * Выбор узла.
   *
   * Если выбираем группу —
   * выбираются она и все её потомки.
   *
   * Если снимаем группу —
   * снимаются она и все её потомки.
   */
  const toggleNode = (
    node: LanguageTreeNode
  ) => {
    const descendants =
      getDescendantCodes(node.code);

    const allCodes = [
      node.code,
      ...descendants,
    ];

    const allSelected = allCodes.every(
      (code) => value.includes(code)
    );

    if (allSelected) {
      onChange(
        value.filter(
          (code) => !allCodes.includes(code)
        )
      );
    } else {
      const next = new Set(value);

      for (const code of allCodes) {
        next.add(code);
      }

      onChange(Array.from(next));
    }
  };

  /*
   * Раскрыть всё дерево
   */
  const expandAll = () => {
    setExpanded(
      new Set(
        nodes
          .filter(
            (node) =>
              (childrenMap.get(node.code) || [])
                .length > 0
          )
          .map((node) => node.code)
      )
    );
  };

  /*
   * Свернуть всё
   */
  const collapseAll = () => {
    setExpanded(new Set());
  };

  /*
   * Рендер дерева
   */
  const renderNodes = (
    parentCode: string | null,
    level = 0
  ): React.ReactNode => {
    const children =
      childrenMap.get(parentCode) || [];

    return children.map((node) => {
      const nodeChildren =
        childrenMap.get(node.code) || [];

      const hasChildren =
        nodeChildren.length > 0;

      const isExpanded =
        expanded.has(node.code);

      const selected =
        isSelected(node.code);

      return (
        <div key={node.code}>
          <div
            className={`flex items-center min-h-9 rounded-md transition-colors ${
              selected
                ? "bg-accent text-accent-foreground"
                : "hover:bg-muted"
            }`}
            style={{
              paddingLeft:
                `${level * 20 + 4}px`,
            }}
          >
            {/* Стрелка */}
            {hasChildren ? (
              <button
                type="button"
                disabled={disabled}
                onClick={() =>
                  toggleExpanded(node.code)
                }
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded hover:bg-muted-foreground/10"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            ) : (
              <span className="w-7 shrink-0" />
            )}

            {/* Чекбокс + название */}
            <label className="flex flex-1 items-center gap-2 cursor-pointer py-1.5 pr-2">
              <input
                type="checkbox"
                checked={selected}
                disabled={disabled}
                onChange={() =>
                  toggleNode(node)
                }
                className="h-4 w-4 shrink-0"
              />

              <span className="truncate text-sm">
                {node.code === "root"
                    ? "Все языки и места"
                    : node.name}
                </span>
            </label>
          </div>

          {/* Дочерние элементы */}
          {hasChildren && isExpanded && (
            <div>
              {renderNodes(
                node.code,
                level + 1
              )}
            </div>
          )}
        </div>
      );
    });
  };

  if (loading) {
    return (
      <div className="w-full rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground">
        Загружаем языки и места...
      </div>
    );
  }

  return (
    <div className="w-full rounded-md border bg-background">
      {/* Заголовок */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-medium">
          Языки и места
          {value.length > 0 &&
            ` (${value.length})`}
        </span>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={expandAll}
            disabled={disabled}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Все
          </button>

          <button
            type="button"
            onClick={collapseAll}
            disabled={disabled}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Свернуть
          </button>
        </div>
      </div>

      {/* Дерево */}
      <div className="max-h-96 overflow-y-auto p-1">
        {renderNodes(null)}
      </div>

      {/* Сброс языков */}
      {value.length > 0 && (
        <div className="border-t px-3 py-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange([])}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Сбросить языки
          </button>
        </div>
      )}
    </div>
  );
}
