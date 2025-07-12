
import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-8">
      <div className="text-center text-white">
        <h1 className="text-4xl md:text-6xl font-bold mb-6">
          LivingBrush AR
        </h1>
        <p className="text-xl md:text-2xl mb-8 opacity-90">
          VR에서 창작하고, AR로 감상하는
          <br />
          메타버스 아트 플랫폼
        </p>
        
        <div className="space-y-4">
          <Link 
            href="/ar/view/1" 
            className="inline-block bg-white/20 backdrop-blur-md hover:bg-white/30 transition-all duration-200 px-8 py-4 rounded-lg text-lg font-medium"
          >
            📱 샘플 AR 작품 감상하기
          </Link>
          
          <div className="text-sm opacity-75 mt-4">
            <p>모바일에서 더 나은 AR 경험을 즐기실 수 있습니다</p>
          </div>
        </div>
        
        <div className="mt-16 text-xs opacity-50">
          <p>시연용 URL: /ar/view/1</p>
        </div>
      </div>
    </div>
  );
}