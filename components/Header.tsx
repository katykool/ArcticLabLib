"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { User, LogOut, Settings, Loader2, Menu, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { useRouter, usePathname } from "next/navigation";
import Link from 'next/link';

export function Header() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Закрываем меню при смене роута
  useEffect(() => {
    setMobileMenuOpen(false);
    document.body.classList.remove("menu-open");
  }, [pathname]);

  // Управляем состоянием body при открытии/закрытии меню
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.classList.add("menu-open");
    } else {
      document.body.classList.remove("menu-open");
    }
  }, [mobileMenuOpen]);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/auth/user");
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      }
    } catch (error) {
      console.error("Auth check failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      toast.success("Выход выполнен", {
        description: "Вы успешно вышли из системы",
      });
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Ошибка", {
        description: "Не удалось выйти из системы",
      });
    } finally {
      setUser(null);
      setMobileMenuOpen(false);
      document.body.classList.remove("menu-open");
      router.push("/");
      setTimeout(() => router.refresh(), 100);
    }
  };

  const navigateTo = (path: string) => {
    setMobileMenuOpen(false);
    document.body.classList.remove("menu-open");
    router.push(path);
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <>
      <header className="border-b bg-background sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Логотип и название */}
            <Link href='/' className="flex items-center">
              <h1 className="text-xl sm:text-2xl font-bold">📚 Библиотека</h1>
            </Link>

            {/* Десктопное меню */}
            <div className="hidden md:flex items-center gap-4">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : user ? (
                <>
                  <div className="flex items-center gap-3">
                    <div className="hidden lg:flex items-center gap-2 text-sm">
                      <User className="h-4 w-4" />
                      <span className="max-w-[120px] truncate">
                        {user.firstName} {user.lastName}
                      </span>
                      <span className="text-muted-foreground">
                        ({user.currentBorrows}/3 книг)
                      </span>
                      {user.isAdmin && (
                        <Badge variant="secondary" className="text-xs">
                          Админ
                        </Badge>
                      )}
                    </div>

                    {user.isAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigateTo("/admin")}
                        className="hidden sm:flex"
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Админка
                      </Button>
                    )}

                    <Button variant="outline" size="sm" onClick={handleLogout}>
                      <LogOut className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Выйти</span>
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigateTo("/auth/login")}
                  >
                    Войти
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => navigateTo("/auth/register")}
                  >
                    Регистрация
                  </Button>
                </div>
              )}
            </div>

            {/* Мобильное меню - кнопка */}
            <div className="flex md:hidden items-center gap-2">
              {user?.isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateTo("/admin")}
                  className="sm:hidden"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={toggleMobileMenu}>
                {mobileMenuOpen ? (
                  <X className="h-4 w-4" />
                ) : (
                  <Menu className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Мобильное меню - выпадашка */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-16 z-40 bg-background/95 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-6">
            <div className="space-y-4">
              {loading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : user ? (
                <>
                  {/* Информация о пользователе */}
                  <div className="text-center border-b pb-4">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <User className="h-5 w-5" />
                      <span className="font-semibold">
                        {user.firstName} {user.lastName}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>Книг на руках: {user.currentBorrows}/3</p>
                      {user.isAdmin && (
                        <Badge variant="secondary">Администратор</Badge>
                      )}
                    </div>
                  </div>

                  {/* Навигация */}
                  <div className="space-y-2">
                    {user.isAdmin && (
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => navigateTo("/admin")}
                      >
                        <Settings className="h-4 w-4 mr-3" />
                        Админ-панель
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      className="w-full justify-start text-destructive"
                      onClick={handleLogout}
                    >
                      <LogOut className="h-4 w-4 mr-3" />
                      Выйти
                    </Button>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <Button
                    className="w-full"
                    onClick={() => navigateTo("/auth/login")}
                  >
                    Войти
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => navigateTo("/auth/register")}
                  >
                    Регистрация
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
