import React from 'react';
import type { SeasonalThemeId } from './types';

// =============================================================================
// 1. TẾT ARTWORK (MASTER BENCHMARK REFERENCE)
// =============================================================================

/**
 * Authentic Vietnamese Brush Calligraphy for Tết Hero Greeting
 * Matches the approved master design reference screenshot exactly.
 */
export const TetCalligraphyTitle: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`flex flex-col select-none ${className}`}>
    {/* Main headline: Chào mừng thầy cô trở lại! */}
    <div className="relative inline-block">
      <span
        style={{
          fontFamily: "'Playfair Display', 'Cormorant Garamond', serif",
          fontStyle: 'italic',
          letterSpacing: '-0.02em',
        }}
        className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#B92735] drop-shadow-xs leading-tight"
      >
        Chào mừng thầy cô trở lại!
      </span>
    </div>

    {/* Subtitle with calligraphy emphasis: Chúc một năm mới An Khang – Thịnh Vượng! */}
    <p className="mt-1 text-xs sm:text-sm md:text-base font-semibold text-[#8B3A3E] flex flex-wrap items-center gap-1.5">
      <span>Chúc một năm mới</span>
      <span
        style={{
          fontFamily: "'Playfair Display', serif",
          fontStyle: 'italic',
        }}
        className="font-black text-[#B92735] underline decoration-[#D6A64F] decoration-2 underline-offset-4"
      >
        An Khang – Thịnh Vượng!
      </span>
    </p>
  </div>
);

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
    {/* Rosy Cheeks */}
    <circle cx="69" cy="103" r="3.5" fill="#FF8A80" opacity="0.6" />
    <circle cx="91" cy="103" r="3.5" fill="#FF8A80" opacity="0.6" />
    {/* Child Happy Eyes */}
    <path d="M71 96 Q75 92 79 96" stroke="#4E342E" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    <path d="M81 96 Q85 92 89 96" stroke="#4E342E" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    {/* Smile */}
    <path d="M76 104 Q80 108 84 104" stroke="#D84315" strokeWidth="2" strokeLinecap="round" fill="none" />

    {/* Child Festive Clothes & Arms */}
    <path d="M65 115 C65 110 95 110 95 115 L102 142 L58 142 Z" fill="url(#tet_red_grad)" />
    <path d="M80 115 L80 142" stroke="url(#tet_gold_grad)" strokeWidth="2" strokeDasharray="3 2" />

    {/* Red Scroll "Vạn Sự Như Ý" held on the right */}
    <g transform="translate(108, 68)">
      {/* Scroll rods */}
      <rect x="0" y="0" width="28" height="5" rx="2.5" fill="url(#tet_gold_grad)" />
      <rect x="0" y="58" width="28" height="5" rx="2.5" fill="url(#tet_gold_grad)" />
      {/* Scroll Paper */}
      <rect x="3" y="4" width="22" height="55" rx="1.5" fill="#C62828" stroke="#FFE082" strokeWidth="1" />
      {/* Calligraphy marks (simulated four characters) */}
      <text x="14" y="17" fill="#FFF9C4" fontSize="7.5" fontWeight="900" textAnchor="middle" fontFamily="serif">VẠN</text>
      <text x="14" y="29" fill="#FFF9C4" fontSize="7.5" fontWeight="900" textAnchor="middle" fontFamily="serif">SỰ</text>
      <text x="14" y="41" fill="#FFF9C4" fontSize="7.5" fontWeight="900" textAnchor="middle" fontFamily="serif">NHƯ</text>
      <text x="14" y="53" fill="#FFF9C4" fontSize="7.5" fontWeight="900" textAnchor="middle" fontFamily="serif">Ý</text>
      {/* Hanging tassel */}
      <path d="M14 63 L14 74" stroke="#FFD54F" strokeWidth="1.5" />
      <circle cx="14" cy="74" r="2.5" fill="#E53935" />
    </g>
  </svg>
);

/**
 * Tết Hoa Đào & Hoa Mai Branch with Red Lanterns (Upper Right Accent)
 */
export const TetFloralBranchDecor: React.FC<{ className?: string }> = ({ className = 'w-48 h-32' }) => (
  <svg viewBox="0 0 240 140" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Dark wooden branch extending from top right */}
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
      {/* Golden fringe */}
      <line x1="0" y1="48" x2="0" y2="60" stroke="#FFD54F" strokeWidth="2" />
    </g>
  </svg>
);

/**
 * Tết Sidebar Bottom Decoration (Bánh Chưng, Câu đối Tết, Hoa đào)
 * Matches the lower left of the reference screenshot.
 */
