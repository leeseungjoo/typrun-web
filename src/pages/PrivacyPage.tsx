import LegalShell, { LegalSection } from '../components/LegalShell';
import { LEGAL } from '../lib/legal';

/**
 * 개인정보처리방침 — 실제 서비스가 수집/이용하는 항목 기준으로 작성.
 * 운영 주체·보호책임자·연락처는 src/lib/legal.ts 에서 관리.
 */
export default function PrivacyPage() {
  return (
    <LegalShell title="개인정보처리방침" effectiveDate={LEGAL.effectiveDate}>
      <p>
        {LEGAL.serviceName}({LEGAL.domain}, 이하 “서비스”)는 이용자의 개인정보를 중요하게
        생각하며, 「개인정보 보호법」 등 관련 법령을 준수합니다. 본 방침은 서비스가 어떤
        개인정보를 어떤 목적으로 수집·이용하며 어떻게 보호하는지 설명합니다.
      </p>

      <LegalSection heading="1. 수집하는 개인정보 항목">
        <p>서비스는 다음 항목을 수집합니다.</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><b>이메일 회원가입(필수):</b> 이메일, 비밀번호(암호화 저장), 닉네임</li>
          <li><b>소셜 로그인 시:</b> 제공사(카카오·구글·네이버) 식별자, 제공사가 전달한 이메일·닉네임·프로필 이미지</li>
          <li><b>프로필(선택):</b> 자기소개, 프로필 이미지</li>
          <li><b>게임 이용 시 자동 생성:</b> 점수·정확도·타수(WPM)·콤보·플레이 시간·플레이 일시</li>
          <li><b>경품(추첨) 당첨 시:</b> 상품 발송·당첨 안내를 위한 이메일</li>
          <li><b>문의 접수 시:</b> 이름, 회신용 연락처(이메일 또는 전화), 회사·브랜드명(선택), 문의 내용</li>
          <li><b>자동 수집:</b> 접속 IP 주소(부정 이용·도배 방지 목적)</li>
        </ul>
        <p className="text-white/55">
          ※ 카카오 로그인 시 이메일 제공에 동의하지 않은 경우, 임시 이메일로 가입되며
          상품 수령을 위해서는 프로필에서 실제 이메일 등록이 필요합니다.
        </p>
      </LegalSection>

      <LegalSection heading="2. 개인정보의 수집·이용 목적">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>회원 식별·인증 및 로그인 유지</li>
          <li>타자 게임 서비스 제공, 점수 기록 및 리그·랭킹 운영</li>
          <li>경품 추첨 진행, 당첨자 안내 및 상품 발송</li>
          <li>친구 추천 이벤트 집계 및 보상 지급</li>
          <li>문의·오류 신고·협업 제안에 대한 응대</li>
          <li>부정 이용(매크로·도배 등) 방지 및 서비스 안정성 확보</li>
        </ul>
      </LegalSection>

      <LegalSection heading="3. 보유 및 이용 기간">
        <p>
          개인정보는 원칙적으로 수집·이용 목적이 달성되거나 <b>회원 탈퇴 시 지체 없이 파기</b>합니다.
          단, 관련 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다.
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>게임 기록·랭킹: 회원 탈퇴 시까지(통계는 익명 처리 후 보관 가능)</li>
          <li>문의 기록: 응대 완료 후 일정 기간 보관 후 파기</li>
          <li>경품 발송 기록: 발송 및 분쟁 처리 완료 후 파기</li>
          <li>접속 IP: 부정 이용 방지 목적 달성 후 파기</li>
        </ul>
      </LegalSection>

      <LegalSection heading="4. 개인정보의 제3자 제공 및 처리위탁">
        <p>
          서비스는 이용자의 개인정보를 외부에 판매하거나 제공하지 않습니다. 다만 서비스 제공을 위해
          아래와 같은 위탁·연동이 이루어질 수 있습니다.
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><b>소셜 로그인:</b> 카카오·구글·네이버 (로그인 인증)</li>
          <li><b>이메일 발송:</b> 회원 인증·비밀번호 재설정·문의 회신 메일 발송</li>
        </ul>
        <p className="text-white/55">
          위탁 업체 또는 연동 항목이 변경되는 경우 본 방침을 통해 사전 고지합니다.
        </p>
      </LegalSection>

      <LegalSection heading="5. 이용자의 권리와 행사 방법">
        <p>
          이용자는 언제든지 자신의 개인정보를 열람·정정·삭제하거나 처리정지를 요청할 수 있습니다.
          닉네임·자기소개·프로필 이미지·이메일은 <b>프로필 화면에서 직접 수정</b>할 수 있으며,
          회원 탈퇴 및 기타 요청은 아래 연락처로 문의해 주시기 바랍니다.
        </p>
      </LegalSection>

      <LegalSection heading="6. 개인정보의 안전성 확보 조치">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>비밀번호는 복호화 불가능한 방식으로 암호화하여 저장</li>
          <li>통신 구간 SSL/TLS 암호화 적용</li>
          <li>접근 권한 최소화 및 관리자 인증 적용</li>
        </ul>
      </LegalSection>

      <LegalSection heading="7. 개인정보 보호책임자">
        <p>
          개인정보 처리에 관한 문의·불만·피해 구제는 아래로 연락해 주시기 바랍니다.
        </p>
        <ul className="list-none pl-0 space-y-1">
          <li>운영 주체 : {LEGAL.operator}</li>
          <li>개인정보 보호책임자 : {LEGAL.privacyOfficer}</li>
          <li>
            연락처 :{' '}
            <a className="underline hover:text-white" href={`mailto:${LEGAL.contactEmail}`}>
              {LEGAL.contactEmail}
            </a>
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="8. 권익 침해 구제 방법">
        <p>
          개인정보 침해로 인한 상담·신고가 필요한 경우 아래 기관에 문의할 수 있습니다.
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>개인정보분쟁조정위원회 (privacy.go.kr / 1833-6972)</li>
          <li>개인정보침해신고센터 (privacy.kisa.or.kr / 118)</li>
          <li>대검찰청 사이버수사과 (spo.go.kr / 1301)</li>
          <li>경찰청 사이버수사국 (ecrm.police.go.kr / 182)</li>
        </ul>
      </LegalSection>

      <LegalSection heading="9. 방침의 변경">
        <p>
          본 개인정보처리방침은 법령·서비스 변경에 따라 개정될 수 있으며, 변경 시 서비스 내
          공지를 통해 안내합니다.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
