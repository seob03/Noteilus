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
  const [userEmail, setUserEmail] = useState("junpio0812@gmail.com");
  const [userName, setUserName] = useState("사용자");
  const [userPicture, setUserPicture] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // 로그인 상태 확인
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        console.log('로그인 상태 확인 시작...');
        const response = await fetch('/auth/me', {
          credentials: 'include'
        });
        
        console.log('로그인 상태 확인 응답:', response.status, response.statusText);
        
        if (response.ok) {
          const data = await response.json();
          console.log('로그인 상태 확인 성공:', data);
          setIsLoggedIn(true);
          setUserEmail(data.user.email);
          setUserName(data.user.name);
          setUserPicture(data.user.picture);
          setUserId(data.user.id);
          console.log('로그인 상태 확인됨:', data.user);
        } else {
          console.log('로그인되지 않음 - 응답:', response.status);
          setIsLoggedIn(false);
        }
      } catch (error) {
        console.error('로그인 상태 확인 실패:', error);
        setIsLoggedIn(false);
      }
    };

    checkAuthStatus();
  }, []);
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

  const handleLogout = async () => {
    try {
      // 서버에 로그아웃 요청
      const response = await fetch('/auth/logout', {
        method: 'GET',
        credentials: 'include'
      });

      if (response.ok) {
        console.log('로그아웃 성공');
        // 로컬 상태 업데이트
        setIsLoggedIn(false);
        setUserEmail("junpio0812@gmail.com");
        setUserName("사용자");
        setUserId(null);
        setCurrentPage("login");
      } else {
        console.error('로그아웃 실패:', response.status);
              // 실패해도 로컬 상태는 업데이트
      setIsLoggedIn(false);
      setUserId(null);
      setCurrentPage("login");
      }
    } catch (error) {
      console.error('로그아웃 요청 실패:', error);
      // 에러가 발생해도 로컬 상태는 업데이트
      setIsLoggedIn(false);
      setUserId(null);
      setCurrentPage("login");
    }
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
        userName={userName}
        userPicture={userPicture}
        userId={userId}
        onSettingsClick={handleSettingsClick}
        onLoginClick={handleLoginClick}
        onPdfClick={handlePdfClick}
      />
    </DndProvider>
  );
}