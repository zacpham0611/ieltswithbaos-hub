import React from 'react';
import type { SeasonalThemeId } from './types';
export {
  TetCalligraphyTitle,
  TetBanhChung,
  TetBanhTet,
  HoaMaiBlossom,
  HoaDaoBlossom,
  TetBaoLiXi,
  TetThoiVang,
  TetDuaHau,
  TetLantern,
  TetHangingScroll,
} from './tetVectors';

// =============================================================================
// SHARED HELPER STYLES & FONTS
// =============================================================================
const SERIF_HEADING_FONT = "'Playfair Display', 'Cormorant Garamond', 'Be Vietnam Pro', serif";
const BODY_FONT = "'Be Vietnam Pro', sans-serif";

// =============================================================================
// 1. TẾT ARTWORK (MASTER BENCHMARK REFERENCE)
// =============================================================================

/**
 * Tết Lion Dance Child Mascot holding "Vạn Sự Như Ý" red scroll
 */
export const TetLionDanceMascot: React.FC<{ className?: string }> = ({ className = 'w-36 h-36' }) => (
  <svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <linearGradient id="tet_red_grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#E53935" />
        <stop offset="100%" stopColor="#B71C1C" />
      </linearGradient>
      <linearGradient id="tet_gold_grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFE082" />
        <stop offset="100%" stopColor="#FFB300" />
      </linearGradient>
      <filter id="tet_soft_shadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#B71C1C" floodOpacity="0.25" />
      </filter>
    </defs>

    {/* Soft cloud cushion */}
    <ellipse cx="80" cy="148" rx="60" ry="10" fill="#FCE4EC" opacity="0.8" />
    <path d="M40 145 C45 135 65 135 75 145 C85 135 105 135 115 145 Z" fill="#FFF8E1" opacity="0.9" />

    {/* Lion Dance Head Cap */}
    <g filter="url(#tet_soft_shadow)">
      {/* Mane fluff */}
      <circle cx="55" cy="45" r="16" fill="#FF7043" />
      <circle cx="105" cy="45" r="16" fill="#FF7043" />
      <circle cx="45" cy="65" r="14" fill="#FFAB91" />
      <circle cx="115" cy="65" r="14" fill="#FFAB91" />
      <circle cx="80" cy="35" r="18" fill="url(#tet_gold_grad)" />

      {/* Main Red Head Frame */}
      <path
        d="M50 45 C50 25 110 25 110 45 C125 55 125 80 110 90 C95 95 65 95 50 90 C35 80 35 55 50 45 Z"
        fill="url(#tet_red_grad)"
      />

      {/* Horn / Crown */}
      <polygon points="80,18 73,34 87,34" fill="url(#tet_gold_grad)" />
      <circle cx="80" cy="18" r="4" fill="#D32F2F" />

      {/* Lion Eyes */}
      <circle cx="65" cy="52" r="11" fill="#FFFFFF" />
      <circle cx="95" cy="52" r="11" fill="#FFFFFF" />
      <circle cx="65" cy="52" r="7" fill="#3E2723" />
      <circle cx="95" cy="52" r="7" fill="#3E2723" />
      <circle cx="67" cy="50" r="2.5" fill="#FFFFFF" />
      <circle cx="97" cy="50" r="2.5" fill="#FFFFFF" />

      {/* Gold Eyebrows */}
      <path d="M54 44 Q65 38 74 44" stroke="url(#tet_gold_grad)" strokeWidth="4" strokeLinecap="round" />
      <path d="M86 44 Q95 38 106 44" stroke="url(#tet_gold_grad)" strokeWidth="4" strokeLinecap="round" />

      {/* Lion Snout / Ball Nose */}
      <circle cx="80" cy="58" r="6" fill="url(#tet_gold_grad)" />

      {/* Lion Mouth / Whisker Pads */}
      <path d="M68 66 Q80 72 92 66" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M72 70 Q80 78 88 70" fill="#D32F2F" />
    </g>

    {/* Happy Child Face peering through */}
    <circle cx="80" cy="98" r="19" fill="#FFE0B2" />
    <circle cx="69" cy="103" r="3.5" fill="#FF8A80" opacity="0.6" />
    <circle cx="91" cy="103" r="3.5" fill="#FF8A80" opacity="0.6" />
    <path d="M71 96 Q75 92 79 96" stroke="#4E342E" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    <path d="M81 96 Q85 92 89 96" stroke="#4E342E" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    <path d="M76 104 Q80 108 84 104" stroke="#D84315" strokeWidth="2" strokeLinecap="round" fill="none" />

    {/* Child Festive Clothes & Arms */}
    <path d="M65 115 C65 110 95 110 95 115 L102 142 L58 142 Z" fill="url(#tet_red_grad)" />
    <path d="M80 115 L80 142" stroke="url(#tet_gold_grad)" strokeWidth="2" strokeDasharray="3 2" />

    {/* Red Scroll "Vạn Sự Như Ý" held on the right */}
    <g transform="translate(108, 68)">
      <rect x="0" y="0" width="28" height="5" rx="2.5" fill="url(#tet_gold_grad)" />
      <rect x="0" y="58" width="28" height="5" rx="2.5" fill="url(#tet_gold_grad)" />
      <rect x="3" y="4" width="22" height="55" rx="1.5" fill="#C62828" stroke="#FFE082" strokeWidth="1" />
      <text x="14" y="17" fill="#FFF9C4" fontSize="7.5" fontWeight="900" textAnchor="middle" fontFamily="serif">VẠN</text>
      <text x="14" y="29" fill="#FFF9C4" fontSize="7.5" fontWeight="900" textAnchor="middle" fontFamily="serif">SỰ</text>
      <text x="14" y="41" fill="#FFF9C4" fontSize="7.5" fontWeight="900" textAnchor="middle" fontFamily="serif">NHƯ</text>
      <text x="14" y="53" fill="#FFF9C4" fontSize="7.5" fontWeight="900" textAnchor="middle" fontFamily="serif">Ý</text>
      <line x1="14" y1="63" x2="14" y2="74" stroke="#FFD54F" strokeWidth="1.5" />
      <circle cx="14" cy="74" r="2.5" fill="#E53935" />
    </g>
  </svg>
);

/**
 * Tết Hoa Đào & Hoa Mai Branch with Red Lanterns (Upper Right Accent)
 */
export const TetFloralBranchDecor: React.FC<{ className?: string }> = ({ className = 'w-48 h-32' }) => (
  <svg viewBox="0 0 240 140" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path
      d="M240 10 Q190 20 160 45 T100 70 Q70 78 40 70"
      stroke="#5D4037"
      strokeWidth="5"
      strokeLinecap="round"
      fill="none"
    />
    <path d="M165 42 Q140 25 125 15" stroke="#5D4037" strokeWidth="3" strokeLinecap="round" fill="none" />
    <path d="M105 68 Q90 90 75 105" stroke="#5D4037" strokeWidth="2.5" strokeLinecap="round" fill="none" />

    {/* Hoa Mai (Golden Yellow Flowers) */}
    <g transform="translate(195, 20)">
      <circle cx="0" cy="-6" r="4.5" fill="#FFD54F" />
      <circle cx="6" cy="-2" r="4.5" fill="#FFCA28" />
      <circle cx="4" cy="5" r="4.5" fill="#FFD54F" />
      <circle cx="-4" cy="5" r="4.5" fill="#FFCA28" />
      <circle cx="-6" cy="-2" r="4.5" fill="#FFD54F" />
      <circle cx="0" cy="1" r="2.5" fill="#E65100" />
    </g>
    <g transform="translate(145, 30)">
      <circle cx="0" cy="-6" r="4.5" fill="#FFD54F" />
      <circle cx="6" cy="-2" r="4.5" fill="#FFCA28" />
      <circle cx="4" cy="5" r="4.5" fill="#FFD54F" />
      <circle cx="-4" cy="5" r="4.5" fill="#FFCA28" />
      <circle cx="-6" cy="-2" r="4.5" fill="#FFD54F" />
      <circle cx="0" cy="1" r="2.5" fill="#E65100" />
    </g>

    {/* Hoa Đào (Pink Peach Blossoms) */}
    <g transform="translate(115, 65)">
      <circle cx="0" cy="-7" r="5" fill="#FF80AB" />
      <circle cx="7" cy="-2" r="5" fill="#FF4081" />
      <circle cx="4" cy="6" r="5" fill="#FF80AB" />
      <circle cx="-4" cy="6" r="5" fill="#FF4081" />
      <circle cx="-7" cy="-2" r="5" fill="#FF80AB" />
      <circle cx="0" cy="1" r="3" fill="#C2185B" />
    </g>
    <g transform="translate(60, 74)">
      <circle cx="0" cy="-5" r="4" fill="#FF80AB" />
      <circle cx="5" cy="-1" r="4" fill="#FF4081" />
      <circle cx="3" cy="4" r="4" fill="#FF80AB" />
      <circle cx="-3" cy="4" r="4" fill="#FF4081" />
      <circle cx="-5" cy="-1" r="4" fill="#FF80AB" />
      <circle cx="0" cy="1" r="2" fill="#C2185B" />
    </g>

    {/* Delicate buds */}
    <circle cx="123" cy="13" r="3" fill="#FF5252" />
    <circle cx="72" cy="107" r="3" fill="#FF5252" />
    <circle cx="36" cy="69" r="3" fill="#FFD700" />

    {/* Hanging Red Traditional Lantern */}
    <g transform="translate(175, 42)">
      <line x1="0" y1="0" x2="0" y2="18" stroke="#D32F2F" strokeWidth="1.5" />
      <rect x="-8" y="18" width="16" height="4" rx="1.5" fill="#FFA000" />
      <ellipse cx="0" cy="33" rx="11" ry="13" fill="#D32F2F" />
      <ellipse cx="0" cy="33" rx="5" ry="13" fill="#F44336" />
      <rect x="-8" y="44" width="16" height="4" rx="1.5" fill="#FFA000" />
      <line x1="0" y1="48" x2="0" y2="60" stroke="#FFD54F" strokeWidth="2" />
    </g>
  </svg>
);

/**
 * Tết Sidebar Bottom Decoration (Bảo mật nghiêm ngặt, Bánh Chưng, Sóng mây hoàng kim, Hoa đào)
 * Matches master design mockup media_1793755577563_ed0ac1fd.jpg
 */