export const TetSidebarBottomDecor: React.FC<{ className?: string }> = ({ className = 'w-full h-36' }) => (
  <svg viewBox="0 0 200 130" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <linearGradient id="banhchung_leaf" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#43A047" />
        <stop offset="100%" stopColor="#2E7D32" />
      </linearGradient>
    </defs>

    {/* Peach Blossom Branch arched behind */}
    <path d="M10 120 Q35 70 65 50 Q90 35 130 30" stroke="#6D4C41" strokeWidth="3" strokeLinecap="round" fill="none" />
    <circle cx="30" cy="85" r="6" fill="#FF80AB" />
    <circle cx="45" cy="65" r="5" fill="#FF4081" />
    <circle cx="75" cy="46" r="6" fill="#FF80AB" />
    <circle cx="105" cy="36" r="5" fill="#FF4081" />
    <circle cx="125" cy="28" r="4" fill="#FFD54F" />

    {/* Bánh Chưng (Green Square Sticky Rice Cake with Bamboo Ties) */}
    <g transform="translate(18, 70)">
      {/* Bottom perspective shadow */}
      <polygon points="10,40 55,55 90,40 45,25" fill="#1B5E20" opacity="0.3" />

      {/* Main Square Cake Body */}
      {/* Front Face */}
      <polygon points="10,32 55,48 55,20 10,6" fill="url(#banhchung_leaf)" />
      {/* Right Face */}
      <polygon points="55,48 95,32 95,6 55,20" fill="#2E7D32" />
      {/* Top Face */}
      <polygon points="10,6 55,20 95,6 50,-6" fill="#66BB6A" />

      {/* Yellow/Straw Bamboo String Ties (Lạt tre) */}
      {/* Horizontal ties */}
      <polygon points="8,19 55,34 95,19 95,21 55,36 8,21" fill="#FFF59D" />
      <polygon points="9,14 55,29 95,14 95,16 55,31 9,16" fill="#FFF59D" />
      {/* Vertical ties */}
      <polygon points="30,0 30,39 32,39 32,0" fill="#FFF59D" />
      <polygon points="72,0 72,39 74,39 74,0" fill="#FFF59D" />
    </g>

    {/* Red Diamond "Tết" Sign resting on cake */}
    <g transform="translate(95, 48)">
      {/* Red Diamond with Gold Trim */}
      <polygon points="32,0 64,32 32,64 0,32" fill="#D32F2F" stroke="#FFD54F" strokeWidth="2.5" />
      <polygon points="32,4 60,32 32,60 4,32" fill="none" stroke="#FFE082" strokeWidth="1" strokeDasharray="2 2" />
      {/* Gold Calligraphy word "Tết" */}
      <text
        x="32"
        y="39"
        fill="#FFF9C4"
        fontSize="19"
        fontWeight="bold"
        textAnchor="middle"
        fontFamily="'Playfair Display', serif"
        fontStyle="italic"
      >
        Tết
      </text>
    </g>
  </svg>
);

// =============================================================================
// 2. BACK TO SCHOOL ARTWORK (ACADEMIC RENAISSANCE)
// =============================================================================

export const BackToSchoolHeroArtwork: React.FC<{ className?: string }> = ({ className = 'w-40 h-36' }) => (
  <svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <linearGradient id="bts_sky" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#42A5F5" />
        <stop offset="100%" stopColor="#1E88E5" />
      </linearGradient>
      <linearGradient id="bts_gold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFD54F" />
        <stop offset="100%" stopColor="#FFA000" />
      </linearGradient>
    </defs>
    {/* Soft cloud backdrop */}
    <ellipse cx="80" cy="148" rx="60" ry="8" fill="#E3F2FD" />

    {/* Stack of Open Books & Graduation Cap */}
    <g transform="translate(30, 45)">
      {/* Book 1 (Navy Blue Hardcover) */}
      <polygon points="0,55 50,70 100,55 50,42" fill="#1565C0" />
      <polygon points="0,55 50,70 50,78 0,63" fill="#0D47A1" />
      <polygon points="50,70 100,55 100,63 50,78" fill="#1976D2" />
      {/* Pages */}
      <polygon points="2,54 50,68 98,54 50,44" fill="#FFFFFF" />

      {/* Book 2 (Golden Amber Cover angled) */}
      <g transform="translate(10, -18)">
        <polygon points="0,48 40,60 80,48 40,38" fill="url(#bts_gold)" />
        <polygon points="0,48 40,60 40,66 0,54" fill="#FF8F00" />
        <polygon points="40,60 80,48 80,54 40,66" fill="#FFA000" />
        <polygon points="2,47 40,58 78,47 40,40" fill="#FFFDE7" />
      </g>

      {/* Graduation Cap (Mortarboard) */}
      <g transform="translate(18, -48)">
        {/* Diamond top */}
        <polygon points="32,0 64,14 32,28 0,14" fill="#283593" />
        <polygon points="32,2 60,14 32,26 4,14" fill="#303F9F" />
        {/* Skull cap */}
        <path d="M16 19 C16 35 48 35 48 19 Z" fill="#1A237E" />
        {/* Golden tassel */}
        <path d="M32 14 C38 18 48 24 50 34" stroke="#FFD54F" strokeWidth="2" strokeLinecap="round" fill="none" />
        <circle cx="50" cy="34" r="2.5" fill="#FFA000" />
      </g>

      {/* Soaring Paper Plane */}
      <g transform="translate(75, -25) rotate(-15)">
        <polygon points="0,15 25,0 12,22" fill="#FFFFFF" filter="drop-shadow(0 2px 3px rgba(0,0,0,0.15))" />
        <polygon points="12,22 25,0 20,24" fill="#E0E0E0" />
        {/* Trail */}
        <path d="M-10 25 Q-3 20 5 18" stroke="#90CAF9" strokeWidth="1.5" strokeDasharray="3 2" fill="none" />
      </g>
    </g>
  </svg>
);

