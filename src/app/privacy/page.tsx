import React from 'react';

export default function PrivacyPolicy() {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', lineHeight: '1.6', color: '#333' }}>
      <header style={{ textAlign: 'center', marginBottom: '40px', borderBottom: '2px solid #e0e0e0', paddingBottom: '20px' }}>
        <h1 style={{ color: '#2c3e50', fontSize: '28px', marginBottom: '10px' }}>BAUhaus 개인정보처리방침</h1>
        <p style={{ color: '#7f8c8d', fontSize: '14px' }}>최종 업데이트: 2025년 8월</p>
      </header>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#34495e', fontSize: '20px', marginBottom: '15px', borderLeft: '4px solid #e74c3c', paddingLeft: '15px' }}>1. 개인정보 처리방침 개요</h2>
        <p>BAUhaus는 개인정보보호법 등 관련 법령에 따라 이용자의 개인정보를 안전하게 처리하고 있습니다.</p>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#34495e', fontSize: '20px', marginBottom: '15px', borderLeft: '4px solid #e74c3c', paddingLeft: '15px' }}>2. 수집하는 개인정보 항목</h2>
        
        <h3 style={{ color: '#2c3e50', fontSize: '16px', marginTop: '20px', marginBottom: '10px' }}>2.1 필수 수집 정보</h3>
        <div style={{ backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
          <strong>Google 소셜 로그인 시</strong>
          <ul style={{ paddingLeft: '20px', marginTop: '10px' }}>
            <li>이메일 주소</li>
            <li>프로필 사진</li>
            <li>기본 프로필 정보 (이름)</li>
          </ul>
        </div>

        <h3 style={{ color: '#2c3e50', fontSize: '16px', marginTop: '20px', marginBottom: '10px' }}>2.2 자동 수집 정보</h3>
        <ul style={{ paddingLeft: '20px', marginBottom: '15px' }}>
          <li>기기 정보 (OS 버전, 기기 모델)</li>
          <li>앱 사용 로그 (접속 시간, 이용 기록)</li>
          <li>IP 주소</li>
        </ul>

        <h3 style={{ color: '#2c3e50', fontSize: '16px', marginTop: '20px', marginBottom: '10px' }}>2.3 선택 수집 정보</h3>
        <ul style={{ paddingLeft: '20px', marginBottom: '15px' }}>
          <li>프로필 소개글</li>
          <li>작품 위치 정보 (AR 감상용)</li>
        </ul>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#34495e', fontSize: '20px', marginBottom: '15px', borderLeft: '4px solid #e74c3c', paddingLeft: '15px' }}>3. 개인정보 수집 목적</h2>
        
        <h3 style={{ color: '#2c3e50', fontSize: '16px', marginTop: '20px', marginBottom: '10px' }}>3.1 서비스 제공</h3>
        <ul style={{ paddingLeft: '20px', marginBottom: '15px' }}>
          <li>회원 가입 및 로그인 인증</li>
          <li>3D 아트워크 저장 및 관리</li>
          <li>작품 공유 및 소셜 기능 제공</li>
        </ul>

        <h3 style={{ color: '#2c3e50', fontSize: '16px', marginTop: '20px', marginBottom: '10px' }}>3.2 서비스 개선</h3>
        <ul style={{ paddingLeft: '20px', marginBottom: '15px' }}>
          <li>이용 통계 분석</li>
          <li>서비스 품질 향상</li>
          <li>새로운 기능 개발</li>
        </ul>

        <h3 style={{ color: '#2c3e50', fontSize: '16px', marginTop: '20px', marginBottom: '10px' }}>3.3 고객 지원</h3>
        <ul style={{ paddingLeft: '20px', marginBottom: '15px' }}>
          <li>문의사항 응답</li>
          <li>공지사항 전달</li>
          <li>기술적 지원</li>
        </ul>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#34495e', fontSize: '20px', marginBottom: '15px', borderLeft: '4px solid #e74c3c', paddingLeft: '15px' }}>4. 개인정보 보유 및 이용기간</h2>
        
        <h3 style={{ color: '#2c3e50', fontSize: '16px', marginTop: '20px', marginBottom: '10px' }}>4.1 회원 정보</h3>
        <ul style={{ paddingLeft: '20px', marginBottom: '15px' }}>
          <li>회원 탈퇴 시까지 보유</li>
          <li>탈퇴 후 즉시 삭제 (복구 불가)</li>
        </ul>

        <h3 style={{ color: '#2c3e50', fontSize: '16px', marginTop: '20px', marginBottom: '10px' }}>4.2 로그 정보</h3>
        <ul style={{ paddingLeft: '20px', marginBottom: '15px' }}>
          <li>수집일로부터 1년간 보유</li>
          <li>법령에 따른 보존 의무가 있는 경우 해당 기간</li>
        </ul>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#34495e', fontSize: '20px', marginBottom: '15px', borderLeft: '4px solid #e74c3c', paddingLeft: '15px' }}>5. 개인정보 제3자 제공</h2>
        
        <h3 style={{ color: '#2c3e50', fontSize: '16px', marginTop: '20px', marginBottom: '10px' }}>5.1 원칙</h3>
        <ul style={{ paddingLeft: '20px', marginBottom: '15px' }}>
          <li>이용자의 동의 없이 제3자에게 제공하지 않음</li>
          <li>다음의 경우에만 예외적으로 제공</li>
        </ul>

        <h3 style={{ color: '#2c3e50', fontSize: '16px', marginTop: '20px', marginBottom: '10px' }}>5.2 제공 예외 사항</h3>
        <ul style={{ paddingLeft: '20px', marginBottom: '15px' }}>
          <li>법령에 의한 요청</li>
          <li>수사기관의 수사목적으로 법령에 정해진 절차에 따른 요청</li>
          <li>기타 관계법령에서 정한 절차에 따른 요청</li>
        </ul>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#34495e', fontSize: '20px', marginBottom: '15px', borderLeft: '4px solid #e74c3c', paddingLeft: '15px' }}>6. 개인정보 처리 위탁</h2>
        
        <h3 style={{ color: '#2c3e50', fontSize: '16px', marginTop: '20px', marginBottom: '10px' }}>6.1 위탁업체 현황</h3>
        
        <div style={{ backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
          <strong>Amazon Web Services (AWS)</strong>
          <ul style={{ paddingLeft: '20px', marginTop: '10px' }}>
            <li>위탁업무: 클라우드 서버 운영</li>
            <li>개인정보 보유기간: 위탁계약 종료 시까지</li>
          </ul>
        </div>

        <div style={{ backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
          <strong>Google LLC</strong>
          <ul style={{ paddingLeft: '20px', marginTop: '10px' }}>
            <li>위탁업무: 소셜 로그인 서비스</li>
            <li>개인정보 보유기간: 서비스 이용 기간</li>
          </ul>
        </div>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#34495e', fontSize: '20px', marginBottom: '15px', borderLeft: '4px solid #e74c3c', paddingLeft: '15px' }}>7. 이용자의 권리</h2>
        
        <h3 style={{ color: '#2c3e50', fontSize: '16px', marginTop: '20px', marginBottom: '10px' }}>7.1 열람권</h3>
        <ul style={{ paddingLeft: '20px', marginBottom: '15px' }}>
          <li>본인의 개인정보 처리 현황 확인 요청</li>
        </ul>

        <h3 style={{ color: '#2c3e50', fontSize: '16px', marginTop: '20px', marginBottom: '10px' }}>7.2 정정·삭제권</h3>
        <ul style={{ paddingLeft: '20px', marginBottom: '15px' }}>
          <li>잘못된 정보의 수정 요청</li>
          <li>개인정보 삭제 요청 (회원 탈퇴)</li>
        </ul>

        <h3 style={{ color: '#2c3e50', fontSize: '16px', marginTop: '20px', marginBottom: '10px' }}>7.3 처리정지권</h3>
        <ul style={{ paddingLeft: '20px', marginBottom: '15px' }}>
          <li>개인정보 처리 중단 요청</li>
        </ul>
      </section>

      <section style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#fff5f5', borderRadius: '8px', border: '1px solid #fed7d7' }}>
        <h2 style={{ color: '#34495e', fontSize: '20px', marginBottom: '15px' }}>11. 개인정보보호책임자</h2>
        
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ color: '#2c3e50', marginBottom: '10px' }}>개인정보보호책임자</h4>
          <ul style={{ paddingLeft: '20px', fontSize: '14px', lineHeight: '1.8' }}>
            <li>성명: 김○○</li>
            <li>직책: 개발팀장</li>
            <li>연락처: privacy@bauhaus.kr</li>
          </ul>
        </div>

        <div>
          <h4 style={{ color: '#2c3e50', marginBottom: '10px' }}>개인정보보호 담당부서</h4>
          <ul style={{ paddingLeft: '20px', fontSize: '14px', lineHeight: '1.8' }}>
            <li>부서명: 개발운영팀</li>
            <li>연락처: support@bauhaus.kr</li>
          </ul>
        </div>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#34495e', fontSize: '20px', marginBottom: '15px', borderLeft: '4px solid #e74c3c', paddingLeft: '15px' }}>12. 권익침해 구제방법</h2>
        <p style={{ marginBottom: '15px' }}>개인정보 침해신고센터, 개인정보 분쟁조정위원회, 대검찰청 사이버범죄수사단, 경찰청 사이버안전국 등에 신고하실 수 있습니다.</p>
        
        <div style={{ backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '8px', fontSize: '14px' }}>
          <p><strong>개인정보 침해신고센터:</strong> privacy.go.kr (국번없이 182)</p>
          <p><strong>개인정보 분쟁조정위원회:</strong> www.kopico.go.kr (국번없이 1833-6972)</p>
        </div>
      </section>

      <footer style={{ textAlign: 'center', padding: '20px', borderTop: '1px solid #e0e0e0', color: '#7f8c8d', fontSize: '14px' }}>
        <p>본 개인정보처리방침은 2025년 8월부터 적용됩니다.</p>
      </footer>
    </div>
  );
}