export const TetSidebarBottomDecor: React.FC<{ className?: string }> = ({ className = 'w-full' }) => (
  <div className={`flex flex-col gap-2.5 w-full select-none ${className}`}>
    {/* Security Privacy Card with Gold Shield Accent */}
    <div
      className="mx-2 p-2.5 rounded-xl border flex items-start space-x-2.5 transition-all shadow-xs"
      style={{
        backgroundColor: 'rgba(130, 30, 40, 0.75)',
        borderColor: 'rgba(212, 166, 74, 0.45)',
      }}
    >
      <div className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center bg-gradient-to-br from-[#E9B94F] to-[#D4A64A] text-[#821E28] shadow-xs">
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-[#FFFDF8] tracking-tight">Bảo mật nghiêm ngặt</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 shadow-2xs" />
        </div>
        <p className="text-[10px] text-[#F7EBD2] opacity-80 leading-tight mt-0.5">
          Giới hạn trong khóa học và học viên của bạn
        </p>
      </div>
    </div>

    {/* Traditional Vietnamese Bánh Chưng, Golden Wave & Peach Blossom */}
    <svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-28 px-1">
      <defs>
        <linearGradient id="banhchung_leaf" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#43A047" />
          <stop offset="100%" stopColor="#2E7D32" />
        </linearGradient>
        <linearGradient id="tet_gold_waves" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="100%" stopColor="#D4A64A" />
        </linearGradient>
      </defs>

      {/* Traditional Vietnamese Golden Cloud & Waves (Sóng mây triều khúc) */}
      <path
        d="M-10 120 C20 105 45 92 75 102 C105 112 135 96 165 106 C185 112 205 100 220 120 Z"
        fill="url(#tet_gold_waves)"
        opacity="0.3"
      />
      <path
        d="M-5 120 C25 100 55 110 85 96 C115 84 145 102 180 92 C198 96 210 106 220 120 Z"
        fill="none"
        stroke="url(#tet_gold_waves)"
        strokeWidth="1.5"
        opacity="0.55"
      />

      {/* Peach Blossom Branch arched behind */}
      <path d="M10 110 Q35 65 65 46 Q90 32 130 26" stroke="#8D6E63" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <circle cx="28" cy="76" r="5" fill="#FF80AB" />
      <circle cx="44" cy="56" r="4.5" fill="#FF4081" />
      <circle cx="72" cy="40" r="5" fill="#FF80AB" />
      <circle cx="100" cy="30" r="4.5" fill="#FF4081" />
      <circle cx="122" cy="24" r="3.5" fill="#FFD54F" />

      {/* Bánh Chưng */}
      <g transform="translate(18, 56)">
        <polygon points="10,40 55,55 90,40 45,25" fill="#1B5E20" opacity="0.4" />
        <polygon points="10,32 55,48 55,20 10,6" fill="url(#banhchung_leaf)" />
        <polygon points="55,48 95,32 95,6 55,20" fill="#2E7D32" />
        <polygon points="10,6 55,20 95,6 50,-6" fill="#66BB6A" />

        {/* Ties */}
        <polygon points="8,19 55,34 95,19 95,21 55,36 8,21" fill="#FFF59D" />
        <polygon points="9,14 55,29 95,14 95,16 55,31 9,16" fill="#FFF59D" />
        <polygon points="30,0 30,39 32,39 32,0" fill="#FFF59D" />
        <polygon points="72,0 72,39 74,39 74,0" fill="#FFF59D" />
      </g>

      {/* Red Diamond "Tết" Sign */}
      <g transform="translate(100, 40)">
        <polygon points="28,0 56,28 28,56 0,28" fill="#B9272F" stroke="#E9B94F" strokeWidth="2" />
        <polygon points="28,3.5 52.5,28 28,52.5 3.5,28" fill="none" stroke="#FFE082" strokeWidth="1" strokeDasharray="2 2" />
        <text
          x="28"
          y="35"
          fill="#FFFDF8"
          fontSize="17"
          fontWeight="bold"
          textAnchor="middle"
          fontFamily={SERIF_HEADING_FONT}
          fontStyle="italic"
        >
          Tết
        </text>
      </g>
    </svg>
  </div>
);


// =============================================================================
// 2. BACK TO SCHOOL ARTWORK (VINTAGE LIBRARY & ACADEMIC RENAISSANCE)
// =============================================================================

export const BackToSchoolCalligraphyTitle: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`flex flex-col select-none relative ${className}`} role="heading" aria-level={1}>
    <div className="flex items-center gap-3">
      {/* Vintage Academic Crest Stamp */}
      <div className="shrink-0 w-8 h-8 rounded-md bg-[#263D5B] border border-[#D4AF37] shadow-xs flex items-center justify-center rotate-[-2deg]">
        <svg viewBox="0 0 32 32" className="w-5 h-5 text-[#F5EBD7]" fill="none" stroke="currentColor">
          <circle cx="16" cy="16" r="12" strokeWidth="1.4" strokeDasharray="2 1" />
          <polygon points="16,6 20,12 16,18 12,12" fill="#D4AF37" stroke="none" />
          <path d="M10 22 Q16 19 22 22" stroke="#F5EBD7" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>

      <div className="relative inline-block">
        <span
          style={{
            fontFamily: SERIF_HEADING_FONT,
            fontStyle: 'italic',
            letterSpacing: '-0.015em',
            textShadow: '0 2px 4px rgba(38, 61, 91, 0.15)',
          }}
          className="text-2xl sm:text-3xl md:text-4xl font-black text-[#263D5B] leading-tight"
        >
          Chào mừng năm học mới!
        </span>
        {/* Navy/Gold scholastic stroke underline */}
        <svg viewBox="0 0 240 12" fill="none" className="w-48 sm:w-64 h-2.5 mt-0.5 text-[#263D5B] opacity-80">
          <path d="M2 6 Q 60 1, 120 7 Q 180 11, 238 4 Q 190 8, 120 5 Q 50 3, 2 6 Z" fill="currentColor" />
        </svg>
      </div>
    </div>

    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs sm:text-sm md:text-base font-semibold text-[#4A5D78]">
      <span className="opacity-90">Khởi đầu hành trình</span>
      <span
        style={{ fontFamily: SERIF_HEADING_FONT, fontStyle: 'italic' }}
        className="font-black text-[#263D5B] relative px-1"
      >
        <span>Khơi nguồn tri thức – Vững bước tương lai!</span>
        <span className="absolute bottom-0 left-0 w-full h-[2.5px] bg-gradient-to-r from-[#D4AF37] via-[#E5C158] to-[#263D5B] rounded-full" />
      </span>
    </div>
  </div>
);

export const BackToSchoolHeroArtwork: React.FC<{ className?: string }> = ({ className = 'w-44 h-36' }) => (
  <svg viewBox="0 0 180 160" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <linearGradient id="bts_desk" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#8D5B2A" />
        <stop offset="100%" stopColor="#5C3818" />
      </linearGradient>
      <linearGradient id="bts_gold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#F9D479" />
        <stop offset="100%" stopColor="#C8972E" />
      </linearGradient>
      <linearGradient id="bts_navy" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#2A4870" />
        <stop offset="100%" stopColor="#1B2F4A" />
      </linearGradient>
    </defs>

    <ellipse cx="90" cy="148" rx="70" ry="10" fill="#E6DCC8" opacity="0.6" />

    {/* Vintage Desk Base */}
    <path d="M15 140 L165 140 L155 148 L25 148 Z" fill="url(#bts_desk)" />

    {/* Stack of Classic Hardcover Books */}
    <g transform="translate(30, 68)">
      {/* Book 1 (Navy Oxford) */}
      <polygon points="0,48 55,62 105,48 55,36" fill="url(#bts_navy)" />
      <polygon points="0,48 55,62 55,70 0,56" fill="#14243B" />
      <polygon points="55,62 105,48 105,56 55,70" fill="#20395A" />
      <polygon points="2,47 55,60 103,47 55,38" fill="#FFFDF8" />
      {/* Gold foil lines on spine */}
      <line x1="10" y1="53" x2="35" y2="59" stroke="#E5C158" strokeWidth="1.2" />

      {/* Book 2 (Burgundy Leather) */}
      <g transform="translate(8, -16)">
        <polygon points="0,42 45,54 90,42 45,32" fill="#8B2635" />
        <polygon points="0,42 45,54 45,60 0,48" fill="#5E1621" />
        <polygon points="45,54 90,42 90,48 45,60" fill="#781F2C" />
        <polygon points="2,41 45,52 88,41 45,34" fill="#FBF8EE" />
      </g>

      {/* Graduation Cap (Mortarboard) */}
      <g transform="translate(18, -48)">
        <polygon points="34,0 68,14 34,28 0,14" fill="#1B2F4A" stroke="#0F1B2B" strokeWidth="0.8" />
        <polygon points="34,2 64,14 34,26 4,14" fill="#263D5B" />
        <path d="M18 19 C18 34 50 34 50 19 Z" fill="#14243B" />
        {/* Golden Silk Tassel */}
        <circle cx="34" cy="14" r="2.5" fill="url(#bts_gold)" />
        <path d="M34 14 C42 18 52 24 55 35" stroke="url(#bts_gold)" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        <polygon points="53,35 57,35 56,42 54,42" fill="#D4AF37" />
      </g>
    </g>

    {/* Vintage Brass Armillary Desk Globe on Right */}
    <g transform="translate(120, 52)">
      <circle cx="20" cy="30" r="18" fill="#8AB5DB" stroke="#D4AF37" strokeWidth="1.8" />
      <path d="M10 28 Q16 20 25 24 T32 38" fill="#9AC29D" opacity="0.8" />
      <ellipse cx="20" cy="30" rx="18" ry="6" stroke="#D4AF37" strokeWidth="1.5" fill="none" />
      <line x1="20" y1="10" x2="20" y2="50" stroke="#D4AF37" strokeWidth="1.8" />
      <path d="M38 30 C38 44 26 49 20 49 L20 62 L12 62 L28 62" stroke="#8D5B2A" strokeWidth="3" strokeLinecap="round" fill="none" />
    </g>

    {/* Soaring White Paper Airplane with Navy Dash Trail */}
    <g transform="translate(110, 18) rotate(-12)">
      <polygon points="0,16 28,0 14,24" fill="#FFFFFF" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.18))" />
      <polygon points="14,24 28,0 22,26" fill="#DCE5ED" />
      <path d="M-18 28 Q-8 22 2 18" stroke="#D4AF37" strokeWidth="1.5" strokeDasharray="3 2" fill="none" />
    </g>
  </svg>
);