export const BackToSchoolSidebarDecor: React.FC<{ className?: string }> = ({ className = 'w-full h-32' }) => (
  <svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Globe, ruler and pencil stand */}
    <g transform="translate(25, 40)">
      {/* Stack of colorful study textbooks */}
      <rect x="10" y="50" width="80" height="14" rx="2" fill="#1976D2" />
      <rect x="12" y="52" width="76" height="3" fill="#BBDEFB" />
      <rect x="16" y="38" width="70" height="12" rx="2" fill="#FFA000" />
      <rect x="18" y="40" width="66" height="3" fill="#FFF9C4" />
      <rect x="22" y="27" width="60" height="11" rx="2" fill="#388E3C" />
      <rect x="24" y="29" width="56" height="3" fill="#C8E6C9" />

      {/* Wooden Ruler */}
      <polygon points="75,10 82,12 62,65 55,63" fill="#FFE082" stroke="#FFA000" strokeWidth="0.8" />

      {/* Yellow HB Pencil */}
      <polygon points="90,15 95,17 78,65 73,63" fill="#FFCA28" />
      <polygon points="90,15 95,17 93,8" fill="#FFCCBC" />
      <polygon points="93,8 92.5,6 93.5,6" fill="#37474F" />

      {/* Small Desk Globe */}
      <circle cx="130" cy="40" r="18" fill="#81D4FA" stroke="#0288D1" strokeWidth="1.5" />
      {/* Continents */}
      <path d="M120 38 Q125 30 132 35 T138 48 Q128 50 120 38 Z" fill="#A5D6A7" />
      <path d="M135 26 Q142 28 140 34 Z" fill="#A5D6A7" />
      {/* Stand */}
      <path d="M148 40 C148 53 135 58 130 58 L130 68 L122 68 L138 68" stroke="#78909C" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </g>
  </svg>
);

// =============================================================================
// 3. MID-AUTUMN ARTWORK (MOONLIT LANTERN GARDEN)
// =============================================================================

export const MidAutumnHeroArtwork: React.FC<{ className?: string }> = ({ className = 'w-44 h-36' }) => (
  <svg viewBox="0 0 180 160" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <radialGradient id="mid_moon" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#FFFDE7" />
        <stop offset="70%" stopColor="#FFF59D" />
        <stop offset="100%" stopColor="#FBC02D" />
      </radialGradient>
      <filter id="moon_glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="6" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>

    {/* Luminous Golden Full Moon */}
    <circle cx="85" cy="70" r="46" fill="url(#mid_moon)" filter="url(#moon_glow)" opacity="0.95" />
    {/* Subtle Moon craters */}
    <circle cx="70" cy="55" r="7" fill="#F9A825" opacity="0.15" />
    <circle cx="95" cy="78" r="9" fill="#F9A825" opacity="0.12" />
    <circle cx="78" cy="85" r="5" fill="#F9A825" opacity="0.14" />

    {/* Vietnamese Traditional 5-pointed Star Lantern (Đèn Ông Sao) */}
    <g transform="translate(115, 75)">
      {/* Bamboo handle */}
      <line x1="-15" y1="45" x2="35" y2="-15" stroke="#8D6E63" strokeWidth="2.5" strokeLinecap="round" />
      {/* Outer circular bamboo hoop */}
      <circle cx="0" cy="0" r="26" stroke="#D84315" strokeWidth="2" strokeDasharray="3 2" fill="none" />
      {/* 5-pointed red star */}
      <polygon
        points="0,-24 7,-7 24,-7 11,3 16,20 0,9 -16,20 -11,3 -24,-7 -7,-7"
        fill="#E53935"
        stroke="#FFEB3B"
        strokeWidth="1.5"
      />
      {/* Inner star accent */}
      <polygon
        points="0,-12 4,-3 12,-3 6,2 8,10 0,5 -8,10 -6,2 -12,-3 -4,-3"
        fill="#FFEB3B"
      />
      {/* Tassels */}
      <line x1="0" y1="20" x2="-3" y2="35" stroke="#FF5722" strokeWidth="1.5" />
      <line x1="0" y1="20" x2="3" y2="35" stroke="#FFCA28" strokeWidth="1.5" />
    </g>

    {/* Fluffy Autumn Moonlit Clouds */}
    <path
      d="M20 125 C30 115 50 115 60 122 C70 110 95 110 105 120 C115 112 135 112 145 125 Z"
      fill="#FFF8E1"
      opacity="0.85"
    />
  </svg>
);

