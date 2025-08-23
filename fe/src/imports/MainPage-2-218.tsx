function Group3() {
  return (
    <div className="absolute contents left-[22px] top-[17px]">
      <div className="absolute flex h-[5px] items-center justify-center left-[22px] top-[34px] w-7">
        <div className="flex-none rotate-[180deg]">
          <div className="bg-[#d9d9d9] h-[5px] w-7" />
        </div>
      </div>
      <div className="absolute flex h-1 items-center justify-center left-[22px] top-[26px] w-7">
        <div className="flex-none rotate-[180deg]">
          <div className="bg-[#d9d9d9] h-1 w-7" />
        </div>
      </div>
      <div className="absolute flex h-[5px] items-center justify-center left-[22px] top-[17px] w-7">
        <div className="flex-none rotate-[180deg]">
          <div className="bg-[#d9d9d9] h-[5px] w-7" />
        </div>
      </div>
    </div>
  );
}

export default function MainPage() {
  return (
    <div className="bg-[#3e3b3b] relative size-full" data-name="Main Page">
      <div className="absolute flex flex-col font-['Inter:Regular',_'Noto_Sans_KR:Regular',_sans-serif] font-normal justify-center leading-[0] left-[640px] not-italic text-[#efefef] text-[24px] text-center top-[37.5px] translate-x-[-50%] translate-y-[-50%] w-[276px]">
        <p className="leading-[normal]">내 문서</p>
      </div>
      <div className="absolute flex flex-col font-['Inter:Regular',_'Noto_Sans_KR:Regular',_sans-serif] font-normal justify-center leading-[0] left-[1128px] not-italic text-[#efefef] text-[24px] text-center top-[37.5px] translate-x-[-50%] translate-y-[-50%] w-24">
        <p className="leading-[normal]">선택</p>
      </div>
      <div className="absolute flex flex-col font-['Inter:Regular',_'Noto_Sans_KR:Regular',_sans-serif] font-normal justify-center leading-[0] left-[1224px] not-italic text-[#efefef] text-[24px] text-center top-[37.5px] translate-x-[-50%] translate-y-[-50%] w-24">
        <p className="leading-[normal]">정렬</p>
      </div>
      <div className="absolute bg-[#d9d9d9] h-[140px] left-[72px] rounded top-[97px] w-[202px]" />
      <div className="absolute bg-[#d9d9d9] h-[140px] left-[409px] rounded top-[97px] w-[202px]" />
      <div className="absolute bg-[#4f88b7] h-[157px] left-[1051px] rounded top-[97px] w-[190px]" />
      <div className="absolute bg-[#d9d9d9] h-[140px] left-[730px] rounded top-[97px] w-[202px]" />
      <div className="absolute h-0 left-[146.5px] top-[160.5px] w-[41px]">
        <div className="absolute bottom-[-0.5px] left-0 right-0 top-[-0.5px]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 41 2">
            <path d="M0 1H41" id="Vector 3" stroke="var(--stroke-0, black)" />
          </svg>
        </div>
      </div>
      <div className="absolute flex h-[44px] items-center justify-center left-[167px] top-[139px] w-[0px]">
        <div className="flex-none rotate-[90deg]">
          <div className="h-0 relative w-11">
            <div className="absolute bottom-[-0.5px] left-0 right-0 top-[-0.5px]">
              <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 44 2">
                <path d="M0 1H44" id="Vector 4" stroke="var(--stroke-0, black)" />
              </svg>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute flex flex-col font-['Inter:Regular',_'Noto_Sans_KR:Regular',_sans-serif] font-normal justify-center leading-[0] left-36 not-italic text-[#efefef] text-[24px] text-nowrap top-[264.5px] translate-y-[-50%]">
        <p className="leading-[normal] whitespace-pre">추가</p>
      </div>
      <div className="absolute flex flex-col font-['Inter:Regular',_sans-serif] font-normal justify-center leading-[0] left-[470px] not-italic text-[#efefef] text-[24px] text-nowrap top-[264.5px] translate-y-[-50%]">
        <p className="leading-[normal] whitespace-pre">PDF #1</p>
      </div>
      <div className="absolute flex flex-col font-['Inter:Regular',_sans-serif] font-normal justify-center leading-[0] left-[1106px] not-italic text-[#efefef] text-[24px] text-nowrap top-[294.5px] translate-y-[-50%]">
        <p className="leading-[normal] whitespace-pre">Folder#1</p>
      </div>
      <div className="absolute flex flex-col font-['Inter:Regular',_sans-serif] font-normal justify-center leading-[0] left-[791px] not-italic text-[#efefef] text-[24px] text-nowrap top-[264.5px] translate-y-[-50%]">
        <p className="leading-[normal] whitespace-pre">PDF #2</p>
      </div>
      <Group3 />
      <div className="absolute bg-[#64a3d7] h-[140px] left-[1051px] rounded top-[114px] w-[202px]" />
    </div>
  );
}