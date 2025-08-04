import React from 'react';

export default function DataSafety() {
  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', lineHeight: '1.6', color: '#333' }}>
      <header style={{ textAlign: 'center', marginBottom: '40px', borderBottom: '2px solid #e0e0e0', paddingBottom: '20px' }}>
        <h1 style={{ color: '#2c3e50', fontSize: '28px', marginBottom: '10px' }}>BAUhaus 데이터 안전성 정보</h1>
        <p style={{ color: '#7f8c8d', fontSize: '14px' }}>Google Play Store 데이터 안전성 섹션용</p>
      </header>

      <section style={{ marginBottom: '40px' }}>
        <h2 style={{ color: '#34495e', fontSize: '22px', marginBottom: '20px', borderLeft: '4px solid #27ae60', paddingLeft: '15px' }}>📊 수집되는 데이터 유형</h2>
        
        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ color: '#2c3e50', fontSize: '18px', marginBottom: '15px', display: 'flex', alignItems: 'center' }}>
            🔐 개인 정보
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', borderRadius: '8px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa' }}>
                  <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left', fontWeight: '600' }}>데이터 유형</th>
                  <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'center', fontWeight: '600' }}>수집 여부</th>
                  <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left', fontWeight: '600' }}>목적</th>
                  <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'center', fontWeight: '600' }}>공유 여부</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '10px 12px', border: '1px solid #dee2e6' }}>이름</td>
                  <td style={{ padding: '10px 12px', border: '1px solid #dee2e6', textAlign: 'center', color: '#28a745' }}>✅ 수집</td>
                  <td style={{ padding: '10px 12px', border: '1px solid #dee2e6' }}>계정 관리, 프로필 표시</td>
                  <td style={{ padding: '10px 12px', border: '1px solid #dee2e6', textAlign: 'center', color: '#dc3545' }}>❌ 공유 안함</td>
                </tr>
                <tr style={{ backgroundColor: '#f8f9fa' }}>
                  <td style={{ padding: '10px 12px', border: '1px solid #dee2e6' }}>이메일 주소</td>
                  <td style={{ padding: '10px 12px', border: '1px solid #dee2e6', textAlign: 'center', color: '#28a745' }}>✅ 수집</td>
                  <td style={{ padding: '10px 12px', border: '1px solid #dee2e6' }}>계정 인증, 고객 지원</td>
                  <td style={{ padding: '10px 12px', border: '1px solid #dee2e6', textAlign: 'center', color: '#dc3545' }}>❌ 공유 안함</td>
                </tr>
                <tr>
                  <td style={{ padding: '10px 12px', border: '1px solid #dee2e6' }}>사용자 ID</td>
                  <td style={{ padding: '10px 12px', border: '1px solid #dee2e6', textAlign: 'center', color: '#28a745' }}>✅ 수집</td>
                  <td style={{ padding: '10px 12px', border: '1px solid #dee2e6' }}>계정 식별, 서비스 제공</td>
                  <td style={{ padding: '10px 12px', border: '1px solid #dee2e6', textAlign: 'center', color: '#dc3545' }}>❌ 공유 안함</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ color: '#2c3e50', fontSize: '18px', marginBottom: '15px' }}>📍 위치 정보</h3>
          <div style={{ backgroundColor: '#fff3cd', padding: '15px', borderRadius: '8px', border: '1px solid #ffeaa7', marginBottom: '15px' }}>
            <p style={{ margin: 0, fontSize: '14px', color: '#856404' }}>
              <strong>선택적 수집:</strong> AR 작품 위치 태그 기능을 사용할 때만 대략적인 위치 정보를 수집합니다.
            </p>
          </div>
          <ul style={{ paddingLeft: '20px', marginBottom: '15px' }}>
            <li><strong>대략적인 위치:</strong> ✅ 선택적 수집 (AR 작품 위치 태그용)</li>
            <li><strong>정확한 위치:</strong> ❌ 수집 안함</li>
          </ul>
        </div>

        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ color: '#2c3e50', fontSize: '18px', marginBottom: '15px' }}>💬 메시지 및 커뮤니케이션</h3>
          <ul style={{ paddingLeft: '20px', marginBottom: '15px' }}>
            <li><strong>인앱 메시지:</strong> ✅ 수집 (댓글, 사용자 간 소통)</li>
            <li><strong>이메일:</strong> ❌ 수집 안함</li>
            <li><strong>SMS 또는 MMS:</strong> ❌ 수집 안함</li>
          </ul>
        </div>

        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ color: '#2c3e50', fontSize: '18px', marginBottom: '15px' }}>🔊 오디오 및 미디어</h3>
          <ul style={{ paddingLeft: '20px', marginBottom: '15px' }}>
            <li><strong>음성 또는 소리 녹음:</strong> ❌ 수집 안함</li>
            <li><strong>음악 파일:</strong> ❌ 수집 안함</li>
            <li><strong>동영상:</strong> ❌ 수집 안함</li>
          </ul>
        </div>
      </section>

      <section style={{ marginBottom: '40px' }}>
        <h2 style={{ color: '#34495e', fontSize: '22px', marginBottom: '20px', borderLeft: '4px solid #3498db', paddingLeft: '15px' }}>🛡️ 보안 관행</h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '30px' }}>
          <div style={{ backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '8px', border: '1px solid #e9ecef' }}>
            <h3 style={{ color: '#2c3e50', fontSize: '16px', marginBottom: '15px', display: 'flex', alignItems: 'center' }}>
              🔒 암호화
            </h3>
            <ul style={{ paddingLeft: '20px', fontSize: '14px', lineHeight: '1.8' }}>
              <li><strong>전송 중 데이터 암호화:</strong> ✅ 모든 데이터는 HTTPS/TLS를 통해 암호화됩니다</li>
              <li><strong>저장된 데이터 암호화:</strong> ✅ 서버에 저장되는 모든 개인정보는 암호화됩니다</li>
            </ul>
          </div>

          <div style={{ backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '8px', border: '1px solid #e9ecef' }}>
            <h3 style={{ color: '#2c3e50', fontSize: '16px', marginBottom: '15px', display: 'flex', alignItems: 'center' }}>
              🗑️ 데이터 삭제
            </h3>
            <ul style={{ paddingLeft: '20px', fontSize: '14px', lineHeight: '1.8' }}>
              <li><strong>삭제 요청 가능:</strong> ✅ 사용자가 언제든지 계정 및 데이터 삭제를 요청할 수 있습니다</li>
              <li><strong>자동 삭제:</strong> ✅ 계정 삭제 시 모든 개인정보가 즉시 삭제됩니다</li>
            </ul>
          </div>
        </div>

        <div style={{ backgroundColor: '#d4edda', padding: '20px', borderRadius: '8px', border: '1px solid #c3e6cb', marginBottom: '20px' }}>
          <h3 style={{ color: '#155724', fontSize: '16px', marginBottom: '15px', display: 'flex', alignItems: 'center' }}>
            🚫 제3자 공유 정책
          </h3>
          <ul style={{ paddingLeft: '20px', fontSize: '14px', lineHeight: '1.8', color: '#155724' }}>
            <li><strong>광고 목적 공유 없음:</strong> ❌ 개인정보를 광고업체와 공유하지 않습니다</li>
            <li><strong>분석 목적 공유 없음:</strong> ❌ 개인정보를 분석업체와 공유하지 않습니다</li>
            <li><strong>개발자 외부 공유 없음:</strong> ❌ 서비스 운영에 필요한 경우에만 최소한으로 처리합니다</li>
          </ul>
        </div>
      </section>

      <section style={{ marginBottom: '40px' }}>
        <h2 style={{ color: '#34495e', fontSize: '22px', marginBottom: '20px', borderLeft: '4px solid #f39c12', paddingLeft: '15px' }}>🎯 데이터 사용 목적</h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <h3 style={{ color: '#2c3e50', fontSize: '16px', marginBottom: '15px' }}>📱 앱 기능</h3>
            <ul style={{ paddingLeft: '20px', fontSize: '14px', lineHeight: '1.8' }}>
              <li>계정 관리: 로그인, 프로필 관리</li>
              <li>콘텐츠 저장: 3D 아트워크 생성 및 저장</li>
              <li>소셜 기능: 작품 공유, 댓글, 팔로우</li>
            </ul>
          </div>

          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <h3 style={{ color: '#2c3e50', fontSize: '16px', marginBottom: '15px' }}>📊 분석</h3>
            <ul style={{ paddingLeft: '20px', fontSize: '14px', lineHeight: '1.8' }}>
              <li>사용자 경험 개선: 앱 사용 패턴 분석을 통한 기능 개선</li>
              <li>성능 최적화: 앱 성능 모니터링 및 최적화</li>
            </ul>
          </div>

          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <h3 style={{ color: '#2c3e50', fontSize: '16px', marginBottom: '15px' }}>💬 개발자 소통</h3>
            <ul style={{ paddingLeft: '20px', fontSize: '14px', lineHeight: '1.8' }}>
              <li>고객 지원: 문의사항 처리 및 기술 지원</li>
              <li>서비스 공지: 업데이트 및 중요 공지사항 전달</li>
            </ul>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: '40px' }}>
        <h2 style={{ color: '#34495e', fontSize: '22px', marginBottom: '20px', borderLeft: '4px solid #e74c3c', paddingLeft: '15px' }}>👶 아동 안전</h2>
        <div style={{ backgroundColor: '#fff5f5', padding: '20px', borderRadius: '8px', border: '1px solid #fed7d7' }}>
          <ul style={{ paddingLeft: '20px', fontSize: '14px', lineHeight: '1.8', color: '#721c24' }}>
            <li><strong>만 13세 미만:</strong> 개인정보를 고의로 수집하지 않습니다</li>
            <li><strong>부모 통제:</strong> 아동이 개인정보를 제공했음을 알게 된 경우 즉시 삭제합니다</li>
          </ul>
        </div>
      </section>

      <section style={{ marginBottom: '40px' }}>
        <h2 style={{ color: '#34495e', fontSize: '22px', marginBottom: '20px', borderLeft: '4px solid #9b59b6', paddingLeft: '15px' }}>📋 추가 정보</h2>
        <div style={{ backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '8px', border: '1px solid #e9ecef' }}>
          <ul style={{ paddingLeft: '20px', fontSize: '14px', lineHeight: '1.8' }}>
            <li><strong>데이터 수집 선택권:</strong> 필수 데이터 외에는 모두 선택사항입니다</li>
            <li><strong>투명성:</strong> 데이터 수집 및 사용에 대해 명확하게 고지합니다</li>
            <li><strong>사용자 제어:</strong> 설정에서 언제든지 데이터 수집을 제어할 수 있습니다</li>
          </ul>
        </div>
      </section>

      <footer style={{ textAlign: 'center', padding: '30px', borderTop: '2px solid #e0e0e0', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
        <p style={{ fontSize: '16px', fontWeight: '600', color: '#2c3e50', marginBottom: '10px' }}>
          문의사항이 있으시면 support@bauhaus.kr로 연락주세요.
        </p>
        <p style={{ color: '#7f8c8d', fontSize: '14px', margin: 0 }}>
          최종 업데이트: 2025년 8월
        </p>
      </footer>
    </div>
  );
}