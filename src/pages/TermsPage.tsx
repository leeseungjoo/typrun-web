import LegalShell, { LegalSection } from '../components/LegalShell';
import { LEGAL } from '../lib/legal';

/**
 * 이용약관 — 게임/랭킹/경품 이벤트 서비스 기준 기본 약관.
 */
export default function TermsPage() {
  return (
    <LegalShell title="이용약관" effectiveDate={LEGAL.effectiveDate}>
      <LegalSection heading="제1조 (목적)">
        <p>
          본 약관은 {LEGAL.serviceName}({LEGAL.domain}, 이하 “서비스”)가 제공하는 타자 게임,
          랭킹·리그, 경품 추첨 및 친구 추천 이벤트 등 일체의 서비스 이용에 관한 운영자와
          이용자 간의 권리·의무 및 책임 사항을 규정함을 목적으로 합니다.
        </p>
      </LegalSection>

      <LegalSection heading="제2조 (회원가입 및 계정)">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>이용자는 이메일 또는 소셜 로그인(카카오·구글·네이버)으로 회원가입할 수 있습니다.</li>
          <li>이메일 가입 시 이메일 인증을 완료해야 정상적으로 로그인할 수 있습니다.</li>
          <li>계정 정보는 본인이 관리할 책임이 있으며, 타인에게 양도·대여할 수 없습니다.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="제3조 (이용자의 의무)">
        <p>이용자는 다음 행위를 하여서는 안 됩니다.</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>매크로·자동 입력 등 비정상적인 방법으로 점수·랭킹을 조작하는 행위</li>
          <li>닉네임·자기소개에 욕설, 비방, 음란, 타인의 권리를 침해하는 내용을 사용하는 행위</li>
          <li>타인의 계정을 도용하거나 서비스 운영을 방해하는 행위</li>
          <li>문의·신고 기능을 도배하거나 허위 사실을 접수하는 행위</li>
        </ul>
      </LegalSection>

      <LegalSection heading="제4조 (경품 및 이벤트)">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>경품 추첨은 공지된 기간·조건(최소 점수, 추첨 방식 등)에 따라 진행됩니다.</li>
          <li>상품 발송을 위해 당첨자의 이메일 등 연락 정보가 필요할 수 있습니다.</li>
          <li>부정한 방법으로 참여하거나 당첨된 경우, 당첨 및 보상은 취소될 수 있습니다.</li>
          <li>경품의 종류·수량·일정은 운영 사정에 따라 변경될 수 있으며 변경 시 공지합니다.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="제5조 (서비스의 제공 및 변경)">
        <p>
          운영자는 서비스의 내용·기능을 개선하기 위해 일부를 변경하거나, 운영상·기술상
          필요에 따라 서비스의 전부 또는 일부를 중단할 수 있습니다. 중대한 변경 시 사전에
          공지합니다.
        </p>
      </LegalSection>

      <LegalSection heading="제6조 (이용 제한)">
        <p>
          이용자가 본 약관 또는 관련 법령을 위반한 경우, 운영자는 사전 통지 후(긴급한 경우
          통지 없이) 게시물 삭제, 점수·랭킹 초기화, 이용 정지 또는 계정 해지 등의 조치를
          취할 수 있습니다.
        </p>
      </LegalSection>

      <LegalSection heading="제7조 (면책)">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>천재지변, 정전, 외부 서비스(소셜 로그인 등) 장애 등 운영자의 통제 범위를 벗어난 사유로 인한 손해에 대해서는 책임을 지지 않습니다.</li>
          <li>이용자 본인의 부주의(계정 정보 유출 등)로 발생한 손해에 대해서는 책임을 지지 않습니다.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="제8조 (약관의 변경 및 준거법)">
        <p>
          본 약관은 관련 법령에 따라 변경될 수 있으며, 변경 시 서비스 내 공지를 통해 알립니다.
          본 약관에 명시되지 않은 사항은 관련 법령 및 상관례에 따르며, 서비스 이용과 관련한
          분쟁은 대한민국 법을 준거법으로 합니다.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
