import imgImage6 from "figma:asset/e9a0d61373704e4596ea1173caa9d1de420f2698.png";
import imgImage7 from "figma:asset/6353026fb0e2862bc1a5ad996e0f0d7d95afd10c.png";

function Group5() {
  return (
    <div className="h-[20.5px] relative w-3">
      <div className="absolute inset-[-4.88%_-8.33%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 14 23">
          <g id="Group 2">
            <path d="M1 1L13 11.049" id="Vector 1" stroke="var(--stroke-0, #EFEFEF)" strokeLinecap="round" strokeWidth="2" />
            <path d="M1 21.5L13 11.451" id="Vector 2" stroke="var(--stroke-0, #EFEFEF)" strokeLinecap="round" strokeWidth="2" />
          </g>
        </svg>
      </div>
    </div>
  );
}

export default function PdfDetailpage() {
  return (
    <div className="bg-[#1a1a1e] relative size-full" data-name="PDF_Detailpage">
      <div className="absolute bg-center bg-cover bg-no-repeat h-[582px] left-[252px] top-[89px] w-[775px]" data-name="image 6" style={{ backgroundImage: `url('${imgImage6}')` }} />
      <div className="absolute flex h-[20.5px] items-center justify-center left-10 top-4 w-3">
        <div className="flex-none rotate-[180deg] scale-y-[-100%]">
          <Group5 />
        </div>
      </div>
      <div className="absolute font-['Inter:Regular',_sans-serif] font-normal leading-[0] left-[517px] not-italic text-[#ffffff] text-[18px] text-nowrap top-[15px]">
        <p className="leading-[normal] whitespace-pre">Week 4 Data preprocessiong</p>
      </div>
      <div className="absolute bg-center bg-cover bg-no-repeat h-[582px] left-[252px] top-[731px] w-[776px]" data-name="image 7" style={{ backgroundImage: `url('${imgImage7}')` }} />
      <div className="absolute flex flex-col font-['Inter:Regular',_'Noto_Sans_KR:Regular',_sans-serif] font-normal justify-center leading-[normal] left-[474px] not-italic text-[#ffffff] text-[12px] text-center text-nowrap top-[70px] translate-x-[-50%] translate-y-[-50%] whitespace-pre">
        <p className="mb-0">{`필기 `}</p>
        <p>버튼</p>
      </div>
      <div className="absolute flex flex-col font-['Inter:Regular',_'Noto_Sans_KR:Regular',_sans-serif] font-normal justify-center leading-[normal] left-[514.5px] not-italic text-[#ffffff] text-[12px] text-center text-nowrap top-[70px] translate-x-[-50%] translate-y-[-50%] whitespace-pre">
        <p className="mb-0">형광</p>
        <p>펜</p>
      </div>
      <div className="absolute flex flex-col font-['Inter:Regular',_'Noto_Sans_KR:Regular',_sans-serif] font-normal justify-center leading-[0] left-[558px] not-italic text-[#ffffff] text-[12px] text-center text-nowrap top-[70.5px] translate-x-[-50%] translate-y-[-50%]">
        <p className="leading-[normal] whitespace-pre">지우개</p>
      </div>
      <div className="absolute flex flex-col font-['Inter:Regular',_'Noto_Sans_KR:Regular',_sans-serif] font-normal justify-center leading-[0] left-[651px] not-italic text-[#ffffff] text-[12px] text-center text-nowrap top-[70.5px] translate-x-[-50%] translate-y-[-50%]">
        <p className="leading-[normal] whitespace-pre">{`색상 선택1   2    3`}</p>
      </div>
      <div className="absolute flex flex-col font-['Inter:Regular',_'Noto_Sans_KR:Regular',_sans-serif] font-normal justify-center leading-[0] left-[774px] not-italic text-[#ffffff] text-[12px] text-center text-nowrap top-[70.5px] translate-x-[-50%] translate-y-[-50%]">
        <p className="leading-[normal] whitespace-pre">{`굵기 선택1   2    3`}</p>
      </div>
    </div>
  );
}