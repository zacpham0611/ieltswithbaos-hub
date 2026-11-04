import React, { useState } from 'react';
import {
  TetBaoLiXi,
  TetThoiVang,
  HoaMaiBlossom,
  HoaDaoBlossom,
  TetLantern,
} from '../theme/tetVectors';
import { Sparkles, PlusCircle, WalletCards, X, Gift } from 'lucide-react';

interface TetBlessingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tabId: string) => void;
}

export const TetBlessingModal: React.FC<TetBlessingModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  const [openedEnvelopeIndex, setOpenedEnvelopeIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const blessings = [
    {
      id: 0,
      title: 'Lộc Trí Tuệ & Bứt Phá Điểm Số',
      poem: 'Khai bút đầu xuân ngàn ý đẹp\nTrò giỏi thầy tâm rạng bảng vàng',
      detail: 'Chúc 100% học viên của thầy cô bứt phá band điểm IELTS mục tiêu và gặt hái thành công vang dội!',
      icon: '🎓',
      accent: '#B9272F',
    },
    {
      id: 1,
      title: 'Lộc Năng Lượng & Lớp Học Hạnh Phúc',
      poem: 'Mỗi giờ lên lớp tươi hoa nở\nNgọn lửa đam mê mãi sáng ngời',
      detail: 'Chúc thầy cô luôn dồi dào sức khỏe, nhiệt huyết và tìm thấy trọn vẹn niềm vui trong từng tiết giảng!',
      icon: '✨',
      accent: '#D4A64A',
    },
    {
      id: 2,
      title: 'Lộc Thịnh Vượng & Sự Nghiệp Rạng Rỡ',
      poem: 'Công đức trồng người lưu tiếng tốt\nTài lộc đơm bông phước ngập tràn',
      detail: 'Chúc sự nghiệp giảng dạy thăng hoa, uy tín học viện lan tỏa và vận hành tài chính hanh thông, viên mãn!',
      icon: '🧧',
      accent: '#547B55',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none animate-fadeIn"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-xl rounded-3xl overflow-hidden border-2 shadow-2xl transition-all"
        style={{
          background: 'linear-gradient(135deg, #FFFDF8 0%, #FFF5EB 50%, #FEECE1 100%)',
          borderColor: '#D4A64A',
          boxShadow: '0 25px 60px -15px rgba(130, 30, 40, 0.4), 0 0 0 1px rgba(212, 166, 74, 0.4)',
        }}
      >
        {/* Festive Header with Lacquer Red & Gold Lanterns */}
        <div
          className="relative px-6 py-5 text-white overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #821E28 0%, #B9272F 70%, #9B222E 100%)',
            borderBottom: '2px solid #D4A64A',
          }}
        >
          {/* Decorative Corner Lanterns */}
          <div className="absolute top-1 left-2 pointer-events-none opacity-80">
            <TetLantern className="w-7 h-12" />
          </div>
          <div className="absolute top-1 right-12 pointer-events-none opacity-80">
            <TetLantern className="w-7 h-12" />
          </div>

          <div className="text-center relative z-10 space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#FFFDF8]/20 border border-[#D4A64A] text-xs font-semibold text-[#FDE68A]">
              <HoaMaiBlossom size={16} />
              <span>Hái Lộc Đầu Năm · Tết Ất Tỵ 2026</span>
              <HoaDaoBlossom size={16} />
            </div>
            <h2
              className="text-2xl sm:text-3xl font-extrabold tracking-wide text-[#FFFDF8]"
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                letterSpacing: '0.02em',
                textShadow: '0 2px 8px rgba(0,0,0,0.3)',
              }}
            >
              Lộc Xuân Như Ý – Chúc Tết Thầy Cô
            </h2>
            <p className="text-xs text-[#FDE68A] italic">
              Chọn một bao lì xì để đón nhận lời chúc may mắn đầu năm
            </p>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Three Interactive Red Envelopes */}
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            {blessings.map((b) => {
              const isSelected = openedEnvelopeIndex === b.id;
              return (
                <button
                  key={b.id}
                  onClick={() => setOpenedEnvelopeIndex(b.id)}
                  className={`group relative flex flex-col items-center p-3 sm:p-4 rounded-2xl border transition-all cursor-pointer text-center ${
                    isSelected
                      ? 'ring-2 ring-[#B9272F] bg-white shadow-lg scale-102'
                      : 'bg-white/80 hover:bg-white hover:scale-102 border-[#D4A64A]/40 shadow-xs hover:shadow-md'
                  }`}
                  style={{
                    borderColor: isSelected ? '#B9272F' : 'rgba(212, 166, 74, 0.45)',
                  }}
                >
                  {/* Subtle Flower Accent */}
                  <div className="absolute top-1.5 right-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
                    {b.id % 2 === 0 ? <HoaMaiBlossom size={18} /> : <HoaDaoBlossom size={18} />}
                  </div>

                  <div className="my-1 transition-transform group-hover:scale-110 duration-200">
                    <TetBaoLiXi className="w-12 h-16 sm:w-14 sm:h-20 drop-shadow-md" />
                  </div>

                  <span className="text-xs font-bold text-[#821E28] mt-2 group-hover:text-[#B9272F]">
                    {b.id === 0 ? 'Bao Lộc 1' : b.id === 1 ? 'Bao Lộc 2' : 'Bao Lộc 3'}
                  </span>
                  <span className="text-[10px] text-[#7A5E52] mt-0.5">
                    {isSelected ? 'Đã mở lộc' : 'Chạm để mở'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Revealed Blessing Detail */}
          {openedEnvelopeIndex !== null ? (
            <div
              className="p-4 sm:p-5 rounded-2xl border animate-fadeIn relative overflow-hidden"
              style={{
                backgroundColor: 'rgba(255, 252, 248, 0.95)',
                borderColor: '#D4A64A',
                boxShadow: '0 4px 16px -2px rgba(185, 39, 47, 0.12)',
              }}
            >
              <div className="flex items-start gap-3.5">
                <div className="shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-[#B9272F] to-[#821E28] text-white flex items-center justify-center text-xl shadow-md border border-[#D4A64A]">
                  {blessings[openedEnvelopeIndex].icon}
                </div>
                <div className="space-y-1.5 flex-1 min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-[#821E28] flex items-center gap-2">
                    <span>{blessings[openedEnvelopeIndex].title}</span>
                    <TetThoiVang className="w-5 h-3.5 inline-block" />
                  </h3>
                  <div className="bg-[#FFF8E7] p-2.5 rounded-xl border border-[#E9B94F]/40 text-xs italic font-serif text-[#8A5B10] whitespace-pre-line leading-relaxed">
                    {blessings[openedEnvelopeIndex].poem}
                  </div>
                  <p className="text-xs text-[#4B3027] font-medium leading-relaxed pt-1">
                    {blessings[openedEnvelopeIndex].detail}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 text-center text-xs text-[#7A5E52] italic bg-[#FFF8E7]/50 rounded-xl border border-[#E9B94F]/30">
              Nhấn vào một trong ba bao lì xì may mắn để nhận thông điệp xuân đặc biệt dành riêng cho thầy cô!
            </div>
          )}

          {/* Quick Action Shortcuts for Teacher */}
          <div className="pt-2 border-t border-[#D4A64A]/30">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#821E28] mb-2 flex items-center gap-1.5">
              <Gift className="w-3.5 h-3.5 text-[#D4A64A]" />
              <span>Khởi đầu xuân mới cùng hệ thống giảng dạy</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                onClick={() => {
                  onClose();
                  onNavigate('ai_assistant');
                }}
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-[#821E28] text-white border border-[#D4A64A] hover:bg-[#B9272F] transition-all cursor-pointer shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#FDE68A]" />
                <span>Trợ lý Gemini AI</span>
              </button>
              <button
                onClick={() => {
                  onClose();
                  onNavigate('courses');
                }}
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-white text-[#821E28] border border-[#D4A64A] hover:bg-[#FFF8E7] transition-all cursor-pointer shadow-xs"
              >
                <PlusCircle className="w-3.5 h-3.5 text-[#B9272F]" />
                <span>Tạo khóa học mới</span>
              </button>
              <button
                onClick={() => {
                  onClose();
                  onNavigate('tuition');
                }}
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-white text-[#821E28] border border-[#D4A64A] hover:bg-[#FFF8E7] transition-all cursor-pointer shadow-xs"
              >
                <WalletCards className="w-3.5 h-3.5 text-[#547B55]" />
                <span>Đối soát học phí</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