export const MidAutumnSidebarDecor: React.FC<{ className?: string }> = ({ className = 'w-full h-32' }) => (
  <svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Mooncakes and Tea cup */}
    <g transform="translate(35, 30)">
      {/* Baked Mooncake (Bánh Nướng) */}
      <ellipse cx="45" cy="55" rx="30" ry="18" fill="#BF360C" />
      <ellipse cx="45" cy="48" rx="28" ry="16" fill="#D84315" />
      <ellipse cx="45" cy="44" rx="24" ry="13" fill="#E64A19" />
      {/* Traditional petal patterns on mooncake */}
      <circle cx="45" cy="44" r="7" stroke="#FFCC80" strokeWidth="1.5" fill="none" />
      <circle cx="45" cy="44" r="2" fill="#FFE082" />
      <path d="M45 33 L45 37 M45 51 L45 55 M34 44 L38 44 M52 44 L56 44" stroke="#FFCC80" strokeWidth="1.5" strokeLinecap="round" />

      {/* Snowskin Mooncake (Bánh Dẻo) */}
      <g transform="translate(60, 10)">
        <ellipse cx="40" cy="50" rx="24" ry="14" fill="#E0F2F1" opacity="0.9" />
        <ellipse cx="40" cy="45" rx="22" ry="12" fill="#FFFFFF" />
        <circle cx="40" cy="45" r="5" stroke="#80CBC4" strokeWidth="1.2" fill="none" />
      </g>

      {/* Teacup */}
      <ellipse cx="125" cy="65" rx="14" ry="7" fill="#8D6E63" />
      <ellipse cx="125" cy="63" rx="12" ry="5" fill="#FFE082" />
    </g>
  </svg>
);

// =============================================================================
// 4. HALLOWEEN ARTWORK (ENCHANTED AUTUMN NIGHT)
// =============================================================================

export const HalloweenHeroArtwork: React.FC<{ className?: string }> = ({ className = 'w-40 h-36' }) => (
  <svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <linearGradient id="hall_pumpkin" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFA726" />
        <stop offset="100%" stopColor="#F57C00" />
      </linearGradient>
    </defs>
    {/* Crescent Moon & Stars */}
    <path d="M120 20 C105 25 95 40 100 55 C85 45 88 25 105 18 C112 15 118 16 120 20 Z" fill="#FFE082" />
    <polygon points="75,25 77,30 82,31 78,34 79,39 75,36 71,39 72,34 68,31 73,30" fill="#FFE082" />
    <polygon points="135,50 136,53 139,54 137,56 137,59 135,57 133,59 133,56 131,54 134,53" fill="#FFE082" />

    {/* Friendly Jack-o'-lantern Pumpkin */}
    <g transform="translate(35, 65)">
      {/* Stem */}
      <path d="M42 5 C43 -4 48 -5 52 -3 C50 2 48 5 46 6 Z" fill="#558B2F" />

      {/* Pumpkin body lobes */}
      <ellipse cx="25" cy="35" rx="18" ry="24" fill="#EF6C00" />
      <ellipse cx="65" cy="35" rx="18" ry="24" fill="#EF6C00" />
      <ellipse cx="34" cy="35" rx="18" ry="27" fill="url(#hall_pumpkin)" />
      <ellipse cx="56" cy="35" rx="18" ry="27" fill="url(#hall_pumpkin)" />
      <ellipse cx="45" cy="35" rx="17" ry="28" fill="#FFA726" />

      {/* Happy Glowing Carved Eyes */}
      <polygon points="34,26 40,22 41,29" fill="#FFF9C4" />
      <polygon points="56,26 50,22 49,29" fill="#FFF9C4" />
      {/* Small nose */}
      <polygon points="45,32 42,37 48,37" fill="#FFF9C4" />
      {/* Smiling toothy mouth */}
      <path d="M30 42 Q45 56 60 42 Q52 49 45 45 Q38 49 30 42 Z" fill="#FFF9C4" />
    </g>

    {/* Friendly Floating Little Ghost */}
    <g transform="translate(90, 42)">
      <path
        d="M20 0 C10 0 0 10 0 25 C0 35 5 38 3 42 C1 46 8 43 11 44 C14 45 16 43 18 45 C20 47 24 43 28 42 C26 36 28 30 28 25 C28 10 30 0 20 0 Z"
        fill="#FFFFFF"
        opacity="0.95"
        filter="drop-shadow(0 2px 4px rgba(112, 81, 127, 0.25))"
      />
      {/* Friendly eyes & blush */}
      <circle cx="9" cy="18" r="2" fill="#4A148C" />
      <circle cx="17" cy="18" r="2" fill="#4A148C" />
      <ellipse cx="13" cy="24" rx="2" ry="3" fill="#4A148C" />
      <circle cx="6" cy="22" r="2" fill="#FF8A80" opacity="0.6" />
      <circle cx="20" cy="22" r="2" fill="#FF8A80" opacity="0.6" />
    </g>
  </svg>
);

export const HalloweenSidebarDecor: React.FC<{ className?: string }> = ({ className = 'w-full h-32' }) => (
  <svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <g transform="translate(40, 30)">
      {/* Two resting pumpkins with autumn oak leaves */}
      <ellipse cx="40" cy="55" rx="25" ry="18" fill="#F57C00" />
      <ellipse cx="40" cy="53" rx="20" ry="17" fill="#FFA726" />
      <path d="M40 37 Q42 30 45 32" stroke="#558B2F" strokeWidth="3" fill="none" />

      {/* Mini pumpkin on side */}
      <ellipse cx="75" cy="62" rx="18" ry="13" fill="#E65100" />
      <ellipse cx="75" cy="60" rx="14" ry="12" fill="#FFB74D" />

      {/* Magical Wand & Stars */}
      <line x1="85" y1="20" x2="115" y2="60" stroke="#7E57C2" strokeWidth="2.5" strokeLinecap="round" />
      <polygon points="85,20 83,16 88,18 90,14 91,19 96,19 92,22 93,27 89,24 86,26" fill="#FFD54F" />
    </g>
  </svg>
);