export const BackToSchoolCornerDecor: React.FC<{ className?: string }> = ({ className = 'w-48 h-32' }) => (
  <svg viewBox="0 0 240 140" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Antique Brass Library Lamp & Oak Branch */}
    <path d="M240 0 Q190 10 160 30 T90 55" stroke="#7A4B28" strokeWidth="4" strokeLinecap="round" fill="none" />
    <path d="M165 28 Q140 15 120 10" stroke="#7A4B28" strokeWidth="2.5" strokeLinecap="round" fill="none" />

    {/* Oak leaves */}
    <path d="M125 10 C120 5 130 0 138 6 C144 0 152 4 150 12 Z" fill="#9DAF6B" />
    <path d="M95 55 C90 50 98 45 106 50 C112 45 118 48 116 56 Z" fill="#B48744" />

    {/* Hanging Vintage Brass Pocket Watch */}
    <g transform="translate(180, 24)">
      <line x1="0" y1="0" x2="0" y2="28" stroke="#D4AF37" strokeWidth="1.5" strokeDasharray="3 1" />
      <circle cx="0" cy="38" r="14" fill="#FFFBEA" stroke="#D4AF37" strokeWidth="2.5" />
      <circle cx="0" cy="38" r="11" stroke="#B8860B" strokeWidth="0.8" fill="none" />
      <line x1="0" y1="38" x2="0" y2="30" stroke="#263D5B" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="0" y1="38" x2="4" y2="40" stroke="#263D5B" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="0" cy="38" r="1.5" fill="#D4AF37" />
    </g>

    {/* Academic Gold Laurel Wreath Sprig */}
    <g transform="translate(130, 36) rotate(-20)">
      <path d="M0 20 Q15 10 30 18" stroke="#D4AF37" strokeWidth="1.5" fill="none" />
      <ellipse cx="6" cy="14" rx="4" ry="2" fill="#F4CF68" transform="rotate(-30 6 14)" />
      <ellipse cx="16" cy="12" rx="4" ry="2" fill="#F4CF68" transform="rotate(-15 16 12)" />
      <ellipse cx="25" cy="15" rx="4" ry="2" fill="#F4CF68" transform="rotate(10 25 15)" />
    </g>
  </svg>
);

export const BackToSchoolSidebarDecor: React.FC<{ className?: string }> = ({ className = 'w-full h-34' }) => (
  <svg viewBox="0 0 200 130" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <g transform="translate(25, 30)">
      {/* Leather Book Stack */}
      <rect x="10" y="55" width="85" height="15" rx="2" fill="#263D5B" stroke="#1B2F4A" strokeWidth="1" />
      <rect x="12" y="57" width="81" height="3" fill="#D4AF37" opacity="0.8" />
      <rect x="18" y="42" width="75" height="13" rx="2" fill="#8B2635" stroke="#5E1621" strokeWidth="1" />
      <rect x="20" y="44" width="71" height="3" fill="#FFE5A3" opacity="0.7" />
      <rect x="25" y="30" width="65" height="12" rx="2" fill="#3D5A45" stroke="#25382B" strokeWidth="1" />

      {/* Bookmark Ribbon cascading */}
      <path d="M50 30 L50 68 L54 64 L58 68 L58 30" fill="#D4AF37" />

      {/* Brass Compass Tool */}
      <g transform="translate(105, 35)">
        <circle cx="20" cy="5" r="4" fill="#D4AF37" />
        <line x1="20" y1="5" x2="8" y2="45" stroke="#D4AF37" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="20" y1="5" x2="32" y2="45" stroke="#D4AF37" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M12 25 Q20 30 28 25" stroke="#B8860B" strokeWidth="1.2" fill="none" />
      </g>
    </g>
  </svg>
);


// =============================================================================
// 3. MID-AUTUMN ARTWORK (MOONLIT LANTERN GARDEN & JADE PALACE)
// =============================================================================

export const MidAutumnCalligraphyTitle: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`flex flex-col select-none relative ${className}`} role="heading" aria-level={1}>
    <div className="flex items-center gap-3">
      {/* Golden Moon Rabbit Seal Stamp */}
      <div className="shrink-0 w-8 h-8 rounded-md bg-[#C94B42] border border-[#F3C262] shadow-xs flex items-center justify-center rotate-[-2deg]">
        <svg viewBox="0 0 32 32" className="w-5 h-5 text-[#FFF59D]" fill="currentColor">
          <circle cx="16" cy="16" r="11" fill="none" stroke="#F3C262" strokeWidth="1.2" />
          <path d="M13 19 C13 14 19 14 19 19 Z" />
          <ellipse cx="14" cy="11" rx="1.5" ry="4" transform="rotate(-15 14 11)" />
          <ellipse cx="17" cy="11" rx="1.5" ry="4" transform="rotate(10 17 11)" />
        </svg>
      </div>

      <div className="relative inline-block">
        <span
          style={{
            fontFamily: SERIF_HEADING_FONT,
            fontStyle: 'italic',
            letterSpacing: '-0.015em',
            textShadow: '0 2px 4px rgba(201, 75, 66, 0.18)',
          }}
          className="text-2xl sm:text-3xl md:text-4xl font-black text-[#C94B42] leading-tight"
        >
          Vui hội Trăng Rằm!
        </span>
        <svg viewBox="0 0 240 12" fill="none" className="w-48 sm:w-64 h-2.5 mt-0.5 text-[#C94B42] opacity-80">
          <path d="M2 6 Q 60 1, 120 7 Q 180 11, 238 4 Q 190 8, 120 5 Q 50 3, 2 6 Z" fill="currentColor" />
        </svg>
      </div>
    </div>

    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs sm:text-sm md:text-base font-semibold text-[#8B423B]">
      <span className="opacity-90">Đêm hội trăng rằm</span>
      <span
        style={{ fontFamily: SERIF_HEADING_FONT, fontStyle: 'italic' }}
        className="font-black text-[#C94B42] relative px-1"
      >
        <span>Ấm áp đoàn viên – Rực rỡ ước mơ!</span>
        <span className="absolute bottom-0 left-0 w-full h-[2.5px] bg-gradient-to-r from-[#F3C262] via-[#FFA726] to-[#C94B42] rounded-full" />
      </span>
    </div>
  </div>
);

export const MidAutumnHeroArtwork: React.FC<{ className?: string }> = ({ className = 'w-44 h-36' }) => (
  <svg viewBox="0 0 180 160" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <radialGradient id="mid_moon_rich" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#FFFEE8" />
        <stop offset="60%" stopColor="#FFE082" />
        <stop offset="100%" stopColor="#FFB300" />
      </radialGradient>
      <filter id="moon_glow_soft" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="5" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>

    {/* Luminous Golden Full Moon */}
    <circle cx="85" cy="65" r="48" fill="url(#mid_moon_rich)" filter="url(#moon_glow_soft)" opacity="0.95" />
    <path d="M68 45 Q75 35 88 40 T105 52 Q95 65 75 60 Z" fill="#F57F17" opacity="0.12" />

    {/* Jade Rabbit Silhouette admiring moon */}
    <g transform="translate(62, 58)">
      <ellipse cx="14" cy="22" rx="9" ry="11" fill="#FFFFFF" opacity="0.9" />
      <circle cx="16" cy="11" r="7" fill="#FFFFFF" opacity="0.9" />
      <ellipse cx="14" cy="4" rx="2" ry="6" fill="#FFFFFF" opacity="0.9" transform="rotate(-15 14 4)" />
      <ellipse cx="19" cy="4" rx="2" ry="6" fill="#FFFFFF" opacity="0.9" transform="rotate(8 19 4)" />
      <circle cx="21" cy="10" r="1" fill="#FF8A80" />
    </g>

    {/* Vietnamese Traditional Đèn Ông Sao (Star Lantern) */}
    <g transform="translate(125, 75)">
      <line x1="-20" y1="52" x2="35" y2="-15" stroke="#A1887F" strokeWidth="3" strokeLinecap="round" />
      <circle cx="0" cy="0" r="28" stroke="#D84315" strokeWidth="2.5" strokeDasharray="4 2" fill="none" />
      <polygon
        points="0,-26 8,-8 26,-8 12,3 18,22 0,10 -18,22 -12,3 -26,-8 -8,-8"
        fill="#E53935"
        stroke="#FFEB3B"
        strokeWidth="2"
      />
      <polygon
        points="0,-13 4,-3 13,-3 6,2 9,11 0,5 -9,11 -6,2 -13,-3 -4,-3"
        fill="#FFD54F"
      />
      <line x1="0" y1="22" x2="-4" y2="42" stroke="#FF5722" strokeWidth="2" />
      <line x1="0" y1="22" x2="4" y2="42" stroke="#FFCA28" strokeWidth="2" />
    </g>

    {/* Floating Mid-Autumn Clouds */}
    <path
      d="M15 125 C30 110 55 112 68 120 C80 108 108 108 120 120 C135 112 155 115 168 126 Z"
      fill="#FFF9E6"
      opacity="0.9"
    />
  </svg>
);

export const MidAutumnCornerDecor: React.FC<{ className?: string }> = ({ className = 'w-48 h-32' }) => (
  <svg viewBox="0 0 240 140" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Moonlit Bamboo Sprig & Hanging Paper Lantern */}
    <path d="M240 0 Q180 20 140 45 T70 70" stroke="#4E7055" strokeWidth="4" strokeLinecap="round" fill="none" />
    <path d="M150 40 Q130 15 110 10" stroke="#4E7055" strokeWidth="2.5" fill="none" />

    {/* Bamboo leaves */}
    <path d="M110 10 Q90 5 80 15 Q100 15 110 10 Z" fill="#6B9674" />
    <path d="M140 45 Q120 40 110 50 Q130 50 140 45 Z" fill="#588562" />
    <path d="M70 70 Q50 65 40 75 Q60 75 70 70 Z" fill="#6B9674" />

    {/* Hanging Red Oval Lantern */}
    <g transform="translate(180, 30)">
      <line x1="0" y1="0" x2="0" y2="20" stroke="#C94B42" strokeWidth="1.5" />
      <ellipse cx="0" cy="38" rx="14" ry="18" fill="#C94B42" stroke="#FFD54F" strokeWidth="1.5" />
      <ellipse cx="0" cy="38" rx="7" ry="18" fill="#E53935" />
      <rect x="-10" y="18" width="20" height="4" rx="1.5" fill="#FFA000" />
      <rect x="-10" y="54" width="20" height="4" rx="1.5" fill="#FFA000" />
      <line x1="0" y1="58" x2="0" y2="75" stroke="#FFD54F" strokeWidth="2" />
    </g>
  </svg>
);

