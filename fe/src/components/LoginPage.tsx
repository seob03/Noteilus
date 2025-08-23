import React from 'react';
import svgPaths from "../imports/svg-q4vrb42rx";
import { Button } from './ui/button';

interface LoginPageProps {
  onLoginSuccess: () => void;
  isDarkMode: boolean;
}

function GoogleIcon() {
  return (
    <div className="w-8 h-8 flex-shrink-0">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 34 34">
        <g>
          <path d={svgPaths.p23f88200} fill="#FFC107" />
          <path d={svgPaths.p34bc1500} fill="#FF3D00" />
          <path d={svgPaths.p1d4f7280} fill="#4CAF50" />
          <path d={svgPaths.p29fa1700} fill="#1976D2" />
        </g>
      </svg>
    </div>
  );
}

function KakaoIcon() {
  return (
    <div className="w-12 h-12 flex-shrink-0">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 48 48">
        <g>
          <path d={svgPaths.p203f3e00} fill="#263238" />
          <path d={svgPaths.paaa7f80} fill="#FFCA28" />
          <path d={svgPaths.p1ea9f0c0} fill="#FFCA28" />
          <path d={svgPaths.p18a143f2} fill="#FFCA28" />
          <path d={svgPaths.p1f742800} fill="#FFCA28" />
          <path d={svgPaths.p15d6c780} fill="#FFCA28" />
          <path d={svgPaths.p294d7b80} fill="#FFCA28" />
          <path d={svgPaths.pcf90100} fill="#FFCA28" />
          <path d={svgPaths.p16ed9930} fill="#FFCA28" />
        </g>
      </svg>
    </div>
  );
}

function NoteilusLogo() {
  return (
    <div className="w-40 h-60 mx-auto mb-8 flex items-center justify-center">
      {/* 배경 제거하고 로고만 표시 */}
      <div className="w-32 h-32 bg-white rounded-2xl flex items-center justify-center shadow-lg">
        <svg viewBox="0 0 100 100" className="w-20 h-20">
          <g fill="#1a202c">
            {/* 닻 모양 로고 */}
            <path d="M50 10 L50 85 M35 70 Q50 85 65 70 M40 25 L60 25 M35 25 Q35 15 50 15 Q65 15 65 25" 
                  stroke="#1a202c" strokeWidth="4" fill="none" strokeLinecap="round"/>
            <circle cx="50" cy="25" r="8" fill="#1a202c"/>
          </g>
        </svg>
      </div>
    </div>
  );
}

export function LoginPage({ onLoginSuccess, isDarkMode }: LoginPageProps) {
  const handleLogin = (provider: string) => {
    console.log(`${provider} 로그인 시도`);
    // 실제 로그인 로직 구현
    onLoginSuccess();
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* 배경 이미지 - 검은 바다 파도 */}
      <div className="absolute inset-0 z-0">
        <div 
          className="w-full h-full bg-cover bg-center bg-no-repeat opacity-70"
          style={{ 
            backgroundImage: `url('https://images.unsplash.com/photo-1608383293352-f3dd3bcb0be9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkYXJrJTIwb2NlYW4lMjB3YXZlc3xlbnwxfHx8fDE3NTU5NDE3OTF8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral')` 
          }}
        />
        {/* 어두운 오버레이 */}
        <div className="absolute inset-0 bg-black/60"></div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* 로고 */}
          <NoteilusLogo />
          
          {/* 타이틀 */}
          <h1 className="text-4xl font-semibold text-white text-center mb-12">
            Noteilus
          </h1>

          {/* 로그인 버튼들 */}
          <div className="space-y-4">
            {/* Google 로그인 */}
            <Button
              onClick={() => handleLogin('Google')}
              variant="secondary"
              className="w-full h-14 bg-[#333030] hover:bg-[#404040] text-[#d9d9d9] border-0 flex items-center justify-center gap-4 text-lg font-semibold"
            >
              <GoogleIcon />
              Google 로그인
            </Button>

            {/* 카카오 로그인 */}
            <Button
              onClick={() => handleLogin('Kakao')}
              className="w-full h-14 bg-[#ffc107] hover:bg-[#ffca28] text-[#3e3b3b] border-0 flex items-center justify-center gap-4 text-lg font-semibold"
            >
              <KakaoIcon />
              카카오 로그인
            </Button>
          </div>

          {/* 추가 정보 */}
          <div className="mt-8 text-center">
            <p className="text-white/70 text-sm">
              로그인하여 AI 기반 노트 서비스를 시작하세요
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}