// =============================================================================
// 5. WOMEN'S DAY 8/3 ARTWORK (BLOOMING GRACE)
// =============================================================================

export const WomensDay83HeroArtwork: React.FC<{ className?: string }> = ({ className = 'w-44 h-36' }) => (
  <svg viewBox="0 0 180 160" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Elegant Rose Bouquet & Champagne Ribbon */}
    <g transform="translate(45, 25)">
      {/* Big Central Blooming Rose */}
      <circle cx="50" cy="55" r="28" fill="#F8BBD0" opacity="0.5" />
      <circle cx="50" cy="55" r="22" fill="#F06292" />
      <circle cx="50" cy="55" r="16" fill="#E91E63" />
      <circle cx="50" cy="55" r="10" fill="#C2185B" />
      {/* Rose swirl petals */}
      <path d="M45 50 Q50 42 58 48 Q64 56 54 62 Q42 62 42 54" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round" fill="none" />

      {/* Secondary Peonies */}
      <circle cx="22" cy="70" r="16" fill="#F48FB1" />
      <circle cx="22" cy="70" r="10" fill="#EC407A" />
      <circle cx="78" cy="70" r="16" fill="#FF80AB" />
      <circle cx="78" cy="70" r="10" fill="#F50057" />

      {/* Delicate botanical leaves */}
      <path d="M10 65 Q-5 50 15 45 Q22 55 10 65 Z" fill="#81C784" />
      <path d="M85 65 Q105 50 85 45 Q78 55 85 65 Z" fill="#81C784" />
      <path d="M50 24 Q55 5 45 10 Q42 20 50 24 Z" fill="#A5D6A7" />

      {/* Elegant Ribbon Stems */}
      <path d="M42 85 C35 110 20 125 15 130" stroke="#CDAA78" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M58 85 C65 110 80 125 85 130" stroke="#CDAA78" strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* Bow */}
      <ellipse cx="44" cy="88" rx="7" ry="4" fill="#D4AF37" />
      <ellipse cx="56" cy="88" rx="7" ry="4" fill="#D4AF37" />
      <circle cx="50" cy="88" r="3" fill="#B8860B" />
    </g>
  </svg>
);

export const WomensDay83SidebarDecor: React.FC<{ className?: string }> = ({ className = 'w-full h-32' }) => (
  <svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <g transform="translate(45, 30)">
      {/* Tiered floral gift box */}
      <rect x="25" y="45" width="60" height="30" rx="3" fill="#FFF0F2" stroke="#F48FB1" strokeWidth="1.5" />
      <path d="M25 58 L85 58" stroke="#CDAA78" strokeWidth="2" />
      <path d="M55 45 L55 75" stroke="#CDAA78" strokeWidth="2" />

      {/* Roses in box */}
      <circle cx="42" cy="40" r="12" fill="#E91E63" />
      <circle cx="42" cy="40" r="7" fill="#C2185B" />
      <circle cx="65" cy="38" r="11" fill="#F06292" />
      <circle cx="65" cy="38" r="6" fill="#D81B60" />
      <circle cx="54" cy="28" r="9" fill="#FF80AB" />
      {/* Leaves */}
      <path d="M28 35 Q20 25 32 26 Z" fill="#81C784" />
      <path d="M78 35 Q86 25 74 26 Z" fill="#81C784" />
    </g>
  </svg>
);

// =============================================================================
// 6. VIETNAMESE WOMEN'S DAY 20/10 ARTWORK (VIETNAMESE FLORAL ELEGANCE)
// =============================================================================

export const WomensDay2010HeroArtwork: React.FC<{ className?: string }> = ({ className = 'w-44 h-36' }) => (
  <svg viewBox="0 0 180 160" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Pink Vietnamese Lotus Blossom in Full Bloom */}
    <g transform="translate(40, 30)">
      {/* Outer Lotus Petals */}
      <path d="M50 85 C15 70 10 40 45 35 C40 55 45 75 50 85 Z" fill="#F48FB1" opacity="0.85" />
      <path d="M50 85 C85 70 90 40 55 35 C60 55 55 75 50 85 Z" fill="#F48FB1" opacity="0.85" />

      {/* Mid Petals */}
      <path d="M50 85 C28 65 28 30 50 15 C55 35 52 70 50 85 Z" fill="#EC407A" />
      <path d="M50 85 C72 65 72 30 50 15 C45 35 48 70 50 85 Z" fill="#D81B60" />

      {/* Center Lotus Bud Petal */}
      <path d="M50 85 C42 60 42 22 50 10 C58 22 58 60 50 85 Z" fill="#C2185B" />
      {/* Golden Lotus Center / Stamen */}
      <ellipse cx="50" cy="55" rx="5" ry="3" fill="#FFD54F" />

      {/* Lotus Pod / Green Base */}
      <ellipse cx="50" cy="88" rx="16" ry="6" fill="#66BB6A" />
      {/* Stem */}
      <path d="M50 94 Q48 115 52 135" stroke="#388E3C" strokeWidth="3" strokeLinecap="round" fill="none" />

      {/* Delicate Lotus Leaf */}
      <ellipse cx="20" cy="115" rx="18" ry="7" fill="#81C784" />
      <ellipse cx="80" cy="118" rx="18" ry="7" fill="#81C784" />
    </g>
  </svg>
);