export const MidAutumnSidebarDecor: React.FC<{ className?: string }> = ({ className = 'w-full h-34' }) => (
  <svg viewBox="0 0 200 130" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <g transform="translate(30, 25)">
      {/* Lacquer Tray */}
      <ellipse cx="70" cy="75" rx="65" ry="24" fill="#8B2635" stroke="#C94B42" strokeWidth="2" />
      <ellipse cx="70" cy="73" rx="60" ry="20" fill="#5E1621" />

      {/* Baked Mooncake (Bánh Nướng) */}
      <ellipse cx="45" cy="65" rx="28" ry="16" fill="#C96825" stroke="#8D420F" strokeWidth="1.5" />
      <ellipse cx="45" cy="60" rx="24" ry="12" fill="#E07F38" />
      <circle cx="45" cy="60" r="7" stroke="#FFE082" strokeWidth="1.5" fill="none" />
      <circle cx="45" cy="60" r="2.5" fill="#FFF59D" />

      {/* Snowskin Mooncake (Bánh Dẻo) */}
      <ellipse cx="95" cy="62" rx="24" ry="14" fill="#E8F5E9" stroke="#C8E6C9" strokeWidth="1.5" />
      <ellipse cx="95" cy="58" rx="20" ry="10" fill="#FFFFFF" />
      <circle cx="95" cy="58" r="5" stroke="#A5D6A7" strokeWidth="1.2" fill="none" />

      {/* Steaming Celadon Teacup */}
      <ellipse cx="125" cy="45" rx="12" ry="7" fill="#80CBC4" stroke="#4DB6AC" strokeWidth="1.5" />
      <ellipse cx="125" cy="43" rx="10" ry="5" fill="#FFE082" />
      <path d="M125 38 Q127 30 123 24" stroke="#FFF" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" fill="none" />
    </g>
  </svg>
);


// =============================================================================
// 4. HALLOWEEN ARTWORK (ENCHANTED ACADEMY & AUTUMN HARVEST)
// =============================================================================

export const HalloweenCalligraphyTitle: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`flex flex-col select-none relative ${className}`} role="heading" aria-level={1}>
    <div className="flex items-center gap-3">
      {/* Magic Witch Hat / Pumpkin Seal Stamp */}
      <div className="shrink-0 w-8 h-8 rounded-md bg-[#2D1E45] border border-[#FFA726] shadow-xs flex items-center justify-center rotate-[-3deg]">
        <svg viewBox="0 0 32 32" className="w-5 h-5 text-[#FFA726]" fill="currentColor">
          <polygon points="16,4 12,18 20,18" />
          <ellipse cx="16" cy="18" rx="10" ry="3" />
          <circle cx="16" cy="17" r="1.5" fill="#FFF9C4" />
        </svg>
      </div>

      <div className="relative inline-block">
        <span
          style={{
            fontFamily: SERIF_HEADING_FONT,
            fontStyle: 'italic',
            letterSpacing: '-0.015em',
            textShadow: '0 2px 4px rgba(112, 81, 127, 0.2)',
          }}
          className="text-2xl sm:text-3xl md:text-4xl font-black text-[#DF7A28] leading-tight"
        >
          Mùa Lễ Hội Kỳ Bí!
        </span>
        <svg viewBox="0 0 240 12" fill="none" className="w-48 sm:w-64 h-2.5 mt-0.5 text-[#DF7A28] opacity-80">
          <path d="M2 6 Q 60 1, 120 7 Q 180 11, 238 4 Q 190 8, 120 5 Q 50 3, 2 6 Z" fill="currentColor" />
        </svg>
      </div>
    </div>

    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs sm:text-sm md:text-base font-semibold text-[#664673]">
      <span className="opacity-90">Đêm nhiệm màu</span>
      <span
        style={{ fontFamily: SERIF_HEADING_FONT, fontStyle: 'italic' }}
        className="font-black text-[#DF7A28] relative px-1"
      >
        <span>Bí ngô rực sáng – Khám phá tri thức!</span>
        <span className="absolute bottom-0 left-0 w-full h-[2.5px] bg-gradient-to-r from-[#FFA726] via-[#BA68C8] to-[#DF7A28] rounded-full" />
      </span>
    </div>
  </div>
);

export const HalloweenHeroArtwork: React.FC<{ className?: string }> = ({ className = 'w-44 h-36' }) => (
  <svg viewBox="0 0 180 160" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <linearGradient id="hall_pumpkin_rich" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFA726" />
        <stop offset="100%" stopColor="#E65100" />
      </linearGradient>
    </defs>

    {/* Crescent Moon & Magical Twinkling Stars */}
    <path d="M135 25 C120 30 112 45 116 60 C102 50 105 30 122 22 C127 20 133 21 135 25 Z" fill="#FFE082" />
    <polygon points="90,30 92,35 97,36 93,39 94,44 90,41 86,44 87,39 83,36 88,35" fill="#FFE082" />
    <polygon points="145,55 146,58 149,59 147,61 147,64 145,62 143,64 143,61 141,59 144,58" fill="#FFE082" />

    {/* Friendly Jack-o'-lantern Pumpkin */}
    <g transform="translate(45, 65)">
      {/* Green Curved Stem */}
      <path d="M42 4 C43 -5 50 -6 54 -4 C52 1 48 4 46 5 Z" fill="#558B2F" />

      {/* Pumpkin Lobes */}
      <ellipse cx="22" cy="35" rx="18" ry="24" fill="#E65100" />
      <ellipse cx="68" cy="35" rx="18" ry="24" fill="#E65100" />
      <ellipse cx="32" cy="35" rx="18" ry="27" fill="url(#hall_pumpkin_rich)" />
      <ellipse cx="58" cy="35" rx="18" ry="27" fill="url(#hall_pumpkin_rich)" />
      <ellipse cx="45" cy="35" rx="17" ry="28" fill="#FFA726" />

      {/* Glowing Carved Eyes */}
      <polygon points="34,26 40,22 41,29" fill="#FFFDE7" />
      <polygon points="56,26 50,22 49,29" fill="#FFFDE7" />
      <polygon points="45,32 42,37 48,37" fill="#FFFDE7" />
      <path d="M30 42 Q45 56 60 42 Q52 49 45 45 Q38 49 30 42 Z" fill="#FFFDE7" />
    </g>

    {/* Friendly Floating Wizard Owl with Witch Hat */}
    <g transform="translate(100, 38)">
      {/* Owl Body */}
      <ellipse cx="20" cy="35" rx="14" ry="18" fill="#5D4037" />
      <ellipse cx="20" cy="38" rx="9" ry="12" fill="#D7CCC8" />
      {/* Large Glowing Eyes */}
      <circle cx="15" cy="30" r="5" fill="#FFE082" />
      <circle cx="25" cy="30" r="5" fill="#FFE082" />
      <circle cx="15" cy="30" r="2.5" fill="#212121" />
      <circle cx="25" cy="30" r="2.5" fill="#212121" />
      <polygon points="20,33 18,37 22,37" fill="#FFB300" />

      {/* Purple Wizard Hat */}
      <polygon points="20,5 10,22 30,22" fill="#4A148C" />
      <ellipse cx="20" cy="22" rx="15" ry="3" fill="#6A1B9A" />
      <rect x="12" y="19" width="16" height="3" fill="#FFA726" />
    </g>
  </svg>
);

export const HalloweenCornerDecor: React.FC<{ className?: string }> = ({ className = 'w-48 h-32' }) => (
  <svg viewBox="0 0 240 140" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Twisting Enchanted Autumn Bough */}
    <path d="M240 0 Q190 15 150 40 T70 65" stroke="#3E2723" strokeWidth="4.5" strokeLinecap="round" fill="none" />
    <path d="M160 35 Q135 15 110 20" stroke="#3E2723" strokeWidth="2.5" fill="none" />

    {/* Dangling Glowing Mini Pumpkin */}
    <g transform="translate(180, 25)">
      <line x1="0" y1="0" x2="0" y2="25" stroke="#795548" strokeWidth="1.5" />
      <ellipse cx="0" cy="35" rx="11" ry="9" fill="#FFA726" stroke="#E65100" strokeWidth="1.2" />
      <path d="M-4 35 Q0 38 4 35" stroke="#5D4037" strokeWidth="1" fill="none" />
    </g>

    {/* Dangling Magic Potion Bottle */}
    <g transform="translate(125, 30)">
      <line x1="0" y1="0" x2="0" y2="30" stroke="#795548" strokeWidth="1.2" />
      <rect x="-3" y="30" width="6" height="3" fill="#8D6E63" />
      <path d="M-3 33 L-7 46 C-7 50 7 50 7 46 L3 33 Z" fill="#BA68C8" stroke="#4A148C" strokeWidth="1.2" />
      <circle cx="0" cy="42" r="2" fill="#FFF" opacity="0.6" />
    </g>
  </svg>
);

export const HalloweenSidebarDecor: React.FC<{ className?: string }> = ({ className = 'w-full h-34' }) => (
  <svg viewBox="0 0 200 130" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <g transform="translate(40, 25)">
      {/* Heirloom Pumpkins & Magic Spellbook */}
      <polygon points="15,65 75,78 135,65 75,54" fill="#3E2723" />
      <polygon points="18,63 75,75 132,63 75,56" fill="#4A148C" />

      {/* Pumpkin sitting on book */}
      <ellipse cx="65" cy="45" rx="22" ry="16" fill="#F57C00" />
      <ellipse cx="65" cy="43" rx="18" ry="15" fill="#FFA726" />
      <path d="M65 28 Q67 22 70 24" stroke="#558B2F" strokeWidth="3" fill="none" />

      {/* Magic Wand with Gold Star */}
      <line x1="105" y1="15" x2="135" y2="65" stroke="#7E57C2" strokeWidth="3" strokeLinecap="round" />
      <polygon points="105,15 103,11 108,13 110,9 111,14 116,14 112,17 113,22 109,19 106,21" fill="#FFD54F" />
    </g>
  </svg>
);


// =============================================================================
// 5. WOMEN'S DAY 8/3 ARTWORK (HAUTE PARFUMERIE & LUXURY FLORAL ATELIER)
// =============================================================================

export const WomensDay83CalligraphyTitle: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`flex flex-col select-none relative ${className}`} role="heading" aria-level={1}>
    <div className="flex items-center gap-3">
      {/* French Ribbon / Peony Atelier Seal */}
      <div className="shrink-0 w-8 h-8 rounded-md bg-[#C95E73] border border-[#E6C994] shadow-xs flex items-center justify-center rotate-[-2deg]">
        <svg viewBox="0 0 32 32" className="w-5 h-5 text-[#FFF5F6]" fill="currentColor">
          <circle cx="16" cy="16" r="11" fill="none" stroke="#E6C994" strokeWidth="1.2" />
          <path d="M12 16 C12 12 20 12 20 16 C20 20 12 20 12 16 Z" fill="#FFF5F6" />
          <circle cx="16" cy="16" r="2.5" fill="#E6C994" />
        </svg>
      </div>

      <div className="relative inline-block">
        <span
          style={{
            fontFamily: SERIF_HEADING_FONT,
            fontStyle: 'italic',
            letterSpacing: '-0.015em',
            textShadow: '0 2px 4px rgba(201, 94, 115, 0.18)',
          }}
          className="text-2xl sm:text-3xl md:text-4xl font-black text-[#C95E73] leading-tight"
        >
          Chúc mừng Ngày Quốc tế Phụ nữ 8/3!
        </span>
        <svg viewBox="0 0 240 12" fill="none" className="w-48 sm:w-64 h-2.5 mt-0.5 text-[#C95E73] opacity-80">
          <path d="M2 6 Q 60 1, 120 7 Q 180 11, 238 4 Q 190 8, 120 5 Q 50 3, 2 6 Z" fill="currentColor" />
        </svg>
      </div>
    </div>

    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs sm:text-sm md:text-base font-semibold text-[#8C3A4B]">
      <span className="opacity-90">Trao gửi yêu thương</span>
      <span
        style={{ fontFamily: SERIF_HEADING_FONT, fontStyle: 'italic' }}
        className="font-black text-[#C95E73] relative px-1"
      >
        <span>Tôn vinh vẻ đẹp – Tỏa sáng tri thức!</span>
        <span className="absolute bottom-0 left-0 w-full h-[2.5px] bg-gradient-to-r from-[#E6C994] via-[#F48FB1] to-[#C95E73] rounded-full" />
      </span>
    </div>
  </div>
);

