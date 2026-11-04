import React from 'react';

/**
 * AUTHENTIC VIETNAMESE TẾT VECTOR ASSETS & COMPONENTS
 * Reference Sources & Online Vector Inspirations:
 * - Freepik: Traditional Vietnamese Tet Elements Vector (Banh Chung, Banh Tet, Hoa Mai, Hoa Dao)
 * - Shutterstock (ID: 2397449919): Vietnamese Lunar New Year Festival Illustrations
 * - Pngtree: Traditional Golden Apricot Blossom & Tet Lanterns
 * - Typography Reference: "Thư Pháp Công Thủy 31" (Vietnamese Brush Calligraphy Font)
 */

// =============================================================================
// 1. AUTHENTIC VIETNAMESE CALLIGRAPHY TITLE: "CHÚC MỪNG NĂM MỚI"
// Styled strictly following the user's "Thư Pháp Công Thủy 31" reference image.
// =============================================================================
export const TetCalligraphyTitle: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div
    className={`flex flex-col select-none relative ${className}`}
    role="heading"
    aria-level={1}
    aria-label="Chúc Mừng Năm Mới - Xuân sang cội phúc sinh nhành lộc, Tết đến cây đức trổ thêm hoa"
  >
    <div className="flex items-start sm:items-center gap-3 md:gap-4">
      {/* Traditional Red Lacquer Seal Stamp (Ấn Triện Thư Pháp "Phúc - Xuân") */}
      <div className="shrink-0 w-9 h-9 sm:w-11 sm:h-11 rounded-lg bg-gradient-to-br from-[#B9272F] to-[#7F1D1D] border-2 border-[#D4A64A] shadow-md flex items-center justify-center rotate-[-3deg] hover:rotate-0 transition-transform">
        <svg viewBox="0 0 36 36" className="w-7 h-7 sm:w-8 sm:h-8 text-[#FFF7EF]" fill="currentColor">
          <rect x="2" y="2" width="32" height="32" rx="3" fill="none" stroke="#E9B94F" strokeWidth="1.2" strokeDasharray="1.5 1.5" />
          {/* Stylized Vietnamese Calligraphy Character "Phúc" in Seal Script */}
          <path d="M8 9 H28 M18 9 V18 M11 18 H25 M13 22 H23 M15 25 H21 M18 25 V30" stroke="#FFF7EF" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="18" cy="13.5" r="1.5" fill="#E9B94F" />
          <circle cx="24" cy="7" r="1" fill="#E9B94F" />
        </svg>
      </div>

      <div className="flex flex-col">
        {/* Dominant Headline: CHÚC MỪNG NĂM MỚI (Thư Pháp Công Thủy 31 Style) */}
        <div className="relative inline-block">
          <div className="flex items-baseline flex-wrap gap-x-2 sm:gap-x-3">
            <span
              className="text-2xl sm:text-3xl md:text-5xl font-black tracking-wide leading-tight bg-gradient-to-r from-[#881337] via-[#B9272F] to-[#C93844] bg-clip-text text-transparent drop-shadow-[0_2px_4px_rgba(185,39,47,0.18)]"
              style={{
                fontFamily: "'Great Vibes', 'Playfair Display', 'Cormorant Garamond', serif",
                letterSpacing: '0.02em',
              }}
            >
              Chúc Mừng Năm Mới
            </span>
          </div>

          {/* Golden Calligraphy Brush Underline Flourish */}
          <svg
            viewBox="0 0 320 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-56 sm:w-80 md:w-96 h-2.5 sm:h-3.5 mt-0.5 text-[#D4A64A] opacity-90"
          >
            <path
              d="M3 7 C 60 1, 140 12, 220 5 C 265 1, 305 8, 318 4 C 275 9, 215 13, 135 6 C 75 1, 35 11, 3 7 Z"
              fill="url(#tet_gold_brush_grad)"
            />
            <defs>
              <linearGradient id="tet_gold_brush_grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#D4A64A" />
                <stop offset="50%" stopColor="#F59E0B" />
                <stop offset="100%" stopColor="#B9272F" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* 3.2. Poem Directly Beneath the Headline (Exact Two Lines Preserved) */}
        <div className="mt-2 text-xs sm:text-sm md:text-base font-semibold text-[#8B3A3E] leading-relaxed tracking-wide">
          <p className="italic font-serif flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#E9B94F]" />
            <span>Xuân sang cội phúc sinh nhành lộc</span>
          </p>
          <p className="italic font-serif flex items-center gap-1.5 pl-3">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#B9272F]" />
            <span>Tết đến cây đức trổ thêm hoa</span>
          </p>
        </div>
      </div>
    </div>
  </div>
);