export const WomensDay2010SidebarDecor: React.FC<{ className?: string }> = ({ className = 'w-full h-32' }) => (
  <svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Ceramic vase with lotus and silk ribbon */}
    <g transform="translate(60, 25)">
      {/* Vase */}
      <path d="M25 45 C15 55 12 75 25 85 C32 85 48 85 55 85 C68 75 65 55 55 45 Z" fill="#FFF9C4" stroke="#C9A66B" strokeWidth="1.5" />
      {/* Lotus flower */}
      <circle cx="40" cy="30" r="14" fill="#F06292" />
      <circle cx="40" cy="30" r="9" fill="#C2185B" />
      <circle cx="40" cy="30" r="3" fill="#FFD54F" />
      {/* Buds & Leaves */}
      <ellipse cx="20" cy="38" rx="6" ry="10" fill="#E91E63" />
      <path d="M55 35 Q65 25 60 40 Z" fill="#66BB6A" />
    </g>
  </svg>
);

// =============================================================================
// 7. TEACHERS' DAY 20/11 ARTWORK (THE ART OF APPRECIATION)
// =============================================================================

export const TeachersDayHeroArtwork: React.FC<{ className?: string }> = ({ className = 'w-44 h-36' }) => (
  <svg viewBox="0 0 180 160" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <g transform="translate(35, 30)">
      {/* Open Leather-bound Book with gold leaf edge */}
      <polygon points="5,60 50,75 95,60 50,48" fill="#557866" />
      <polygon points="5,60 50,75 50,83 5,68" fill="#3B5347" />
      <polygon points="50,75 95,60 95,68 50,83" fill="#476556" />
      {/* Parchment Pages */}
      <polygon points="8,59 50,73 92,59 50,50" fill="#FFFBEA" />
      {/* Page lines */}
      <line x1="20" y1="60" x2="42" y2="67" stroke="#BCA16D" strokeWidth="1" />
      <line x1="20" y1="64" x2="38" y2="70" stroke="#BCA16D" strokeWidth="1" />
      <line x1="58" y1="67" x2="80" y2="60" stroke="#BCA16D" strokeWidth="1" />
      <line x1="62" y1="71" x2="80" y2="65" stroke="#BCA16D" strokeWidth="1" />

      {/* Elegant Vintage Fountain Pen resting on book */}
      <g transform="translate(25, 20) rotate(35)">
        <rect x="0" y="0" width="6" height="55" rx="3" fill="#2E3B32" />
        <rect x="0" y="15" width="6" height="5" fill="#D4AF37" />
        {/* Golden Nib */}
        <polygon points="3,-12 0,0 6,0" fill="#FFD54F" stroke="#BCA16D" strokeWidth="0.8" />
        <line x1="3" y1="-10" x2="3" y2="-2" stroke="#3E2723" strokeWidth="0.8" />
      </g>

      {/* Graduation Red Ribbon / Bookmark */}
      <path d="M50 50 C50 65 52 85 45 95 L50 92 L55 95 C53 85 50 65 50 50 Z" fill="#C62828" />

      {/* Bouquet of Gratitude Flowers */}
      <circle cx="85" cy="40" r="9" fill="#FF8A80" />
      <circle cx="85" cy="40" r="4" fill="#D32F2F" />
      <circle cx="98" cy="46" r="8" fill="#FFD54F" />
      <path d="M80 48 Q75 35 88 38 Z" fill="#81C784" />
    </g>
  </svg>
);

export const TeachersDaySidebarDecor: React.FC<{ className?: string }> = ({ className = 'w-full h-32' }) => (
  <svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <g transform="translate(45, 30)">
      {/* Inkpot & Feather / Pen */}
      <rect x="35" y="48" width="28" height="25" rx="4" fill="#37474F" stroke="#78909C" strokeWidth="1.5" />
      <rect x="42" y="44" width="14" height="4" rx="1" fill="#CFD8DC" />
      {/* Rolled Diploma scroll with red ribbon */}
      <rect x="70" y="40" width="45" height="15" rx="3" fill="#FFF9C4" stroke="#FFE082" strokeWidth="1" />
      <rect x="88" y="38" width="8" height="19" rx="1" fill="#C62828" />
      {/* Fountain pen leaning in inkpot */}
      <line x1="49" y1="46" x2="25" y2="15" stroke="#BCA16D" strokeWidth="3" strokeLinecap="round" />
      <polygon points="25,15 22,12 28,14" fill="#D4AF37" />
    </g>
  </svg>
);

// =============================================================================
// 8. CHRISTMAS ARTWORK (A COZY WINTER CELEBRATION)
// =============================================================================