export const WomensDay83HeroArtwork: React.FC<{ className?: string }> = ({ className = 'w-44 h-36' }) => (
  <svg viewBox="0 0 180 160" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <linearGradient id="rose_grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#F8BBD0" />
        <stop offset="100%" stopColor="#C2185B" />
      </linearGradient>
    </defs>

    {/* Luxury French Floral Atelier Bouquet */}
    <g transform="translate(45, 20)">
      {/* Central Velvety Rose/Peony */}
      <circle cx="50" cy="55" r="28" fill="#F8BBD0" opacity="0.6" />
      <circle cx="50" cy="55" r="22" fill="#F06292" />
      <circle cx="50" cy="55" r="16" fill="#E91E63" />
      <circle cx="50" cy="55" r="10" fill="#C2185B" />
      <path d="M45 50 Q50 42 58 48 Q64 56 54 62 Q42 62 42 54" stroke="#FFF" strokeWidth="1.8" strokeLinecap="round" fill="none" />

      {/* Side Peonies */}
      <circle cx="20" cy="68" r="16" fill="#F48FB1" />
      <circle cx="20" cy="68" r="10" fill="#EC407A" />
      <circle cx="80" cy="68" r="16" fill="#FF80AB" />
      <circle cx="80" cy="68" r="10" fill="#F50057" />

      {/* Botanical Eucalyptus Leaves */}
      <path d="M8 62 Q-6 48 12 42 Q20 52 8 62 Z" fill="#81C784" />
      <path d="M88 62 Q108 48 88 42 Q80 52 88 62 Z" fill="#81C784" />

      {/* Elegant Perfume Flacon on side */}
      <g transform="translate(75, 80)">
        <rect x="0" y="8" width="22" height="28" rx="4" fill="#FFF9F9" stroke="#E6C994" strokeWidth="1.5" />
        <rect x="7" y="2" width="8" height="6" fill="#D4AF37" />
        <circle cx="11" cy="22" r="5" fill="#F8BBD0" opacity="0.5" />
      </g>

      {/* Satin Ribbon Bow */}
      <path d="M42 85 C35 110 20 125 15 130" stroke="#D4AF37" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M58 85 C65 110 80 125 85 130" stroke="#D4AF37" strokeWidth="3" strokeLinecap="round" fill="none" />
      <ellipse cx="44" cy="88" rx="8" ry="5" fill="#D4AF37" />
      <ellipse cx="56" cy="88" rx="8" ry="5" fill="#D4AF37" />
      <circle cx="50" cy="88" r="3.5" fill="#B8860B" />
    </g>
  </svg>
);

export const WomensDay83CornerDecor: React.FC<{ className?: string }> = ({ className = 'w-48 h-32' }) => (
  <svg viewBox="0 0 240 140" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* French Rose Arch & Ribbon */}
    <path d="M240 0 Q180 15 140 40 T60 65" stroke="#E6C994" strokeWidth="2.5" strokeLinecap="round" fill="none" />

    {/* Blush Peonies */}
    <g transform="translate(180, 20)">
      <circle cx="0" cy="0" r="15" fill="#F8BBD0" />
      <circle cx="0" cy="0" r="10" fill="#E91E63" />
      <circle cx="0" cy="0" r="5" fill="#C2185B" />
    </g>
    <g transform="translate(130, 42)">
      <circle cx="0" cy="0" r="12" fill="#FF80AB" />
      <circle cx="0" cy="0" r="8" fill="#F50057" />
    </g>
    <g transform="translate(80, 60)">
      <circle cx="0" cy="0" r="9" fill="#F48FB1" />
      <circle cx="0" cy="0" r="5" fill="#E91E63" />
    </g>
  </svg>
);

export const WomensDay83SidebarDecor: React.FC<{ className?: string }> = ({ className = 'w-full h-34' }) => (
  <svg viewBox="0 0 200 130" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <g transform="translate(45, 25)">
      {/* Parisian Hatbox Flower Arrangement */}
      <rect x="25" y="48" width="60" height="32" rx="4" fill="#FFF0F2" stroke="#F48FB1" strokeWidth="1.5" />
      <path d="M25 60 L85 60" stroke="#D4AF37" strokeWidth="2" />
      <circle cx="55" cy="60" r="4" fill="#D4AF37" />

      {/* Roses in box */}
      <circle cx="42" cy="40" r="13" fill="#E91E63" />
      <circle cx="42" cy="40" r="7" fill="#C2185B" />
      <circle cx="68" cy="38" r="12" fill="#F06292" />
      <circle cx="68" cy="38" r="6" fill="#D81B60" />
      <circle cx="55" cy="28" r="10" fill="#FF80AB" />
    </g>
  </svg>
);


// =============================================================================
// 6. VIETNAMESE WOMEN'S DAY 20/10 ARTWORK (VIETNAMESE LOTUS & LACQUER SILK)
// =============================================================================

export const WomensDay2010CalligraphyTitle: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`flex flex-col select-none relative ${className}`} role="heading" aria-level={1}>
    <div className="flex items-center gap-3">
      {/* Imperial Vietnamese Lotus Seal Stamp */}
      <div className="shrink-0 w-8 h-8 rounded-md bg-[#9E2935] border border-[#C49746] shadow-xs flex items-center justify-center rotate-[-2deg]">
        <svg viewBox="0 0 32 32" className="w-5 h-5 text-[#FFF9E6]" fill="currentColor">
          <circle cx="16" cy="16" r="11" fill="none" stroke="#C49746" strokeWidth="1.2" />
          <path d="M16 8 C14 14 10 18 16 22 C22 18 18 14 16 8 Z" fill="#FFF9E6" />
        </svg>
      </div>

      <div className="relative inline-block">
        <span
          style={{
            fontFamily: SERIF_HEADING_FONT,
            fontStyle: 'italic',
            letterSpacing: '-0.015em',
            textShadow: '0 2px 4px rgba(158, 41, 53, 0.2)',
          }}
          className="text-2xl sm:text-3xl md:text-4xl font-black text-[#9E2935] leading-tight"
        >
          Chúc mừng Ngày Phụ nữ Việt Nam 20/10!
        </span>
        <svg viewBox="0 0 240 12" fill="none" className="w-48 sm:w-64 h-2.5 mt-0.5 text-[#9E2935] opacity-80">
          <path d="M2 6 Q 60 1, 120 7 Q 180 11, 238 4 Q 190 8, 120 5 Q 50 3, 2 6 Z" fill="currentColor" />
        </svg>
      </div>
    </div>

    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs sm:text-sm md:text-base font-semibold text-[#73222B]">
      <span className="opacity-90">Tôn vinh nét đẹp truyền thống</span>
      <span
        style={{ fontFamily: SERIF_HEADING_FONT, fontStyle: 'italic' }}
        className="font-black text-[#9E2935] relative px-1"
      >
        <span>Duyên dáng Việt Nam – Vẹn tròn tri thức!</span>
        <span className="absolute bottom-0 left-0 w-full h-[2.5px] bg-gradient-to-r from-[#C49746] via-[#D15B77] to-[#9E2935] rounded-full" />
      </span>
    </div>
  </div>
);

export const WomensDay2010HeroArtwork: React.FC<{ className?: string }> = ({ className = 'w-44 h-36' }) => (
  <svg viewBox="0 0 180 160" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Pink Vietnamese Lotus Blossom (Hoa Sen Hồng) with Traditional Ceramic Base */}
    <g transform="translate(45, 25)">
      {/* Outer Lotus Petals */}
      <path d="M50 85 C15 70 10 40 45 35 C40 55 45 75 50 85 Z" fill="#F48FB1" opacity="0.85" />
      <path d="M50 85 C85 70 90 40 55 35 C60 55 55 75 50 85 Z" fill="#F48FB1" opacity="0.85" />

      {/* Mid Petals */}
      <path d="M50 85 C28 65 28 30 50 15 C55 35 52 70 50 85 Z" fill="#EC407A" />
      <path d="M50 85 C72 65 72 30 50 15 C45 35 48 70 50 85 Z" fill="#D81B60" />

      {/* Center Lotus Bud Petal */}
      <path d="M50 85 C42 60 42 22 50 10 C58 22 58 60 50 85 Z" fill="#9E2935" />
      {/* Golden Lotus Center / Stamen */}
      <ellipse cx="50" cy="55" rx="6" ry="4" fill="#FFD54F" />

      {/* Lotus Pod / Green Base */}
      <ellipse cx="50" cy="88" rx="16" ry="6" fill="#43A047" />
      <path d="M50 94 Q48 115 52 135" stroke="#2E7D32" strokeWidth="3.5" strokeLinecap="round" fill="none" />

      {/* Floating Vietnamese Silk Ribbon & Lotus Leaf */}
      <ellipse cx="18" cy="115" rx="18" ry="7" fill="#66BB6A" opacity="0.9" />
      <ellipse cx="82" cy="118" rx="18" ry="7" fill="#66BB6A" opacity="0.9" />
      <path d="M15 95 Q50 120 85 95" stroke="#C49746" strokeWidth="2.5" fill="none" />
    </g>
  </svg>
);

export const WomensDay2010CornerDecor: React.FC<{ className?: string }> = ({ className = 'w-48 h-32' }) => (
  <svg viewBox="0 0 240 140" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Vietnamese Lotus Pond Arch & Lacquer Silk Drape */}
    <path d="M240 0 Q180 20 140 45 T70 70" stroke="#9E2935" strokeWidth="3" strokeLinecap="round" fill="none" />

    {/* Lotus Blossoms */}
    <g transform="translate(170, 25)">
      <circle cx="0" cy="0" r="14" fill="#F48FB1" />
      <circle cx="0" cy="0" r="8" fill="#C2185B" />
      <circle cx="0" cy="0" r="3" fill="#FFD54F" />
    </g>
    <g transform="translate(115, 50)">
      <circle cx="0" cy="0" r="10" fill="#EC407A" />
      <circle cx="0" cy="0" r="5" fill="#9E2935" />
    </g>

    {/* Lotus Leaf dewdrops */}
    <ellipse cx="75" cy="72" rx="14" ry="6" fill="#43A047" />
    <circle cx="75" cy="71" r="2" fill="#E8F5E9" />
  </svg>
);