// =============================================================================
// 2. BÁNH CHƯNG & BÁNH TÉT VIỆT NAM (Square & Cylindrical Sticky Rice Cakes)
// =============================================================================
export const TetBanhChung: React.FC<{ className?: string }> = ({ className = 'w-16 h-16' }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <linearGradient id="bc_leaf_grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#408045" />
        <stop offset="50%" stopColor="#2E6B33" />
        <stop offset="100%" stopColor="#1E4D23" />
      </linearGradient>
      <linearGradient id="bc_tie_grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFF8E7" />
        <stop offset="100%" stopColor="#E2C98A" />
      </linearGradient>
      <filter id="bc_shadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#1E4D23" floodOpacity="0.3" />
      </filter>
    </defs>

    {/* Banana Leaf Bed */}
    <ellipse cx="50" cy="78" rx="44" ry="14" fill="#245A2B" opacity="0.6" />

    {/* Main Square Cake Body */}
    <g filter="url(#bc_shadow)">
      <polygon points="50,15 88,40 50,68 12,40" fill="url(#bc_leaf_grad)" />
      {/* 3D Side Facets */}
      <polygon points="12,40 50,68 50,82 12,54" fill="#1B4320" />
      <polygon points="88,40 50,68 50,82 88,54" fill="#285E2E" />

      {/* White Bamboo String Ties (Lạt Tre Chữ Thập) */}
      <line x1="31" y1="27" x2="69" y2="54" stroke="url(#bc_tie_grad)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="69" y1="27" x2="31" y2="54" stroke="url(#bc_tie_grad)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="12" y1="47" x2="50" y2="75" stroke="url(#bc_tie_grad)" strokeWidth="2" />
      <line x1="88" y1="47" x2="50" y2="75" stroke="url(#bc_tie_grad)" strokeWidth="2" />

      {/* Red Festive Center Label "Phúc" */}
      <polygon points="50,34 58,40 50,46 42,40" fill="#B9272F" stroke="#E9B94F" strokeWidth="0.8" />
      <circle cx="50" cy="40" r="1.5" fill="#FFE082" />
    </g>
  </svg>
);

export const TetBanhTet: React.FC<{ className?: string }> = ({ className = 'w-16 h-16' }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <linearGradient id="bt_wrap_grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#3B7D41" />
        <stop offset="100%" stopColor="#1E4D23" />
      </linearGradient>
      <linearGradient id="bt_filling_grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FDE047" />
        <stop offset="100%" stopColor="#CA8A04" />
      </linearGradient>
    </defs>

    {/* Cylindrical Roll Wrapped in Leaves */}
    <g transform="rotate(-25 50 50)">
      <rect x="25" y="25" width="50" height="28" rx="8" fill="url(#bt_wrap_grad)" />
      {/* Bamboo String Ties across Roll */}
      <line x1="35" y1="25" x2="35" y2="53" stroke="#FDE68A" strokeWidth="2" strokeDasharray="2 1" />
      <line x1="45" y1="25" x2="45" y2="53" stroke="#FDE68A" strokeWidth="2" strokeDasharray="2 1" />
      <line x1="55" y1="25" x2="55" y2="53" stroke="#FDE68A" strokeWidth="2" strokeDasharray="2 1" />
      <line x1="65" y1="25" x2="65" y2="53" stroke="#FDE68A" strokeWidth="2" strokeDasharray="2 1" />
    </g>

    {/* Cut Round Slice in Front revealing Green Rice, Mung Bean & Pork */}
    <g transform="translate(48, 48)">
      <ellipse cx="20" cy="20" rx="18" ry="14" fill="#3B7D41" stroke="#1E4D23" strokeWidth="1.5" />
      <ellipse cx="20" cy="20" rx="14" ry="10" fill="#86EFAC" />
      {/* Yellow Mung Bean Ring */}
      <ellipse cx="20" cy="20" rx="9" ry="6.5" fill="url(#bt_filling_grad)" />
      {/* Pork Fat Center */}
      <ellipse cx="20" cy="20" rx="4.5" ry="3" fill="#FFFBEB" stroke="#D97706" strokeWidth="0.8" />
    </g>
  </svg>
);

// =============================================================================
// 3. HOA MAI VÀNG & HOA ĐÀO (Authentic Southern Apricot & Northern Peach Blossoms)
// =============================================================================
export const HoaMaiBlossom: React.FC<{ className?: string; size?: number }> = ({ className = '', size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <g transform="translate(20, 20)">
      {/* 5 Rounded Yellow Petals */}
      {[0, 72, 144, 216, 288].map((angle, i) => (
        <path
          key={i}
          d="M0 0 C -6 -10, -5 -16, 0 -17 C 5 -16, 6 -10, 0 0 Z"
          fill="#FBBF24"
          stroke="#F59E0B"
          strokeWidth="0.8"
          transform={`rotate(${angle})`}
        />
      ))}
      {/* Inner Petal Highlights */}
      {[0, 72, 144, 216, 288].map((angle, i) => (
        <circle key={`sub-${i}`} cx="0" cy="-8" r="2.5" fill="#FEF08A" opacity="0.8" transform={`rotate(${angle})`} />
      ))}
      {/* Reddish Orange Stamens and Center Pollen */}
      <circle cx="0" cy="0" r="3.5" fill="#EA580C" />
      <circle cx="0" cy="0" r="1.8" fill="#FFFBEB" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a, i) => (
        <line key={`st-${i}`} x1="0" y1="0" x2="0" y2="-4.5" stroke="#C2410C" strokeWidth="0.8" transform={`rotate(${a})`} />
      ))}
    </g>
  </svg>
);

