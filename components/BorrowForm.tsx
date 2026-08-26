"use client";

import { useState, useEffect } from "react";
import { Book } from "@/lib/models/Book";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { addDays, format } from "date-fns";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface BorrowFormProps {
  book: Book;
  onClose: () => void;
}

export function BorrowForm({ book, onClose }: BorrowFormProps) {
  const [dueDate, setDueDate] = useState(
    format(addDays(new Date(), 30), "yyyy-MM-dd")
  );
  const [currentBorrows, setCurrentBorrows] = useState(0);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    // Загружаем пользователя один раз при открытии формы
    const loadUser = async () => {
      try {
        const response = await fetch("/api/auth/user");
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
          setCurrentBorrows(userData.currentBorrows || 0);
        }
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };

    loadUser();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error("Пользователь не найден");
      return;
    }

    setLoading(true);

    if (currentBorrows >= 3) {
      toast.error("Вы не можете взять больше 3 книг одновременно");
      setLoading(false);
      return;
    }

    const borrowData = {
      bookId: book._id!.toString(),
      userId: user._id,
      userName: `${user.firstName} ${user.lastName}`,
      userEmail: user.email,
      userTelegram: user.telegram,
      borrowDate: new Date().toISOString(),
      dueDate: new Date(dueDate).toISOString(),
    };

    try {
      const response = await fetch("/api/borrow", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(borrowData),
      });

      if (response.ok) {
        toast.success("Заявка на книгу отправлена!");
        onClose();
        // Заменяем кастомные события на router.refresh
        router.refresh();
      } else {
        const error = await response.json();
        toast.error(error.error || "Ошибка при отправке заявки");
      }
    } catch (error) {
      toast.error("Ошибка при отправке заявки");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-5/6 sm:max-w-lg mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-center sm:text-left">
          <DialogTitle className="text-base sm:text-xl">
            Взять книгу: {book.title}
          </DialogTitle>
        </DialogHeader>

        {user && currentBorrows >= 3 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <p className="text-yellow-800 text-sm">
              <strong>Внимание:</strong> У вас уже {currentBorrows} книг.
              Максимальное количество - 3.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {user && (
            <>
              <div>
                <Label htmlFor="userName" className="pb-2">
                  Имя и фамилия
                </Label>
                <Input
                  id="userName"
                  value={`${user.firstName} ${user.lastName}`}
                  readOnly
                />
              </div>
              <div>
                <Label htmlFor="userEmail" className="pb-2">
                  Email
                </Label>
                <Input id="userEmail" value={user.email} readOnly />
              </div>
            </>
          )}
          <div>
            <Label htmlFor="dueDate" className="pb-2">
              Планируемая дата возврата
            </Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              min={format(new Date(), "yyyy-MM-dd")}
              max={format(addDays(new Date(), 30), "yyyy-MM-dd")}
              required
            />
            <p className="text-sm text-muted-foreground mt-1">
              Максимальный срок - 30 дней
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="submit"
              className="flex-1"
              disabled={!user || currentBorrows >= 3 || loading}
            >
              {loading
                ? "Отправка..."
                : currentBorrows >= 3
                ? "Превышен лимит книг"
                : "Отправить заявку"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Отмена
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