export const ChristmasHeroArtwork: React.FC<{ className?: string }> = ({ className = 'w-44 h-36' }) => (
  <svg viewBox="0 0 180 160" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Decorated Christmas Tree & Wrapped Gift Boxes */}
    <g transform="translate(45, 18)">
      {/* Tree Top Star */}
      <polygon points="45,0 48,8 56,9 50,15 52,23 45,18 38,23 40,15 34,9 42,8" fill="#FFD54F" />

      {/* Layer 1 (Top) */}
      <polygon points="45,15 62,35 28,35" fill="#2E7D32" />
      <polygon points="45,15 58,35 32,35" fill="#388E3C" />

      {/* Layer 2 (Middle) */}
      <polygon points="45,30 70,55 20,55" fill="#1B5E20" />
      <polygon points="45,30 65,55 25,55" fill="#2E7D32" />

      {/* Layer 3 (Bottom) */}
      <polygon points="45,48 78,78 12,78" fill="#1B5E20" />
      <polygon points="45,48 72,78 18,78" fill="#2E7D32" />

      {/* Tree Trunk */}
      <rect x="39" y="78" width="12" height="14" fill="#5D4037" />

      {/* Tree Ornaments & Baubles */}
      <circle cx="38" cy="28" r="3" fill="#E53935" />
      <circle cx="52" cy="32" r="2.5" fill="#FFD54F" />
      <circle cx="32" cy="48" r="3" fill="#FFD54F" />
      <circle cx="58" cy="50" r="3" fill="#E53935" />
      <circle cx="45" cy="42" r="2.5" fill="#42A5F5" />
      <circle cx="28" cy="68" r="3.5" fill="#E53935" />
      <circle cx="62" cy="70" r="3.5" fill="#FFD54F" />
      <circle cx="45" cy="64" r="3" fill="#AB47BC" />

      {/* Wrapped Gift Boxes under tree */}
      <g transform="translate(62, 70)">
        <rect x="0" y="0" width="22" height="22" rx="2" fill="#C62828" />
        <rect x="9" y="0" width="4" height="22" fill="#FFD54F" />
        <rect x="0" y="9" width="22" height="4" fill="#FFD54F" />
      </g>
      <g transform="translate(6, 75)">
        <rect x="0" y="0" width="18" height="17" rx="2" fill="#1976D2" />
        <rect x="7" y="0" width="4" height="17" fill="#FFFFFF" />
        <rect x="0" y="7" width="18" height="4" fill="#FFFFFF" />
      </g>
    </g>
  </svg>
);

export const ChristmasSidebarDecor: React.FC<{ className?: string }> = ({ className = 'w-full h-32' }) => (
  <svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <g transform="translate(35, 30)">
      {/* Evergreen pine branch with holly berries and pinecone */}
      <path d="M15 65 Q55 45 95 60 Q120 70 145 65" stroke="#2E7D32" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M35 55 Q50 35 65 48" stroke="#1B5E20" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M75 58 Q90 38 105 52" stroke="#1B5E20" strokeWidth="2.5" strokeLinecap="round" fill="none" />

      {/* Red Holly Berries */}
      <circle cx="60" cy="46" r="4.5" fill="#D32F2F" />
      <circle cx="67" cy="43" r="4" fill="#E53935" />
      <circle cx="65" cy="50" r="4" fill="#C62828" />

      {/* Hanging Glass Bauble with gold cap */}
      <line x1="110" y1="58" x2="110" y2="72" stroke="#FFD54F" strokeWidth="1" />
      <rect x="108" y="71" width="4" height="2" fill="#FFD54F" />
      <circle cx="110" cy="80" r="8" fill="#C62828" />
      <circle cx="108" cy="78" r="2" fill="#FFFFFF" opacity="0.8" />
    </g>
  </svg>
);

// =============================================================================
// 9. NEW YEAR ARTWORK (NEW HORIZONS)
// =============================================================================

export const NewYearHeroArtwork: React.FC<{ className?: string }> = ({ className = 'w-44 h-36' }) => (
  <svg viewBox="0 0 180 160" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Sparkling Midnight Clock Tower & Elegant Fireworks */}
    <g transform="translate(35, 20)">
      {/* Fireworks Burst */}
      <g transform="translate(100, 30)">
        <circle cx="0" cy="0" r="3" fill="#FFD54F" />
        <line x1="0" y1="-8" x2="0" y2="-18" stroke="#FFD54F" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="0" y1="8" x2="0" y2="18" stroke="#FFD54F" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="-8" y1="0" x2="-18" y2="0" stroke="#FFD54F" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="8" y1="0" x2="18" y2="0" stroke="#FFD54F" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="-6" y1="-6" x2="-14" y2="-14" stroke="#90CAF9" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="6" y1="-6" x2="14" y2="-14" stroke="#90CAF9" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="-6" y1="6" x2="-14" y2="14" stroke="#90CAF9" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="6" y1="6" x2="14" y2="14" stroke="#90CAF9" strokeWidth="1.5" strokeLinecap="round" />
      </g>

      {/* Midnight Countdown Clock Face */}
      <g transform="translate(45, 60)">
        <circle cx="0" cy="0" r="32" fill="#1A237E" stroke="#CBAA65" strokeWidth="3" />
        <circle cx="0" cy="0" r="28" fill="#283593" />
        {/* Roman numerals / markers */}
        <line x1="0" y1="-24" x2="0" y2="-21" stroke="#FFD54F" strokeWidth="2" />
        <line x1="24" y1="0" x2="21" y2="0" stroke="#FFD54F" strokeWidth="2" />
        <line x1="0" y1="24" x2="0" y2="21" stroke="#FFD54F" strokeWidth="2" />
        <line x1="-24" y1="0" x2="-21" y2="0" stroke="#FFD54F" strokeWidth="2" />

        {/* Clock Hands pointing to 12:00 */}
        <line x1="0" y1="0" x2="0" y2="-18" stroke="#FFD54F" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="0" y1="0" x2="-2" y2="-14" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
        <circle cx="0" cy="0" r="3.5" fill="#CBAA65" />
      </g>

      {/* Gold Celebration Streamers */}
      <path d="M10 90 Q30 75 50 95 T90 85" stroke="#CBAA65" strokeWidth="2" strokeDasharray="4 2" fill="none" />
      <path d="M20 100 Q45 85 70 105 T110 95" stroke="#90CAF9" strokeWidth="1.5" fill="none" />
    </g>
  </svg>
);

