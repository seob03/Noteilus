import React, { useState, useEffect } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { SettingsPage } from "./components/SettingsPage";
import { LoginPage } from "./components/LoginPage";
import { PdfDetailPage } from "./components/PdfDetailPage";
import { MainPage } from "./components/MainPage";

interface Document {
  id: string;
  name: string;
  type: "pdf" | "folder";
  children?: Document[];
  previewImage?: string;
}

type Page = "main" | "settings" | "login" | "pdf-detail";

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>("main");
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail] = useState("junpio0812@gmail.com");
  const [selectedPdf, setSelectedPdf] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // 다크모드 적용
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  const handleSettingsClick = () => {
    setCurrentPage("settings");
  };

  const handleBackToMain = () => {
    setCurrentPage("main");
    setSelectedPdf(null);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentPage("main");
  };

  const handleToggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handleLoginClick = () => {
    setCurrentPage("login");
  };

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
    setCurrentPage("main");
  };

  const handlePdfClick = (doc: Document) => {
    if (doc.type === "pdf" && doc.id !== "add") {
      setSelectedPdf({ id: doc.id, name: doc.name });
      setCurrentPage("pdf-detail");
    }
  };

  // PDF 상세 페이지
  if (currentPage === "pdf-detail" && selectedPdf) {
    return (
      <PdfDetailPage
        pdfId={selectedPdf.id}
        pdfName={selectedPdf.name}
        onBack={handleBackToMain}
        isDarkMode={isDarkMode}
      />
    );
  }

  // 로그인 페이지
  if (currentPage === "login") {
    return (
      <LoginPage
        onLoginSuccess={handleLoginSuccess}
        isDarkMode={isDarkMode}
      />
    );
  }

  // 설정 페이지
  if (currentPage === "settings") {
    return (
      <SettingsPage
        onBack={handleBackToMain}
        onLogout={handleLogout}
        isDarkMode={isDarkMode}
        onToggleDarkMode={handleToggleDarkMode}
        userEmail={userEmail}
      />
    );
  }

  // 메인 페이지
  return (
    <DndProvider backend={HTML5Backend}>
      <MainPage
        isDarkMode={isDarkMode}
        isLoggedIn={isLoggedIn}
        userEmail={userEmail}
        onSettingsClick={handleSettingsClick}
        onLoginClick={handleLoginClick}
        onPdfClick={handlePdfClick}
      />
    </DndProvider>
  );
}