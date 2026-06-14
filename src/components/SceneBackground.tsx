/**
 * 전 페이지 공통 배경 — 심플 버전.
 * 기존 풍경 이미지 + 둥실 캐릭터는 제거(무거운 에셋 ~1.5MB 미사용).
 * 브랜드 딥네이비 위에 은은한 그라데이션만 — 가볍고 가독성 좋음.
 */
export default function SceneBackground() {
  return (
    <div
      className="fixed inset-0 -z-10 overflow-hidden bg-ink"
      aria-hidden="true"
      style={{
        background:
          'radial-gradient(900px 600px at 80% -10%, rgba(217,85,72,0.16), transparent 60%),' +
          'radial-gradient(820px 560px at 0% 112%, rgba(94,114,255,0.14), transparent 55%),' +
          '#0F1226',
      }}
    />
  );
}