export const WomensDay2010SidebarDecor: React.FC<{ className?: string }> = ({ className = 'w-full h-34' }) => (
  <svg viewBox="0 0 200 130" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <g transform="translate(55, 25)">
      {/* Bat Trang Ceramic Vase */}
      <path d="M25 45 C15 55 12 75 25 85 C32 85 48 85 55 85 C68 75 65 55 55 45 Z" fill="#FFF9E6" stroke="#C49746" strokeWidth="1.8" />
      {/* Lotus Blooms in Vase */}
      <circle cx="40" cy="28" r="15" fill="#F06292" />
      <circle cx="40" cy="28" r="9" fill="#9E2935" />
      <circle cx="40" cy="28" r="3" fill="#FFD54F" />
      {/* Folded Silk Scarf draped */}
      <path d="M15 80 Q35 90 55 80 L60 95 L20 95 Z" fill="#C49746" opacity="0.8" />
    </g>
  </svg>
);


// =============================================================================
// 7. TEACHERS' DAY 20/11 ARTWORK (THE ART OF APPRECIATION)
// =============================================================================

export const TeachersDayCalligraphyTitle: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`flex flex-col select-none relative ${className}`} role="heading" aria-level={1}>
    <div className="flex items-center gap-3">
      {/* Scholastic Laurel & Chalkboard Seal */}
      <div className="shrink-0 w-8 h-8 rounded-md bg-[#2F6B55] border border-[#D4AF37] shadow-xs flex items-center justify-center rotate-[-2deg]">
        <svg viewBox="0 0 32 32" className="w-5 h-5 text-[#FAF6EC]" fill="none" stroke="currentColor">
          <circle cx="16" cy="16" r="11" strokeWidth="1.2" strokeDasharray="2 1" />
          <path d="M11 20 Q16 12 21 20" stroke="#D4AF37" strokeWidth="1.5" />
          <line x1="16" y1="10" x2="16" y2="15" stroke="#FAF6EC" strokeWidth="1.5" />
        </svg>
      </div>

      <div className="relative inline-block">
        <span
          style={{
            fontFamily: SERIF_HEADING_FONT,
            fontStyle: 'italic',
            letterSpacing: '-0.015em',
            textShadow: '0 2px 4px rgba(47, 107, 85, 0.18)',
          }}
          className="text-2xl sm:text-3xl md:text-4xl font-black text-[#2F6B55] leading-tight"
        >
          Tri ân Ngày Nhà giáo Việt Nam 20/11!
        </span>
        <svg viewBox="0 0 240 12" fill="none" className="w-48 sm:w-64 h-2.5 mt-0.5 text-[#2F6B55] opacity-80">
          <path d="M2 6 Q 60 1, 120 7 Q 180 11, 238 4 Q 190 8, 120 5 Q 50 3, 2 6 Z" fill="currentColor" />
        </svg>
      </div>
    </div>

    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs sm:text-sm md:text-base font-semibold text-[#1F4C3B]">
      <span className="opacity-90">Truyền thống tôn sư</span>
      <span
        style={{ fontFamily: SERIF_HEADING_FONT, fontStyle: 'italic' }}
        className="font-black text-[#2F6B55] relative px-1"
      >
        <span>Tôn sư trọng đạo – Ngàn lời tri ân!</span>
        <span className="absolute bottom-0 left-0 w-full h-[2.5px] bg-gradient-to-r from-[#D4AF37] via-[#557866] to-[#2F6B55] rounded-full" />
      </span>
    </div>
  </div>
);

export const TeachersDayHeroArtwork: React.FC<{ className?: string }> = ({ className = 'w-44 h-36' }) => (
  <svg viewBox="0 0 180 160" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <g transform="translate(35, 25)">
      {/* Open Leather Lesson Plan Book */}
      <polygon points="5,60 50,75 95,60 50,48" fill="#2F6B55" />
      <polygon points="5,60 50,75 50,83 5,68" fill="#1F4C3B" />
      <polygon points="50,75 95,60 95,68 50,83" fill="#255845" />
      <polygon points="8,59 50,73 92,59 50,50" fill="#FAF6EC" />
      {/* Score "10" in Red Ink */}
      <text x="35" y="64" fill="#C43A48" fontSize="9" fontWeight="bold" fontFamily="serif">10</text>
      <line x1="20" y1="68" x2="42" y2="72" stroke="#D4AF37" strokeWidth="1" />
      <line x1="58" y1="72" x2="80" y2="66" stroke="#D4AF37" strokeWidth="1" />

      {/* Vintage Gold Fountain Pen */}
      <g transform="translate(25, 18) rotate(35)">
        <rect x="0" y="0" width="6" height="55" rx="3" fill="#1F4C3B" />
        <rect x="0" y="15" width="6" height="5" fill="#D4AF37" />
        <polygon points="3,-12 0,0 6,0" fill="#FFD54F" stroke="#BCA16D" strokeWidth="0.8" />
      </g>

      {/* Bouquet of Brilliant Yellow Sunflowers & Red Carnations */}
      <g transform="translate(75, 25)">
        {/* Sunflower */}
        <circle cx="15" cy="15" r="14" fill="#FFA000" />
        <circle cx="15" cy="15" r="7" fill="#5D4037" />
        {/* Red Rose */}
        <circle cx="2" cy="28" r="9" fill="#C43A48" />
        <circle cx="2" cy="28" r="5" fill="#8B1E2B" />
        {/* Leaves */}
        <path d="M-5 22 Q-12 10 0 15 Z" fill="#66BB6A" />
      </g>
    </g>
  </svg>
);

export const TeachersDayCornerDecor: React.FC<{ className?: string }> = ({ className = 'w-48 h-32' }) => (
  <svg viewBox="0 0 240 140" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Chalkboard Corner & Golden Sunflowers Garland */}
    <path d="M240 0 Q180 15 140 40 T70 65" stroke="#2F6B55" strokeWidth="3.5" strokeLinecap="round" fill="none" />

    {/* Sunflowers */}
    <g transform="translate(170, 25)">
      <circle cx="0" cy="0" r="13" fill="#FFA000" />
      <circle cx="0" cy="0" r="6" fill="#5D4037" />
    </g>
    <g transform="translate(115, 48)">
      <circle cx="0" cy="0" r="10" fill="#FFB300" />
      <circle cx="0" cy="0" r="4.5" fill="#5D4037" />
    </g>
    <circle cx="70" cy="65" r="6" fill="#C43A48" />
  </svg>
);

export const TeachersDaySidebarDecor: React.FC<{ className?: string }> = ({ className = 'w-full h-34' }) => (
  <svg viewBox="0 0 200 130" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <g transform="translate(45, 25)">
      {/* Inkpot, Diploma scroll with red seal */}
      <rect x="35" y="52" width="28" height="25" rx="4" fill="#263D5B" stroke="#78909C" strokeWidth="1.5" />
      <rect x="70" y="44" width="45" height="15" rx="3" fill="#FAF6EC" stroke="#D4AF37" strokeWidth="1" />
      <rect x="88" y="42" width="8" height="19" rx="1" fill="#C43A48" />
      <line x1="49" y1="50" x2="25" y2="18" stroke="#D4AF37" strokeWidth="3" strokeLinecap="round" />
    </g>
  </svg>
);


// =============================================================================
// 8. CHRISTMAS ARTWORK (VICTORIAN HEARTH & WINTER NOEL - RED/GREEN/GOLD)
// =============================================================================

export const ChristmasCalligraphyTitle: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`flex flex-col select-none relative ${className}`} role="heading" aria-level={1}>
    <div className="flex items-center gap-3">
      {/* Holly Wreath & Gold Bell Seal */}
      <div className="shrink-0 w-8 h-8 rounded-md bg-[#A62B38] border border-[#C9A658] shadow-xs flex items-center justify-center rotate-[-2deg]">
        <svg viewBox="0 0 32 32" className="w-5 h-5 text-[#FFFBF2]" fill="currentColor">
          <circle cx="16" cy="16" r="11" fill="none" stroke="#C9A658" strokeWidth="1.2" />
          <circle cx="14" cy="15" r="2.5" fill="#2E6B4E" />
          <circle cx="18" cy="15" r="2.5" fill="#2E6B4E" />
          <circle cx="16" cy="18" r="2" fill="#FFD54F" />
        </svg>
      </div>

      <div className="relative inline-block">
        <span
          style={{
            fontFamily: SERIF_HEADING_FONT,
            fontStyle: 'italic',
            letterSpacing: '-0.015em',
            textShadow: '0 2px 4px rgba(166, 43, 56, 0.2)',
          }}
          className="text-2xl sm:text-3xl md:text-4xl font-black text-[#A62B38] leading-tight"
        >
          Giáng Sinh An Lành!
        </span>
        <svg viewBox="0 0 240 12" fill="none" className="w-48 sm:w-64 h-2.5 mt-0.5 text-[#A62B38] opacity-80">
          <path d="M2 6 Q 60 1, 120 7 Q 180 11, 238 4 Q 190 8, 120 5 Q 50 3, 2 6 Z" fill="currentColor" />
        </svg>
      </div>
    </div>

    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs sm:text-sm md:text-base font-semibold text-[#701E27]">
      <span className="opacity-90">Mùa đông ấm áp</span>
      <span
        style={{ fontFamily: SERIF_HEADING_FONT, fontStyle: 'italic' }}
        className="font-black text-[#A62B38] relative px-1"
      >
        <span>Mùa đông ấm áp – Vạn sự an lành!</span>
        <span className="absolute bottom-0 left-0 w-full h-[2.5px] bg-gradient-to-r from-[#C9A658] via-[#2E6B4E] to-[#A62B38] rounded-full" />
      </span>
    </div>
  </div>
);