export const HoaDaoBlossom: React.FC<{ className?: string; size?: number }> = ({ className = '', size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <g transform="translate(20, 20)">
      {/* 5 Soft Pink Petals */}
      {[0, 72, 144, 216, 288].map((angle, i) => (
        <path
          key={i}
          d="M0 0 C -6.5 -10, -5.5 -16, 0 -17 C 5.5 -16, 6.5 -10, 0 0 Z"
          fill="#FB7185"
          stroke="#E11D48"
          strokeWidth="0.8"
          transform={`rotate(${angle})`}
        />
      ))}
      {/* Gentle Pink Highlights */}
      {[0, 72, 144, 216, 288].map((angle, i) => (
        <circle key={`sub-${i}`} cx="0" cy="-8" r="2.8" fill="#FECDD3" opacity="0.8" transform={`rotate(${angle})`} />
      ))}
      {/* Burgundy Core Stamens */}
      <circle cx="0" cy="0" r="3.5" fill="#9F1239" />
      <circle cx="0" cy="0" r="1.8" fill="#FFF1F2" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a, i) => (
        <line key={`st-${i}`} x1="0" y1="0" x2="0" y2="-4.5" stroke="#BE123C" strokeWidth="0.8" transform={`rotate(${a})`} />
      ))}
    </g>
  </svg>
);

