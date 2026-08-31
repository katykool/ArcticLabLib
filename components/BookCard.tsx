"use client";

import { Book } from "@/lib/models/Book";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BorrowForm } from "./BorrowForm";
import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Calendar, Loader2 } from "lucide-react";

interface BookCardProps {
  book: Book;
  dueDate?: string;
}

export function BookCard({
  book,
  dueDate,
}: BookCardProps) {
  const [showBorrowForm, setShowBorrowForm] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [showReturnDialog, setShowReturnDialog] =
    useState(false);

  const [titleExpanded, setTitleExpanded] =
    useState(false);

  const router = useRouter();

  const handleBorrowClick = async () => {
    // Проверяем авторизацию только при клике
    const response = await fetch("/api/auth/user");

    if (response.ok) {
      setShowBorrowForm(true);
    } else {
      router.push("/auth/login");
    }
  };

  const handleReturnClick = () => {
    setShowReturnDialog(true);
  };

  const handleReturnConfirm = async () => {
    setLoading(true);
    setShowReturnDialog(false);

    try {
      // Получаем пользователя для возврата
      const userResponse = await fetch(
        "/api/auth/user"
      );

      if (!userResponse.ok) {
        throw new Error(
          "Пользователь не авторизован"
        );
      }

      const user = await userResponse.json();

      // Находим запись о выдаче
      const borrowsResponse = await fetch(
        `/api/borrow?bookId=${book._id}&userId=${user._id}`
      );

      if (!borrowsResponse.ok) {
        throw new Error(
          "Не удалось найти запись о выдаче"
        );
      }

      const borrows =
        await borrowsResponse.json();

      // Ищем как обычную, так и просроченную выдачу
      const activeBorrow = borrows.find(
        (borrow: any) =>
          borrow.status === "active" ||
          borrow.status === "overdue"
      );

      if (!activeBorrow) {
        throw new Error(
          "Активная запись о выдаче не найдена"
        );
      }

      // Возвращаем книгу
      const returnResponse = await fetch(
        "/api/return",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            borrowId: activeBorrow._id,
          }),
        }
      );

      if (returnResponse.ok) {
        toast.success(
          "Книга успешно возвращена!"
        );

        router.refresh();
      } else {
        const error =
          await returnResponse.json();

        toast.error(
          error.error ||
            "Ошибка при возврате книги"
        );
      }
    } catch (error) {
      console.error(
        "Return error:",
        error
      );

      toast.error(
        "Ошибка при возврате книги"
      );
    } finally {
      setLoading(false);
    }
  };

  const getButtonState = () => {
    // Книга доступна — можно взять
    if (book.isAvailable) {
      return {
        text: "Взять книгу",
        disabled: false,
        action: handleBorrowClick,
        variant: "default" as const,
      };
    }

    // Книга выдана текущему пользователю —
    // можно вернуть
    if (book.isUserBook) {
      return {
        text: loading
          ? "Возврат..."
          : "Вернуть книгу",
        disabled: loading,
        action: handleReturnClick,
        variant: "outline" as const,
      };
    }

    // Книга выдана другому пользователю
    return {
      text: "Недоступна",
      disabled: true,
      action: () => {},
      variant: "secondary" as const,
    };
  };

  const buttonState =
    getButtonState();

  // Форматируем дату возврата
  const formattedDueDate = dueDate
    ? new Date(dueDate).toLocaleDateString(
        "ru-RU"
      )
    : null;

  // Проверяем, просрочена ли книга
  const isOverdue =
    !!dueDate &&
    new Date(dueDate).getTime() <
      Date.now();

  return (
    <>
      <Card
        className={`w-full max-w-sm flex flex-col transition-all duration-300 hover:shadow-lg ${
          book.isUserBook
            ? "ring-2 ring-blue-200 bg-blue-50/50"
            : ""
        }`}
      >
        <CardHeader
          className={
            book.isUserBook
              ? "bg-blue-50/30 rounded-t-lg"
              : ""
          }
        >
          <CardTitle
            onClick={() =>
              setTitleExpanded(
                (prev) => !prev
              )
            }
            className={`text-lg font-semibold cursor-pointer select-none ${
              titleExpanded
                ? ""
                : "line-clamp-2"
            }`}
            title={
              titleExpanded
                ? "Свернуть название"
                : "Показать полностью"
            }
          >
            {book.title}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-2 flex-1">
          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              <strong>Автор:</strong>{" "}
              {book.author ||
                "Не указан"}
            </p>

            <p>
              <strong>
                Издательство и год:
              </strong>{" "}
              {book.publisher_year ||
                "Не указано"}
            </p>

            <p>
              <strong>Место:</strong>{" "}
              {book.location ||
                "Не указано"}
            </p>
          </div>

          {book.tags &&
            book.tags.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {book.tags.map(
                  (tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="text-xs"
                    >
                      {tag}
                    </Badge>
                  )
                )}
              </div>
            )}

          {book.languages &&
            book.languages.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {book.languages.map(
                  (lang, i) => (
                    <Badge
                      key={`${lang}-${i}`}
                      variant="secondary"
                      className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100"
                    >
                      🌐 {lang}
                    </Badge>
                  )
                )}
              </div>
            )}

          <div className="flex gap-2 flex-wrap">
            <Badge
              variant={
                book.isAvailable
                  ? "default"
                  : "secondary"
              }
            >
              {book.isAvailable
                ? "Доступна"
                : "Выдана"}
            </Badge>

            {book.isUserBook && (
              <Badge
                variant="default"
                className="bg-green-500 hover:bg-green-600"
              >
                📚 Ваша книга
              </Badge>
            )}
          </div>

          {/* Срок возврата текущей книги */}
          {formattedDueDate && (
            <div
              className={`mt-3 rounded-lg border p-3 ${
                isOverdue
                  ? "border-red-300 bg-red-50"
                  : "border-blue-200 bg-blue-50"
              }`}
            >
              <div
                className={`flex items-center gap-2 text-sm font-medium ${
                  isOverdue
                    ? "text-red-700"
                    : "text-blue-700"
                }`}
              >
                <Calendar className="h-4 w-4" />

                <span>
                  {isOverdue
                    ? "🔴 Книга просрочена"
                    : "📅 Вернуть до:"}
                </span>
              </div>

              <div
                className={`mt-1 text-base font-semibold ${
                  isOverdue
                    ? "text-red-800"
                    : "text-blue-800"
                }`}
              >
                {formattedDueDate}
              </div>

              {isOverdue && (
                <div className="mt-1 text-xs text-red-700">
                  Пожалуйста, верните книгу
                  как можно скорее.
                </div>
              )}
            </div>
          )}
        </CardContent>

        <CardFooter>
          <Button
            onClick={buttonState.action}
            disabled={buttonState.disabled}
            className="w-full transition-all duration-200"
            variant={buttonState.variant}
            size="lg"
          >
            {buttonState.text}
          </Button>
        </CardFooter>
      </Card>

      {/* Диалог подтверждения возврата */}
      <AlertDialog
        open={showReturnDialog}
        onOpenChange={
          setShowReturnDialog
        }
      >
        <AlertDialogContent className="max-w-5/6 sm:max-w-md mx-auto">
          <AlertDialogHeader className="text-center sm:text-left">
            <AlertDialogTitle className="text-lg sm:text-xl">
              Возврат книги
            </AlertDialogTitle>

            <AlertDialogDescription className="text-sm sm:text-base">
              Вы уверены, что хотите
              вернуть книгу
              &quot;{book.title}&quot;?
              После возврата книга
              станет доступна для
              других читателей.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0">
            <AlertDialogCancel
              className="mt-0 sm:mt-0 order-2 sm:order-1 w-full sm:w-auto"
              disabled={loading}
            >
              Отмена
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={
                handleReturnConfirm
              }
              disabled={loading}
              className="order-1 sm:order-2 w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Возврат...
                </>
              ) : (
                "Вернуть книгу"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showBorrowForm && (
        <BorrowForm
          book={book}
          onClose={() =>
            setShowBorrowForm(false)
          }
        />
      )}
    </>
  );
}