export const NewYearSidebarDecor: React.FC<{ className?: string }> = ({ className = 'w-full h-32' }) => (
  <svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <g transform="translate(45, 30)">
      {/* Golden Clock and celebration stars */}
      <circle cx="50" cy="45" r="22" fill="#0D1B2A" stroke="#CBAA65" strokeWidth="2" />
      <line x1="50" y1="45" x2="50" y2="30" stroke="#FFD54F" strokeWidth="2" strokeLinecap="round" />
      <line x1="50" y1="45" x2="48" y2="34" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="50" cy="45" r="2.5" fill="#FFD54F" />

      {/* Bursting Stars */}
      <polygon points="90,20 92,26 98,28 93,31 94,37 90,34 86,37 87,31 82,28 88,26" fill="#CBAA65" />
      <polygon points="20,25 21,29 25,30 22,32 23,36 20,34 17,36 18,32 15,30 19,29" fill="#90CAF9" />
    </g>
  </svg>
);

// =============================================================================
// 10. SHARED EMPTY STATE CLIPBOARD ILLUSTRATION (THEME-AWARE)
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
        return '#3976C6';
      case 'mid_autumn':
        return '#C77A35';
      case 'halloween':
        return '#70517F';
      case 'womens_day_8_3':
        return '#C95E73';
      case 'vietnamese_womens_day_20_10':
        return '#B95F66';
      case 'teachers_day_20_11':
        return '#557866';
      case 'christmas':
        return '#47745D';
      case 'new_year':
        return '#526A91';
      default:
        return '#3B82F6';
    }
  };

  const accent = getAccentColor();

  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Soft shadow */}
      <ellipse cx="50" cy="88" rx="35" ry="6" fill="#E2E8F0" opacity="0.6" />

      {/* Background themed floral/sparkle accents */}
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
      {/* Top Clip */}
      <rect x="38" y="14" width="24" height="12" rx="3" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="1.5" />
      <circle cx="50" cy="18" r="2.5" fill="#94A3B8" />

      {/* Task Checklist Lines */}
      <line x1="34" y1="38" x2="66" y2="38" stroke="#E2E8F0" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="34" y1="48" x2="66" y2="48" stroke="#E2E8F0" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="34" y1="58" x2="56" y2="58" stroke="#E2E8F0" strokeWidth="2.5" strokeLinecap="round" />

      {/* Prominent Checkmark */}
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
// 11. STAT CARD VECTOR ILLUSTRATIONS (FOR DASHBOARD STAT CARDS)
// =============================================================================

export const StatCardBookIllustration: React.FC<{ className?: string }> = ({ className = 'w-16 h-14' }) => (
  <svg viewBox="0 0 80 60" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <ellipse cx="40" cy="52" rx="32" ry="5" fill="#E2E8F0" opacity="0.6" />
    {/* Left pages */}
    <path d="M40 46 C30 43 18 44 8 48 L10 18 C20 15 32 15 40 19 Z" fill="#FFF9F2" stroke="#F0D8CC" strokeWidth="1.2" />
    <path d="M40 44 C31 41 20 42 10 46 L11 19 C20 16 32 16 40 20 Z" fill="#FFFFFF" />
    {/* Right pages */}
    <path d="M40 46 C50 43 62 44 72 48 L70 18 C60 15 48 15 40 19 Z" fill="#FFF9F2" stroke="#F0D8CC" strokeWidth="1.2" />
    <path d="M40 44 C49 41 60 42 70 46 L69 19 C60 16 48 16 40 20 Z" fill="#FFFFFF" />
    {/* Spine */}
    <path d="M39 20 L41 20 L41 46 L39 46 Z" fill="#E6C8B8" />
    {/* Page lines */}
    <line x1="16" y1="24" x2="34" y2="24" stroke="#F5DACB" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="16" y1="29" x2="32" y2="29" stroke="#F5DACB" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="16" y1="34" x2="28" y2="34" stroke="#F5DACB" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="46" y1="24" x2="64" y2="24" stroke="#F5DACB" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="48" y1="29" x2="64" y2="29" stroke="#F5DACB" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="52" y1="34" x2="64" y2="34" stroke="#F5DACB" strokeWidth="1.2" strokeLinecap="round" />
    {/* Ribbon bookmark */}
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
      <polygon points="52,48 56,48 54,52" fill="#FFE0B2" stroke="#FFA000" strokeWidth="0.6" />
      <polygon points="53,50 55,50 54,52" fill="#212121" />
    </g>
  </svg>
);