export const ChristmasHeroArtwork: React.FC<{ className?: string }> = ({ className = 'w-44 h-36' }) => (
  <svg viewBox="0 0 180 160" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Victorian Christmas Tree (Red, Forest Green, Gold) */}
    <g transform="translate(45, 15)">
      {/* Top Star */}
      <polygon points="45,0 48,8 56,9 50,15 52,23 45,18 38,23 40,15 34,9 42,8" fill="#FFD54F" />

      {/* Layer 1 (Top) */}
      <polygon points="45,15 62,35 28,35" fill="#2E6B4E" />
      <polygon points="45,15 58,35 32,35" fill="#3D8B66" />

      {/* Layer 2 (Middle) */}
      <polygon points="45,30 70,55 20,55" fill="#20523B" />
      <polygon points="45,30 65,55 25,55" fill="#2E6B4E" />

      {/* Layer 3 (Bottom) */}
      <polygon points="45,48 78,78 12,78" fill="#173F2D" />
      <polygon points="45,48 72,78 18,78" fill="#20523B" />

      {/* Trunk */}
      <rect x="39" y="78" width="12" height="14" fill="#5D4037" />

      {/* Red & Gold Baubles */}
      <circle cx="38" cy="28" r="3" fill="#A62B38" />
      <circle cx="52" cy="32" r="2.5" fill="#FFD54F" />
      <circle cx="32" cy="48" r="3.5" fill="#FFD54F" />
      <circle cx="58" cy="50" r="3" fill="#A62B38" />
      <circle cx="28" cy="68" r="3.5" fill="#A62B38" />
      <circle cx="62" cy="70" r="3.5" fill="#FFD54F" />

      {/* Festive Wrapped Presents */}
      <g transform="translate(62, 70)">
        <rect x="0" y="0" width="22" height="22" rx="2" fill="#A62B38" />
        <rect x="9" y="0" width="4" height="22" fill="#C9A658" />
        <rect x="0" y="9" width="22" height="4" fill="#C9A658" />
      </g>
      <g transform="translate(8, 75)">
        <rect x="0" y="0" width="18" height="17" rx="2" fill="#2E6B4E" />
        <rect x="7" y="0" width="4" height="17" fill="#FFFBF2" />
        <rect x="0" y="7" width="18" height="4" fill="#FFFBF2" />
      </g>
    </g>
  </svg>
);

export const ChristmasCornerDecor: React.FC<{ className?: string }> = ({ className = 'w-48 h-32' }) => (
  <svg viewBox="0 0 240 140" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Snow-dusted Pine Garland with Red Holly Berries */}
    <path d="M240 0 Q180 15 140 38 T70 60" stroke="#2E6B4E" strokeWidth="4.5" strokeLinecap="round" fill="none" />
    <path d="M150 35 Q130 18 110 25" stroke="#173F2D" strokeWidth="2.5" fill="none" />

    {/* Red Berries Clusters */}
    <circle cx="160" cy="30" r="4.5" fill="#A62B38" />
    <circle cx="166" cy="27" r="4" fill="#D32F2F" />
    <circle cx="164" cy="35" r="4" fill="#8B1E2B" />

    {/* Hanging Gold Bauble */}
    <g transform="translate(185, 25)">
      <line x1="0" y1="0" x2="0" y2="20" stroke="#C9A658" strokeWidth="1.2" />
      <circle cx="0" cy="30" r="10" fill="#A62B38" stroke="#C9A658" strokeWidth="1.5" />
      <circle cx="-3" cy="27" r="2.5" fill="#FFF" opacity="0.6" />
    </g>
  </svg>
);

export const ChristmasSidebarDecor: React.FC<{ className?: string }> = ({ className = 'w-full h-34' }) => (
  <svg viewBox="0 0 200 130" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <g transform="translate(35, 25)">
      {/* Pine Boughs, Cinnamon Sticks & Candle */}
      <path d="M15 65 Q55 45 95 60 Q120 70 145 65" stroke="#2E6B4E" strokeWidth="4" strokeLinecap="round" fill="none" />
      <circle cx="60" cy="46" r="4.5" fill="#A62B38" />
      <circle cx="67" cy="43" r="4" fill="#D32F2F" />

      {/* Glowing Candle */}
      <rect x="95" y="45" width="16" height="30" rx="3" fill="#FFFBF2" stroke="#E0D6C3" strokeWidth="1" />
      <polygon points="103,32 99,44 107,44" fill="#FFA000" />
      <circle cx="103" cy="40" r="2.5" fill="#FFD54F" />
    </g>
  </svg>
);


// =============================================================================
// 9. NEW YEAR ARTWORK (NEW HORIZONS & CHAMPAGNE GALA)
// =============================================================================

export const NewYearCalligraphyTitle: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`flex flex-col select-none relative ${className}`} role="heading" aria-level={1}>
    <div className="flex items-center gap-3">
      {/* Art Deco Midnight Stars 2026 Seal */}
      <div className="shrink-0 w-8 h-8 rounded-md bg-[#17233F] border border-[#D8B46A] shadow-xs flex items-center justify-center rotate-[-2deg]">
        <svg viewBox="0 0 32 32" className="w-5 h-5 text-[#D8B46A]" fill="currentColor">
          <circle cx="16" cy="16" r="11" fill="none" stroke="#D8B46A" strokeWidth="1.2" />
          <polygon points="16,8 18,13 23,14 19,18 20,23 16,20 12,23 13,18 9,14 14,13" />
        </svg>
      </div>

      <div className="relative inline-block">
        <span
          style={{
            fontFamily: SERIF_HEADING_FONT,
            fontStyle: 'italic',
            letterSpacing: '-0.015em',
            textShadow: '0 2px 4px rgba(23, 35, 63, 0.2)',
          }}
          className="text-2xl sm:text-3xl md:text-4xl font-black text-[#D8B46A] leading-tight"
        >
          Chào Đón Năm Mới!
        </span>
        <svg viewBox="0 0 240 12" fill="none" className="w-48 sm:w-64 h-2.5 mt-0.5 text-[#D8B46A] opacity-80">
          <path d="M2 6 Q 60 1, 120 7 Q 180 11, 238 4 Q 190 8, 120 5 Q 50 3, 2 6 Z" fill="currentColor" />
        </svg>
      </div>
    </div>

    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs sm:text-sm md:text-base font-semibold text-[#8C7443]">
      <span className="opacity-90">Khởi đầu rực rỡ</span>
      <span
        style={{ fontFamily: SERIF_HEADING_FONT, fontStyle: 'italic' }}
        className="font-black text-[#D8B46A] relative px-1"
      >
        <span>Khởi đầu rực rỡ – Vạn sự hanh thông!</span>
        <span className="absolute bottom-0 left-0 w-full h-[2.5px] bg-gradient-to-r from-[#D8B46A] via-[#E0E6ED] to-[#17233F] rounded-full" />
      </span>
    </div>
  </div>
);

export const NewYearHeroArtwork: React.FC<{ className?: string }> = ({ className = 'w-44 h-36' }) => (
  <svg viewBox="0 0 180 160" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Sparkling Midnight Clock & Fireworks */}
    <g transform="translate(35, 18)">
      {/* Fireworks Starburst */}
      <g transform="translate(100, 30)">
        <circle cx="0" cy="0" r="3" fill="#D8B46A" />
        <line x1="0" y1="-8" x2="0" y2="-18" stroke="#D8B46A" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="0" y1="8" x2="0" y2="18" stroke="#D8B46A" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="-8" y1="0" x2="-18" y2="0" stroke="#D8B46A" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="8" y1="0" x2="18" y2="0" stroke="#D8B46A" strokeWidth="1.5" strokeLinecap="round" />
      </g>

      {/* Midnight Clock Face */}
      <g transform="translate(45, 60)">
        <circle cx="0" cy="0" r="32" fill="#17233F" stroke="#D8B46A" strokeWidth="3" />
        <circle cx="0" cy="0" r="28" fill="#1F2E52" />
        {/* Hands pointing to 12:00 */}
        <line x1="0" y1="0" x2="0" y2="-18" stroke="#D8B46A" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="0" y1="0" x2="-2" y2="-14" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
        <circle cx="0" cy="0" r="3.5" fill="#D8B46A" />
      </g>

      {/* Champagne Flutes clinking */}
      <g transform="translate(100, 75)">
        <path d="M-8 0 L-4 16 L-4 28 M-10 28 L2 28" stroke="#D8B46A" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M12 0 L8 16 L8 28 M2 28 L14 28" stroke="#D8B46A" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    </g>
  </svg>
);

export const NewYearCornerDecor: React.FC<{ className?: string }> = ({ className = 'w-48 h-32' }) => (
  <svg viewBox="0 0 240 140" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Cascading Gold Streamers & Midnight Stars */}
    <path d="M240 0 Q180 15 140 40 T70 65" stroke="#D8B46A" strokeWidth="2.5" strokeDasharray="5 2" fill="none" />
    <polygon points="180,25 182,30 187,31 183,34 184,39 180,36 176,39 177,34 173,31 178,30" fill="#D8B46A" />
    <polygon points="130,45 131,48 134,49 132,51 132,54 130,52 128,54 128,51 126,49 129,48" fill="#D8B46A" />
  </svg>
);

export const NewYearSidebarDecor: React.FC<{ className?: string }> = ({ className = 'w-full h-34' }) => (
  <svg viewBox="0 0 200 130" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <g transform="translate(45, 25)">
      {/* Golden Clock & Champagne Flutes */}
      <circle cx="50" cy="45" r="22" fill="#17233F" stroke="#D8B46A" strokeWidth="2" />
      <line x1="50" y1="45" x2="50" y2="30" stroke="#FFD54F" strokeWidth="2" strokeLinecap="round" />
      <line x1="50" y1="45" x2="48" y2="34" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="50" cy="45" r="2.5" fill="#D8B46A" />
      <polygon points="90,20 92,26 98,28 93,31 94,37 90,34 86,37 87,31 82,28 88,26" fill="#D8B46A" />
    </g>
  </svg>
);


// =============================================================================
// 10. NON-INTRUSIVE SEASONAL PAGE DECORATION (FOR LEARNING PAGES)
// =============================================================================