// =============================================================================
// 4. BAO LÌ XÌ ĐỎ & THỎI VÀNG (Red Envelope & Gold Ingot)
// =============================================================================
export const TetBaoLiXi: React.FC<{ className?: string }> = ({ className = 'w-10 h-14' }) => (
  <svg viewBox="0 0 60 84" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <linearGradient id="lx_red_grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#DC2626" />
        <stop offset="100%" stopColor="#991B1B" />
      </linearGradient>
      <linearGradient id="lx_gold_grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FDE68A" />
        <stop offset="100%" stopColor="#D97706" />
      </linearGradient>
    </defs>
    {/* Envelope Body */}
    <rect x="4" y="4" width="52" height="76" rx="6" fill="url(#lx_red_grad)" stroke="#B45309" strokeWidth="1" />
    {/* Flap Curve */}
    <path d="M4 14 Q30 32 56 14" stroke="url(#lx_gold_grad)" strokeWidth="1.5" fill="none" />
    {/* Gold Medallion with "Tết" / "Lộc" */}
    <circle cx="30" cy="38" r="12" fill="url(#lx_gold_grad)" stroke="#78350F" strokeWidth="0.8" />
    <circle cx="30" cy="38" r="10" fill="#991B1B" />
    <text x="30" y="42" fill="#FDE68A" fontSize="10" fontWeight="900" textAnchor="middle" fontFamily="serif">LỘC</text>
    {/* Cloud / Wave Bottom Accent */}
    <path d="M12 70 Q21 64 30 70 Q39 64 48 70" stroke="url(#lx_gold_grad)" strokeWidth="1.2" fill="none" />
  </svg>
);

export const TetThoiVang: React.FC<{ className?: string }> = ({ className = 'w-14 h-9' }) => (
  <svg viewBox="0 0 70 45" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <linearGradient id="gold_ingot_grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FEF08A" />
        <stop offset="40%" stopColor="#F59E0B" />
        <stop offset="100%" stopColor="#B45309" />
      </linearGradient>
    </defs>
    {/* Base boat-shaped body */}
    <path d="M8 18 C12 36 58 36 62 18 C67 15 67 10 60 12 C52 14 18 14 10 12 C3 10 3 15 8 18 Z" fill="url(#gold_ingot_grad)" stroke="#78350F" strokeWidth="1" />
    {/* Raised Center Mound */}
    <ellipse cx="35" cy="14" rx="18" ry="9" fill="#FDE047" stroke="#B45309" strokeWidth="0.8" />
    <ellipse cx="35" cy="14" rx="13" ry="5.5" fill="url(#gold_ingot_grad)" />
    <circle cx="35" cy="14" r="2" fill="#FEF9C3" />
  </svg>
);

// =============================================================================
// 5. DƯA HẤU ĐỎ TẾT (Watermelon Slice with "Phúc")
// =============================================================================
export const TetDuaHau: React.FC<{ className?: string }> = ({ className = 'w-16 h-12' }) => (
  <svg viewBox="0 0 80 50" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Green Striped Outer Rind */}
    <path d="M6 10 C16 45 64 45 74 10 Z" fill="#15803D" />
    {/* Light Green Inner Layer */}
    <path d="M9 10 C18 41 62 41 71 10 Z" fill="#86EFAC" />
    {/* White Rind */}
    <path d="M11 10 C19 38 61 38 69 10 Z" fill="#F0FDF4" />
    {/* Juicy Red Flesh */}
    <path d="M13 10 C20 36 60 36 67 10 Z" fill="#EF4444" />
    {/* Black Watermelon Seeds */}
    <circle cx="28" cy="22" r="1.5" fill="#18181B" />
    <circle cx="36" cy="27" r="1.5" fill="#18181B" />
    <circle cx="44" cy="27" r="1.5" fill="#18181B" />
    <circle cx="52" cy="22" r="1.5" fill="#18181B" />
    <circle cx="40" cy="18" r="1.5" fill="#18181B" />
  </svg>
);

