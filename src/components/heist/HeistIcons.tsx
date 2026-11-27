// 도둑 런 메뉴 버튼용 선 없는 아이콘(글자색을 따라간다). 크기는 버튼 CSS(.hm-btn svg)가 정한다.

export function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7 4.6v14.8a1 1 0 0 0 1.52.85l12-7.4a1 1 0 0 0 0-1.7l-12-7.4A1 1 0 0 0 7 4.6Z" />
    </svg>
  );
}

export function KeyboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm1 3v2h2V8H5Zm4 0v2h2V8H9Zm4 0v2h2V8h-2Zm4 0v2h2V8h-2ZM5 11.5v2h2v-2H5Zm4 0v2h2v-2H9Zm4 0v2h2v-2h-2Zm4 0v2h2v-2h-2ZM8 15v2h8v-2H8Z"
      />
    </svg>
  );
}

export function TrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7 3h10v2h3v3a4 4 0 0 1-3.3 3.94A5 5 0 0 1 13 14.9V17h3v3H8v-3h3v-2.1a5 5 0 0 1-3.7-2.96A4 4 0 0 1 4 8V5h3V3Zm0 4H6v1a2 2 0 0 0 1 1.73V7Zm10 0v2.73A2 2 0 0 0 18 8V7h-1Z" />
    </svg>
  );
}