export const SeasonalPageDecoration: React.FC<{ themeId: SeasonalThemeId }> = ({ themeId }) => {
  if (themeId === 'default') return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none">
      {themeId === 'tet' ? (
        <>
          {/* Authentic Vietnamese Tết Traditional Pattern & Still-Life Illustration Layer */}
          <div
            className="absolute inset-0 z-0 bg-cover bg-bottom bg-no-repeat transition-opacity duration-300 pointer-events-none"
            style={{
              backgroundImage: "url('/themes/tet-bg.jpg')",
              opacity: 0.38,
            }}
          />
          {/* Golden Apricot Blossom Branch & Traditional Red Lanterns Framing Top Right */}
          <div
            className="absolute top-0 right-0 w-[420px] md:w-[620px] h-52 md:h-72 pointer-events-none z-0 bg-contain bg-top bg-no-repeat opacity-45"
            style={{
              backgroundImage: "url('/themes/tet-banner-lanterns.png')",
            }}
          />
          {/* Ambient Warm Apricot & Vermilion Festival Aura */}
          <div
            className="absolute -top-24 -right-24 w-[420px] h-[420px] rounded-full blur-3xl opacity-40 pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(185,39,47,0.18) 0%, rgba(233,185,79,0.12) 60%, transparent 100%)',
            }}
          />
          {/* Bottom Left Subtle Glow */}
          <div
            className="absolute -bottom-24 -left-24 w-[360px] h-[360px] rounded-full blur-3xl opacity-35 pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(212,166,74,0.15) 0%, rgba(84,123,85,0.08) 60%, transparent 100%)',
            }}
          />
        </>
      ) : (
        <div
          className="absolute -top-24 -right-24 w-96 h-96 rounded-full blur-3xl opacity-25"
          style={{
            background:
              themeId === 'back_to_school'
                ? 'radial-gradient(circle, rgba(38,61,91,0.15) 0%, rgba(212,175,55,0.08) 70%, transparent 100%)'
                : themeId === 'mid_autumn'
                ? 'radial-gradient(circle, rgba(201,75,66,0.15) 0%, rgba(243,194,98,0.1) 70%, transparent 100%)'
                : themeId === 'halloween'
                ? 'radial-gradient(circle, rgba(223,122,40,0.15) 0%, rgba(112,81,127,0.1) 70%, transparent 100%)'
                : themeId === 'womens_day_8_3'
                ? 'radial-gradient(circle, rgba(201,94,115,0.15) 0%, rgba(230,201,148,0.08) 70%, transparent 100%)'
                : themeId === 'vietnamese_womens_day_20_10'
                ? 'radial-gradient(circle, rgba(158,41,53,0.15) 0%, rgba(196,151,70,0.08) 70%, transparent 100%)'
                : themeId === 'teachers_day_20_11'
                ? 'radial-gradient(circle, rgba(47,107,85,0.15) 0%, rgba(212,175,55,0.08) 70%, transparent 100%)'
                : themeId === 'christmas'
                ? 'radial-gradient(circle, rgba(166,43,56,0.15) 0%, rgba(46,107,78,0.1) 70%, transparent 100%)'
                : 'radial-gradient(circle, rgba(216,180,106,0.15) 0%, rgba(23,35,63,0.1) 70%, transparent 100%)',
          }}
        />
      )}
    </div>
  );
};


// =============================================================================
// 11. SHARED EMPTY STATE CLIPBOARD ILLUSTRATION (THEME-AWARE)
// =============================================================================

export const ThemeEmptyStateArtwork: React.FC<{
  themeId: SeasonalThemeId;
  className?: string;
}> = ({ themeId, className = 'w-24 h-24' }) => {
  const getAccentColor = () => {
    switch (themeId) {
      case 'tet':
        return '#B92735';
      case 'back_to_school':
        return '#263D5B';
      case 'mid_autumn':
        return '#C94B42';
      case 'halloween':
        return '#DF7A28';
      case 'womens_day_8_3':
        return '#C95E73';
      case 'vietnamese_womens_day_20_10':
        return '#9E2935';
      case 'teachers_day_20_11':
        return '#2F6B55';
      case 'christmas':
        return '#A62B38';
      case 'new_year':
        return '#D8B46A';
      default:
        return '#2563EB';
    }
  };

  const accent = getAccentColor();

  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <ellipse cx="50" cy="88" rx="35" ry="6" fill="#E2E8F0" opacity="0.6" />

      {themeId === 'tet' && (
        <g opacity="0.6">
          <circle cx="25" cy="55" r="4" fill="#FF80AB" />
          <circle cx="20" cy="65" r="3" fill="#FF4081" />
          <circle cx="75" cy="45" r="4" fill="#FFD54F" />
          <circle cx="80" cy="55" r="3" fill="#FF80AB" />
        </g>
      )}

      {/* Main Clipboard Body */}
      <rect x="25" y="20" width="50" height="65" rx="6" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="2" />
      <rect x="38" y="14" width="24" height="12" rx="3" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="1.5" />
      <circle cx="50" cy="18" r="2.5" fill="#94A3B8" />

      {/* Lines */}
      <line x1="34" y1="38" x2="66" y2="38" stroke="#E2E8F0" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="34" y1="48" x2="66" y2="48" stroke="#E2E8F0" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="34" y1="58" x2="56" y2="58" stroke="#E2E8F0" strokeWidth="2.5" strokeLinecap="round" />

      {/* Checkmark */}
      <path
        d="M42 62 L48 68 L62 50"
        stroke={accent}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};


// =============================================================================
// 12. STAT CARD VECTOR ILLUSTRATIONS (FOR DASHBOARD STAT CARDS)
// =============================================================================

export const StatCardBookIllustration: React.FC<{ className?: string }> = ({ className = 'w-16 h-14' }) => (
  <svg viewBox="0 0 80 60" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <ellipse cx="40" cy="52" rx="32" ry="5" fill="#E2E8F0" opacity="0.6" />
    <path d="M40 46 C30 43 18 44 8 48 L10 18 C20 15 32 15 40 19 Z" fill="#FFF9F2" stroke="#F0D8CC" strokeWidth="1.2" />
    <path d="M40 44 C31 41 20 42 10 46 L11 19 C20 16 32 16 40 20 Z" fill="#FFFFFF" />
    <path d="M40 46 C50 43 62 44 72 48 L70 18 C60 15 48 15 40 19 Z" fill="#FFF9F2" stroke="#F0D8CC" strokeWidth="1.2" />
    <path d="M40 44 C49 41 60 42 70 46 L69 19 C60 16 48 16 40 20 Z" fill="#FFFFFF" />
    <path d="M39 20 L41 20 L41 46 L39 46 Z" fill="#E6C8B8" />
    <line x1="16" y1="24" x2="34" y2="24" stroke="#F5DACB" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="16" y1="29" x2="32" y2="29" stroke="#F5DACB" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="16" y1="34" x2="28" y2="34" stroke="#F5DACB" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="46" y1="24" x2="64" y2="24" stroke="#F5DACB" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="48" y1="29" x2="64" y2="29" stroke="#F5DACB" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="52" y1="34" x2="64" y2="34" stroke="#F5DACB" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M40 19 L40 48 L44 44 L48 48 L48 20" fill="#B92735" opacity="0.9" />
  </svg>
);

export const StatCardStudentsIllustration: React.FC<{ className?: string }> = ({ className = 'w-16 h-14' }) => (
  <svg viewBox="0 0 90 60" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <ellipse cx="45" cy="54" rx="36" ry="5" fill="#E2E8F0" opacity="0.6" />
    {/* Boy on left */}
    <g>
      <rect x="18" y="28" width="18" height="22" rx="6" fill="#C93844" />
      <circle cx="27" cy="18" r="11" fill="#FFE0B2" />
      <path d="M16 18 C16 10 21 8 27 8 C33 8 38 10 38 18 C35 15 31 16 27 16 C23 16 19 15 16 18 Z" fill="#3E2723" />
      <circle cx="23" cy="19" r="1.3" fill="#3E2723" />
      <circle cx="31" cy="19" r="1.3" fill="#3E2723" />
      <path d="M25 23 Q27 25 29 23" stroke="#D84315" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="21" cy="22" r="1.8" fill="#FF8A80" opacity="0.6" />
      <circle cx="33" cy="22" r="1.8" fill="#FF8A80" opacity="0.6" />
      <rect x="20" y="34" width="14" height="11" rx="2" fill="#FFECB3" stroke="#FFA000" strokeWidth="1" />
      <line x1="27" y1="34" x2="27" y2="45" stroke="#FFA000" strokeWidth="1" />
    </g>
    {/* Girl on right */}
    <g>
      <rect x="52" y="28" width="18" height="22" rx="6" fill="#1E88E5" />
      <circle cx="61" cy="18" r="11" fill="#FFE0B2" />
      <circle cx="49" cy="12" r="4.5" fill="#3E2723" />
      <circle cx="73" cy="12" r="4.5" fill="#3E2723" />
      <path d="M50 18 C50 10 55 8 61 8 C67 8 72 10 72 18 C69 15 65 16 61 16 C57 16 53 15 50 18 Z" fill="#3E2723" />
      <circle cx="57" cy="19" r="1.3" fill="#3E2723" />
      <circle cx="65" cy="19" r="1.3" fill="#3E2723" />
      <path d="M59 23 Q61 25 63 23" stroke="#D84315" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="55" cy="22" r="1.8" fill="#FF8A80" opacity="0.6" />
      <circle cx="67" cy="22" r="1.8" fill="#FF8A80" opacity="0.6" />
      <rect x="54" y="34" width="14" height="11" rx="2" fill="#E1F5FE" stroke="#0288D1" strokeWidth="1" />
      <line x1="61" y1="34" x2="61" y2="45" stroke="#0288D1" strokeWidth="1" />
    </g>
  </svg>
);

export const StatCardCalendarIllustration: React.FC<{ className?: string }> = ({ className = 'w-16 h-14' }) => (
  <svg viewBox="0 0 80 60" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <ellipse cx="40" cy="52" rx="30" ry="5" fill="#E2E8F0" opacity="0.6" />
    <path d="M18 48 L28 16 L52 16 L62 48 Z" fill="#FFE8DC" stroke="#F5CBB6" strokeWidth="1.2" />
    <rect x="22" y="18" width="36" height="30" rx="3" fill="#FFFFFF" stroke="#F0D8CC" strokeWidth="1" />
    <rect x="22" y="18" width="36" height="8" rx="2" fill="#B92735" />
    <circle cx="28" cy="18" r="1.8" fill="#CBD5E1" stroke="#94A3B8" strokeWidth="0.8" />
    <circle cx="36" cy="18" r="1.8" fill="#CBD5E1" stroke="#94A3B8" strokeWidth="0.8" />
    <circle cx="44" cy="18" r="1.8" fill="#CBD5E1" stroke="#94A3B8" strokeWidth="0.8" />
    <circle cx="52" cy="18" r="1.8" fill="#CBD5E1" stroke="#94A3B8" strokeWidth="0.8" />
    <circle cx="28" cy="30" r="1.5" fill="#F0D8CC" />
    <circle cx="34" cy="30" r="1.5" fill="#F0D8CC" />
    <circle cx="40" cy="30" r="1.5" fill="#B92735" />
    <circle cx="46" cy="30" r="1.5" fill="#F0D8CC" />
    <circle cx="52" cy="30" r="1.5" fill="#F0D8CC" />
    <circle cx="28" cy="36" r="1.5" fill="#F0D8CC" />
    <circle cx="34" cy="36" r="1.5" fill="#F0D8CC" />
    <circle cx="40" cy="36" r="1.5" fill="#F0D8CC" />
    <circle cx="46" cy="36" r="1.5" fill="#B92735" />
    <circle cx="52" cy="36" r="1.5" fill="#F0D8CC" />
    <g transform="rotate(30 54 40)">
      <rect x="52" y="32" width="4" height="16" rx="1" fill="#FFC107" stroke="#FFA000" strokeWidth="0.6" />
      <polygon points="52,48 56,48 54,52" fill="#FFE082" stroke="#FFA000" strokeWidth="0.6" />
      <polygon points="53,50 55,50 54,52" fill="#212121" />
    </g>
  </svg>
);
