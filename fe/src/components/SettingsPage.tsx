import React from 'react';
import { ChevronLeft, Settings, Check, Moon, Sun } from 'lucide-react';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Separator } from './ui/separator';

interface SettingsPageProps {
  onBack: () => void;
  onLoginClick: () => void;
  onLogout: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  isLoggedIn: boolean;
  userEmail: string | null;
  userName: string;
  userPicture: string | null;
  userProvider: string | null;
}

export function SettingsPage({ onBack, onLoginClick, onLogout, isDarkMode, onToggleDarkMode, isLoggedIn, userEmail, userName, userPicture, userProvider }: SettingsPageProps) {
  return (
    <div className={`min-h-screen flex ${isDarkMode ? 'dark' : ''}`}>
      {/* 좌측 사이드바 */}
      <div className={`w-80 ${isDarkMode ? 'bg-[#121214]' : 'bg-white'} p-6 flex-shrink-0 border-r ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        {/* 뒤로가기 버튼 */}
        <Button
          variant="ghost"
          onClick={onBack}
          className={`${isDarkMode ? 'text-[#efefef] hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'} mb-6 p-2`}
        >
          <ChevronLeft size={20} />
        </Button>

        {/* 계정 정보 */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 bg-[#d9d9d9] rounded-full flex items-center justify-center">
            {isLoggedIn && userPicture ? (
              <img
              src={userPicture}
              alt="프로필"
              className="w-full h-full object-cover rounded-full"
              />
            ) : (
              <span className="text-black font-medium">
                {isLoggedIn? (userEmail ? userEmail.charAt(0).toUpperCase() : userName.charAt(0).toUpperCase()) : 'G'}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`${isDarkMode ? 'text-[#efefef]' : 'text-gray-700'} text-sm truncate`}>{userEmail? (userEmail):(userName)}</p>
          </div>
          <Settings size={16} className={`${isDarkMode ? 'text-[#efefef]' : 'text-gray-600'}`} />
        </div>

        {/* 내 문서 (비활성화) */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[#888] cursor-not-allowed">
            <span>내 문서</span>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className={`flex-1 ${isDarkMode ? 'bg-[#1A1A1E]' : 'bg-[#f5f5f5]'} p-6 md:p-8`}>
        <div className="max-w-4xl mx-auto">
          <h1 className={`text-2xl font-semibold ${isDarkMode ? 'text-[#efefef]' : 'text-gray-900'} mb-8`}>설정</h1>

          <div className="space-y-8">
            {/* 계정 섹션 */}
            <div>
              <h2 className={`text-xl font-medium ${isDarkMode ? 'text-[#efefef]' : 'text-gray-900'} mb-4`}>계정</h2>
              <Separator className={`mb-6 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
              
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className={`font-medium ${isDarkMode ? 'text-[#efefef]' : 'text-gray-900'}`}>소셜 로그인</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {userProvider ? (
                      <>
                        <span className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{userProvider}</span>
                        <Check size={16} className="text-blue-500" />
                      </>
                    ): 
                      <Button
                        onClick={() => {
                        onLoginClick();
                        }}
                        className="bg-blue-500 hover:bg-blue-600 text-white"
                      >
                        로그인
                      </Button>
                    }
                  </div>
                </div>

                {(isLoggedIn) ?
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className={`font-medium ${isDarkMode ? 'text-[#efefef]' : 'text-gray-900'}`}>로그아웃</p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={onLogout}
                    className={`text-sm ${isDarkMode ? 'border-gray-600 text-[#efefef] hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                  >
                    로그아웃
                  </Button>

                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className={`font-medium ${isDarkMode ? 'text-[#efefef]' : 'text-gray-900'}`}>탈퇴하기</p>
                    </div>
                    <Button
                      variant="outline"
                      className="text-sm text-destructive border-destructive hover:bg-destructive/10"
                    >
                      탈퇴
                    </Button>
                  </div>
                </div>
                : null}
              </div>
            </div>

            {/* 결제 섹션 */}
            <div>
              <h2 className={`text-xl font-medium ${isDarkMode ? 'text-[#efefef]' : 'text-gray-900'} mb-4`}>결제</h2>
              <Separator className={`mb-6 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
              
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className={`font-medium ${isDarkMode ? 'text-[#efefef]' : 'text-gray-900'}`}>현재 플랜</p>
                  </div>
                  <span className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>무료</span>
                </div>

                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className={`font-medium ${isDarkMode ? 'text-[#efefef]' : 'text-gray-900'}`}>결제 방법 추가</p>
                  </div>
                  <Button 
                    variant="outline" 
                    className={`text-sm ${isDarkMode ? 'border-gray-600 text-[#efefef] hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                  >
                    추가
                  </Button>
                </div>

                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-destructive">구독 취소</p>
                  </div>
                  <Button
                    variant="outline"
                    className="text-sm text-destructive border-destructive hover:bg-destructive/10"
                  >
                    취소
                  </Button>
                </div>
              </div>
            </div>

            {/* 언어 섹션 */}
            <div>
              <h2 className={`text-xl font-medium ${isDarkMode ? 'text-[#efefef]' : 'text-gray-900'} mb-4`}>언어</h2>
              <Separator className={`mb-6 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
              
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <span className={`font-medium ${isDarkMode ? 'text-[#efefef]' : 'text-gray-900'}`}>English</span>
                  </div>
                  <div className="w-5 h-5 rounded-full border-2 border-gray-400"></div>
                </div>

                <div className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <span className={`font-medium ${isDarkMode ? 'text-[#efefef]' : 'text-gray-900'}`}>한국어</span>
                  </div>
                  <div className="w-5 h-5 rounded-full bg-blue-500 border-2 border-blue-500 flex items-center justify-center">
                    <Check size={12} className="text-white" />
                  </div>
                </div>
              </div>
            </div>

            {/* 디자인 섹션 */}
            <div>
              <h2 className={`text-xl font-medium ${isDarkMode ? 'text-[#efefef]' : 'text-gray-900'} mb-4`}>디자인</h2>
              <Separator className={`mb-6 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
              
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      {isDarkMode ? <Moon size={16} className="text-[#efefef]" /> : <Sun size={16} className="text-gray-600" />}
                      <span className={`font-medium ${isDarkMode ? 'text-[#efefef]' : 'text-gray-900'}`}>다크 모드</span>
                    </div>
                  </div>
                  <Switch
                    checked={isDarkMode}
                    onCheckedChange={onToggleDarkMode}
                  />
                </div>
              </div>
            </div>

            {/* 피드백 섹션 */}
            <div className="pt-8">
              <Button
                variant="secondary"
                className={`w-full max-w-md mx-auto flex ${isDarkMode ? 'bg-[#121214] text-[#d9d9d9] hover:bg-[#2A2A2E]' : 'bg-white text-gray-700 hover:bg-gray-50'} border-0`}
              >
                피드백 보내기
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}