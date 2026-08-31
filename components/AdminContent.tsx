"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Book, BookCreate, buildLanguageDetails } from "@/lib/models/Book";
import {
  Loader2,
  Plus,
  Trash2,
  Search,
  User,
  Mail,
  Calendar,
  Edit,
  Save,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface AdminContentProps {
  user: any;
}

export default function AdminContent({ user }: AdminContentProps) {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [bookToDelete, setBookToDelete] = useState<Book | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Book> | null>(null);
  const [editTagsInput, setEditTagsInput] = useState("");
  const [editLanguagesInput, setEditLanguagesInput] = useState("");
  const [editLanguageCodesInput, setEditLanguageCodesInput] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [newBook, setNewBook] = useState<BookCreate>({
    title: "",
    author: "",
    publisher_year: "",
    location: "",
  });
  // Теги и языки вводятся как строка через запятую (как в исходном CSV
  // arcticlab_lib) и разбираются в массивы перед отправкой на бэкенд.
  const [newTagsInput, setNewTagsInput] = useState("");
  const [newLanguagesInput, setNewLanguagesInput] = useState("");
  const [newLanguageCodesInput, setNewLanguageCodesInput] = useState("");

  const parseCommaList = (value: string) =>
    value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  // Debounce для поиска
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    loadBooks();
  }, [debouncedSearch]);

  const loadBooks = async () => {
    setLoading(true);
    try {
      const url = new URL("/api/books", window.location.origin);
      url.searchParams.set("admin", "true");
      if (debouncedSearch) {
        url.searchParams.set("q", debouncedSearch);
      }

      const response = await fetch(url.toString());
      if (response.ok) {
        const data = await response.json();
        setBooks(data.books || []);
      } else {
        toast.error("Не удалось загрузить книги");
      }
    } catch (error) {
      console.error("Error loading books:", error);
      toast.error("Ошибка при загрузке книг");
    } finally {
      setLoading(false);
    }
  };

  const handleAddBook = async (e: React.FormEvent) => {
    e.preventDefault();

    const bookToCreate: BookCreate = {
      ...newBook,
      tags: parseCommaList(newTagsInput),
      languages: parseCommaList(newLanguagesInput),
      languageCodes: parseCommaList(newLanguageCodesInput),
    };

    try {
      const response = await fetch("/api/books", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bookToCreate),
      });

      if (response.ok) {
        setNewBook({
          title: "",
          author: "",
          publisher_year: "",
          location: "",
        });
        setNewTagsInput("");
        setNewLanguagesInput("");
        setNewLanguageCodesInput("");
        setShowAddForm(false);
        loadBooks();
        toast.success("Книга добавлена успешно!");
      } else {
        toast.error("Ошибка при добавлении книги");
      }
    } catch (error) {
      toast.error("Ошибка при добавлении книги");
    }
  };

  const handleDeleteClick = (book: Book) => {
    setBookToDelete(book);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!bookToDelete) return;

    setDeleteLoading(true);
    try {
      const response = await fetch(`/api/books/${bookToDelete._id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        loadBooks();
        toast.success("Книга удалена успешно!");
      } else {
        toast.error("Ошибка при удалении книги");
      }
    } catch (error) {
      toast.error("Ошибка при удалении книги");
    } finally {
      setDeleteLoading(false);
      setShowDeleteDialog(false);
      setBookToDelete(null);
    }
  };

  const handleEditClick = (book: Book) => {
    setEditingBookId(book._id!.toString());
    setEditFormData({
      title: book.title,
      author: book.author,
      publisher_year: book.publisher_year,
      location: book.location,
    });
    setEditTagsInput((book.tags || []).join(", "));
    setEditLanguagesInput((book.languages || []).join(", "));
    setEditLanguageCodesInput((book.languageCodes || []).join(", "));
  };

  const handleEditCancel = () => {
    setEditingBookId(null);
    setEditFormData(null);
    setEditTagsInput("");
    setEditLanguagesInput("");
    setEditLanguageCodesInput("");
  };

  const handleEditSave = async (bookId: string) => {
    if (!editFormData) return;

    const tags = parseCommaList(editTagsInput);
    const languages = parseCommaList(editLanguagesInput);
    const languageCodes = parseCommaList(editLanguageCodesInput);

    const payload: Partial<Book> = {
      ...editFormData,
      tags,
      languages,
      languageCodes,
      languageDetails: buildLanguageDetails(languages, languageCodes),
    };

    setEditLoading(true);
    try {
      const response = await fetch(`/api/books/${bookId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        await loadBooks();
        setEditingBookId(null);
        setEditFormData(null);
        setEditTagsInput("");
        setEditLanguagesInput("");
        setEditLanguageCodesInput("");
        toast.success("Книга обновлена успешно!");
      } else {
        const error = await response.json();
        toast.error(error.error || "Ошибка при обновлении книги");
      }
    } catch (error) {
      toast.error("Ошибка при обновлении книги");
    } finally {
      setEditLoading(false);
    }
  };

  const handleEditChange = (field: keyof Book, value: string) => {
    if (editFormData) {
      setEditFormData((prev) => ({
        ...prev,
        [field]: value || undefined,
      }));
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex md:justify-between md:items-center mb-6 flex-col md:flex-row">
        <div>
          <h1 className="text-3xl font-bold">Админ-панель</h1>
          <p className="text-muted-foreground my-5 md:my-0 md:mt-2">
            Добро пожаловать, {user.firstName} {user.lastName}
          </p>
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)}>
          <Plus className="h-4 w-4 mr-2" />
          Добавить книгу
        </Button>
      </div>

      {/* Поиск в админке */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            type="text"
            placeholder="Поиск книг..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchQuery && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
              onClick={clearSearch}
            >
              ×
            </Button>
          )}
        </div>
      </div>

      {showAddForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Добавить новую книгу</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddBook} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title" className="pb-2">
                    Название *
                  </Label>
                  <Input
                    id="title"
                    value={newBook.title}
                    onChange={(e) =>
                      setNewBook({ ...newBook, title: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="author" className="pb-2">
                    Автор
                  </Label>
                  <Input
                    id="author"
                    value={newBook.author}
                    onChange={(e) =>
                      setNewBook({ ...newBook, author: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="publisher_year" className="pb-2">
                    Издательство и год
                  </Label>
                  <Input
                    id="publisher_year"
                    value={newBook.publisher_year}
                    onChange={(e) =>
                      setNewBook({ ...newBook, publisher_year: e.target.value })
                    }
                    placeholder="Например: Эксмо, 2023"
                  />
                </div>
                <div>
                  <Label htmlFor="location" className="pb-2">
                    Место
                  </Label>
                  <Input
                    id="location"
                    value={newBook.location}
                    onChange={(e) =>
                      setNewBook({ ...newBook, location: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="tags" className="pb-2">
                    Теги (через запятую)
                  </Label>
                  <Input
                    id="tags"
                    value={newTagsInput}
                    onChange={(e) => setNewTagsInput(e.target.value)}
                    placeholder="Например: фольклор, ономастика"
                  />
                </div>
                <div>
                  <Label htmlFor="languages" className="pb-2">
                    Языки (через запятую)
                  </Label>
                  <Input
                    id="languages"
                    value={newLanguagesInput}
                    onChange={(e) => setNewLanguagesInput(e.target.value)}
                    placeholder="Например: русский, ненецкий"
                  />
                </div>
                <div>
                  <Label htmlFor="languageCodes" className="pb-2">
                    Коды языков (в том же порядке)
                  </Label>
                  <Input
                    id="languageCodes"
                    value={newLanguageCodesInput}
                    onChange={(e) => setNewLanguageCodesInput(e.target.value)}
                    placeholder="Например: rus, yrk"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit">Добавить книгу</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddForm(false)}
                >
                  Отмена
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            Список книг ({books.length})
            {debouncedSearch && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                по запросу "{debouncedSearch}"
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {books
              .filter((book) => !book.isAvailable)
              .concat(books.filter((book) => book.isAvailable))
              .map((book) => (
                <div
                  key={book._id!.toString()}
                  className="flex md:items-start md:justify-between p-4 border rounded-lg flex-col items-start gap-5 md:flex-row md:gap-0"
                >
                  <div className="flex-1">
                    {editingBookId === book._id!.toString() ? (
                      // Режим редактирования
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="edit-title" className='pb-2'>Название *</Label>
                            <Input
                              id="edit-title"
                              value={editFormData?.title || ""}
                              onChange={(e) =>
                                handleEditChange("title", e.target.value)
                              }
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="edit-author" className='pb-2'>Автор</Label>
                            <Input
                              id="edit-author"
                              value={editFormData?.author || ""}
                              onChange={(e) =>
                                handleEditChange("author", e.target.value)
                              }
                            />
                          </div>
                          <div>
                            <Label htmlFor="edit-publisher_year" className='pb-2'>
                              Издательство и год
                            </Label>
                            <Input
                              id="edit-publisher_year"
                              value={editFormData?.publisher_year || ""}
                              onChange={(e) =>
                                handleEditChange(
                                  "publisher_year",
                                  e.target.value
                                )
                              }
                            />
                          </div>
                          <div>
                            <Label htmlFor="edit-location" className='pb-2'>Место</Label>
                            <Input
                              id="edit-location"
                              value={editFormData?.location || ""}
                              onChange={(e) =>
                                handleEditChange("location", e.target.value)
                              }
                            />
                          </div>
                          <div>
                            <Label htmlFor="edit-tags" className='pb-2'>Теги (через запятую)</Label>
                            <Input
                              id="edit-tags"
                              value={editTagsInput}
                              onChange={(e) => setEditTagsInput(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label htmlFor="edit-languages" className='pb-2'>Языки (через запятую)</Label>
                            <Input
                              id="edit-languages"
                              value={editLanguagesInput}
                              onChange={(e) => setEditLanguagesInput(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label htmlFor="edit-language-codes" className='pb-2'>Коды языков (в том же порядке)</Label>
                            <Input
                              id="edit-language-codes"
                              value={editLanguageCodesInput}
                              onChange={(e) => setEditLanguageCodesInput(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleEditSave(book._id!.toString())}
                            disabled={editLoading}
                          >
                            {editLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <Save className="h-4 w-4 mr-2" />
                            )}
                            Сохранить
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleEditCancel}
                            disabled={editLoading}
                          >
                            <X className="h-4 w-4 mr-2" />
                            Отмена
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // Режим просмотра
                      <>
                        <div className="flex items-start flex-wrap justify-between mb-2">
                          <div className="flex gap-2 w-full justify-start pb-4">
                            <Badge
                              variant={
                                book.isAvailable ? "default" : "secondary"
                              }
                            >
                              {book.isAvailable ? "Доступна" : "Выдана"}
                            </Badge>
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">
                              {book.title}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              <strong>Автор:</strong>{" "}
                              {book.author || "Не указан"} •
                              <strong> Издательство и год:</strong>{" "}
                              {book.publisher_year || "Не указано"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              <strong>Место:</strong>{" "}
                              {book.location || "Не указано"}
                            </p>
                            {(book.tags?.length > 0 || book.languages?.length > 0) && (
                              <div className="flex gap-1 flex-wrap mt-1">
                                {book.tags?.map((tag) => (
                                  <Badge key={tag} variant="outline" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                                {book.languages?.map((lang, i) => (
                                  <Badge
                                    key={`${lang}-${i}`}
                                    variant="secondary"
                                    className="text-xs bg-blue-50 text-blue-700"
                                  >
                                    🌐 {lang}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Информация о текущем держателе */}
                        {!book.isAvailable && book.currentHolder && (() => {
                          const isOverdue =
                            new Date(book.currentHolder.dueDate).getTime() <
                            Date.now();
                          return (
                            <div
                              className={`mt-3 p-3 rounded-md w-full border ${
                                isOverdue
                                  ? "bg-red-50 border-red-300"
                                  : "bg-amber-50 border-amber-200"
                              }`}
                            >
                              <h4
                                className={`font-medium mb-2 flex items-center ${
                                  isOverdue ? "text-red-800" : "text-amber-800"
                                }`}
                              >
                                <User className="h-4 w-4 mr-2" />
                                Книга выдана:
                                {isOverdue && (
                                  <Badge
                                    variant="destructive"
                                    className="ml-2"
                                  >
                                    Просрочено
                                  </Badge>
                                )}
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                <div className="flex flex-wrap">
                                  <strong>Читатель:</strong>{" "}
                                  {book.currentHolder.userName}
                                </div>
                                <div className="flex items-center flex-wrap">
                                  <Mail className="h-3 w-3 mr-1" />
                                  <strong>Email:</strong>{" "}
                                  {book.currentHolder.userEmail}
                                </div>
                                {book.currentHolder.userTelegram && (
                                  <div className="flex flex-wrap">
                                    <strong>Telegram:</strong>{" "}
                                    {book.currentHolder.userTelegram}
                                  </div>
                                )}
                                <div
                                  className={`flex items-center flex-wrap ${
                                    isOverdue
                                      ? "text-red-700 font-medium"
                                      : ""
                                  }`}
                                >
                                  <Calendar className="h-3 w-3 mr-1" />
                                  <strong>Вернуть до:</strong>{" "}
                                  {format(
                                    new Date(book.currentHolder.dueDate),
                                    "dd.MM.yyyy"
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>

                  {editingBookId !== book._id!.toString() && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditClick(book)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteClick(book)}
                        disabled={deleteLoading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
          </div>

          {books.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {debouncedSearch
                  ? "Книги по вашему запросу не найдены"
                  : "В библиотеке пока нет книг"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Диалог подтверждения удаления */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="max-w-5/6 sm:max-w-md mx-auto">
          <AlertDialogHeader className="text-center sm:text-left">
            <AlertDialogTitle className="text-lg sm:text-xl">
              Удаление книги
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm sm:text-base">
              Вы уверены, что хотите удалить книгу &quot;{bookToDelete?.title}
              &quot;? Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0">
            <AlertDialogCancel
              className="mt-0 sm:mt-0 order-2 sm:order-1 w-full sm:w-auto"
              disabled={deleteLoading}
            >
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteLoading}
              className="order-1 sm:order-2 w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Удаление...
                </>
              ) : (
                "Удалить книгу"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