// =============================================================================
// 6. ĐÈN LỒNG TRUYỀN THỐNG (Traditional Silk Lantern)
// =============================================================================
export const TetLantern: React.FC<{ className?: string }> = ({ className = 'w-10 h-20' }) => (
  <svg viewBox="0 0 50 90" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <linearGradient id="lan_red" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#EF4444" />
        <stop offset="100%" stopColor="#991B1B" />
      </linearGradient>
      <linearGradient id="lan_gold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FDE68A" />
        <stop offset="100%" stopColor="#D97706" />
      </linearGradient>
    </defs>
    {/* Hanging Cord */}
    <line x1="25" y1="0" x2="25" y2="18" stroke="#D97706" strokeWidth="1.5" />
    {/* Top Cap */}
    <rect x="15" y="18" width="20" height="5" rx="2" fill="url(#lan_gold)" stroke="#78350F" strokeWidth="0.8" />
    {/* Oval Red Silk Lantern Body */}
    <ellipse cx="25" cy="42" rx="18" ry="20" fill="url(#lan_red)" />
    {/* Golden Ribbing */}
    <ellipse cx="25" cy="42" rx="10" ry="20" fill="none" stroke="url(#lan_gold)" strokeWidth="1" opacity="0.8" />
    <ellipse cx="25" cy="42" rx="4" ry="20" fill="none" stroke="url(#lan_gold)" strokeWidth="0.8" opacity="0.6" />
    {/* Bottom Cap */}
    <rect x="15" y="60" width="20" height="5" rx="2" fill="url(#lan_gold)" stroke="#78350F" strokeWidth="0.8" />
    {/* Gold Ring & Tassel */}
    <circle cx="25" cy="67" r="2" fill="#D97706" />
    <line x1="25" y1="69" x2="25" y2="88" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="22" y1="71" x2="22" y2="85" stroke="#F59E0B" strokeWidth="1" strokeLinecap="round" />
    <line x1="28" y1="71" x2="28" y2="85" stroke="#F59E0B" strokeWidth="1" strokeLinecap="round" />
  </svg>
);

// =============================================================================
// 7. CÂU ĐỐI TẾT TREO (Hanging Calligraphy Scroll "Vạn Sự Như Ý")
// =============================================================================
export const TetHangingScroll: React.FC<{
  text1?: string;
  text2?: string;
  className?: string;
}> = ({ text1 = 'VẠN SỰ', text2 = 'NHƯ Ý', className = 'w-12 h-36' }) => (
  <svg viewBox="0 0 50 130" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Hanging String */}
    <line x1="25" y1="0" x2="25" y2="12" stroke="#D97706" strokeWidth="1.5" />
    {/* Top Wooden Rod */}
    <rect x="4" y="12" width="42" height="6" rx="2.5" fill="#D97706" stroke="#78350F" strokeWidth="0.8" />
    {/* Main Red Velvet Scroll */}
    <path d="M7 18 H43 V105 L25 116 L7 105 Z" fill="#B91C1C" stroke="#FDE68A" strokeWidth="1" />
    {/* Inner Gold Border */}
    <path d="M11 22 H39 V100 L25 109 L11 100 Z" fill="none" stroke="#F59E0B" strokeWidth="0.8" strokeDasharray="3 1.5" />
    {/* Calligraphy Characters */}
    <text x="25" y="44" fill="#FEF08A" fontSize="11" fontWeight="900" textAnchor="middle" fontFamily="serif">
      {text1.split(' ')[0]}
    </text>
    <text x="25" y="62" fill="#FEF08A" fontSize="11" fontWeight="900" textAnchor="middle" fontFamily="serif">
      {text1.split(' ')[1] || ''}
    </text>
    <text x="25" y="80" fill="#FEF08A" fontSize="11" fontWeight="900" textAnchor="middle" fontFamily="serif">
      {text2.split(' ')[0]}
    </text>
    <text x="25" y="98" fill="#FEF08A" fontSize="11" fontWeight="900" textAnchor="middle" fontFamily="serif">
      {text2.split(' ')[1] || ''}
    </text>
    {/* Bottom Hanging Gold Tassel */}
    <line x1="25" y1="116" x2="25" y2="128" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
    <circle cx="25" cy="120" r="2" fill="#B91C1C" />
  </svg>
);
