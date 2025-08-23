import svgPaths from "./svg-q4vrb42rx";
import imgNoteilus1 from "figma:asset/8d34d069f1ab3a144106919d34d9111a8144edfc.png";

function Icons81() {
  return (
    <div className="absolute left-[479px] size-[34px] top-[501px]" data-name="icons8-구글-로고 1">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 34 34">
        <g id="icons8-áá®áá³á¯-áá©áá© 1">
          <path d={svgPaths.p23f88200} fill="var(--fill-0, #FFC107)" id="Vector" />
          <path d={svgPaths.p34bc1500} fill="var(--fill-0, #FF3D00)" id="Vector_2" />
          <path d={svgPaths.p1d4f7280} fill="var(--fill-0, #4CAF50)" id="Vector_3" />
          <path d={svgPaths.p29fa1700} fill="var(--fill-0, #1976D2)" id="Vector_4" />
        </g>
      </svg>
    </div>
  );
}

function Group9() {
  return (
    <div className="absolute contents left-[460px] top-[491px]">
      <div className="absolute bg-[#333030] h-[53px] left-[460px] rounded top-[491px] w-[360px]" />
      <Icons81 />
      <div className="absolute flex flex-col font-['Noto_Sans:Display_SemiBold',_'Noto_Sans_KR:Bold',_sans-serif] font-semibold justify-center leading-[0] left-[641.5px] text-[#d9d9d9] text-[24px] text-center text-nowrap top-[517.5px] translate-x-[-50%] translate-y-[-50%]" style={{ fontVariationSettings: "'CTGR' 100, 'wdth' 100" }}>
        <p className="leading-[normal] whitespace-pre">Google 로그인</p>
      </div>
    </div>
  );
}

function Icons82() {
  return (
    <div className="absolute left-[472px] size-12 top-[583px]" data-name="icons8-카카오-톡 1">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 48 48">
        <g id="icons8-áá¡áá¡áá©-áá©á¨ 1">
          <path d={svgPaths.p203f3e00} fill="var(--fill-0, #263238)" id="Vector" />
          <path d={svgPaths.paaa7f80} fill="var(--fill-0, #FFCA28)" id="Vector_2" />
          <path d={svgPaths.p1ea9f0c0} fill="var(--fill-0, #FFCA28)" id="Vector_3" />
          <path d={svgPaths.p18a143f2} fill="var(--fill-0, #FFCA28)" id="Vector_4" />
          <path d={svgPaths.p1f742800} fill="var(--fill-0, #FFCA28)" id="Vector_5" />
          <path d={svgPaths.p15d6c780} fill="var(--fill-0, #FFCA28)" id="Vector_6" />
          <path d={svgPaths.p294d7b80} fill="var(--fill-0, #FFCA28)" id="Vector_7" />
          <path d={svgPaths.pcf90100} fill="var(--fill-0, #FFCA28)" id="Vector_8" />
          <path d={svgPaths.p16ed9930} fill="var(--fill-0, #FFCA28)" id="Vector_9" />
        </g>
      </svg>
    </div>
  );
}

function Group10() {
  return (
    <div className="absolute contents left-[460px] top-[580px]">
      <div className="absolute bg-[#ffc107] h-[53px] left-[460px] rounded top-[580px] w-[360px]" />
      <Icons82 />
      <div className="absolute flex flex-col font-['Noto_Sans:Display_SemiBold',_'Noto_Sans_KR:Bold',_sans-serif] font-semibold justify-center leading-[0] left-[641.5px] text-[#3e3b3b] text-[24px] text-center text-nowrap top-[606.5px] translate-x-[-50%] translate-y-[-50%]" style={{ fontVariationSettings: "'CTGR' 100, 'wdth' 100" }}>
        <p className="leading-[normal] whitespace-pre">카카오 로그인</p>
      </div>
    </div>
  );
}

export default function SocialLogin() {
  return (
    <div className="bg-[#3e3b3b] relative size-full" data-name="Social Login">
      <div className="absolute flex flex-col font-['Noto_Sans:Display_SemiBold',_sans-serif] font-semibold justify-center leading-[0] left-[640px] text-[#efefef] text-[40px] text-center top-[428px] translate-x-[-50%] translate-y-[-50%] w-[276px]" style={{ fontVariationSettings: "'CTGR' 100, 'wdth' 100" }}>
        <p className="leading-[normal]">Noteilus</p>
      </div>
      <Group9 />
      <div className="absolute bg-[49.82%_29.22%] bg-no-repeat bg-size-[269.38%_234.24%] h-[276px] left-[562px] top-[113px] w-40" data-name="Noteilus 1" style={{ backgroundImage: `url('${imgNoteilus1}')` }} />
      <Group10 />
    </div>
  );
}