import React, { useState } from 'react';
import {
  Sparkles,
  Calendar,
  Bookmark,
  Copy,
  Check,
  ThumbsUp,
  MessageSquare,
  Share2,
  Layers,
  Wand2,
  RefreshCw,
  Image as ImageIcon,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import type { PostVariant } from '../../server/services/aiAgent';

interface ContentGeneratorViewProps {
  onScheduleCreated?: () => void;
  onNavigateToCalendar?: () => void;
}

export const ContentGeneratorView: React.FC<ContentGeneratorViewProps> = ({
  onScheduleCreated,
  onNavigateToCalendar,
}) => {
  const { activePage, toast } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'single' | 'weekly' | 'library'>('single');

  // Single Generator Form State
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('Chuyên nghiệp, lôi cuốn');
  const [length, setLength] = useState('Vừa phải (150-250 từ)');
  const [hashtags, setHashtags] = useState('#KhungAnh #DecorGiaDinh #MingoStore #NoiThatDep');
  const [cta, setCta] = useState('Nhắn tin ngay cho Fanpage để nhận ưu đãi Freeship toàn quốc!');
  const [generating, setGenerating] = useState(false);

  // Generated Variants
  const [variants, setVariants] = useState<PostVariant[]>([]);
  const [imagePrompt, setImagePrompt] = useState<string>('');
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Schedule Modal from Generated Post
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 2);
    d.setMinutes(0);
    return d.toISOString().slice(0, 16);
  });
  const [postImageUrl, setPostImageUrl] = useState('https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=800&auto=format&fit=crop&q=80');
  const [savingPost, setSavingPost] = useState(false);

  // Weekly Generator State
  const [weeklyPillar, setWeeklyPillar] = useState('Decor Không Gian Sống Ấm Cúng & Lưu Giữ Kỷ Niệm Gia Đình');
  const [weeklyTone, setWeeklyTone] = useState('Truyền cảm hứng & Bán hàng tự nhiên');
  const [generatingWeekly, setGeneratingWeekly] = useState(false);
  const [weeklyResults, setWeeklyResults] = useState<any[]>([]);

  // Library State
  const [libraryItems, setLibraryItems] = useState<any[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!topic.trim() || generating) return;

    setGenerating(true);
    try {
      const res = await api.generatePost({
        topic: topic.trim(),
        tone,
        length,
        hashtags,
        cta,
        page_id: activePage?.id,
      });

      if (res.success && res.variants?.length) {
        setVariants(res.variants);
        setImagePrompt(res.imagePrompt || '');
        setSelectedVariantIndex(0);
        toast(`Đã tạo thành công ${res.variants.length} phiên bản bài viết!`, 'success');
      }
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    toast('Đã sao chép bài viết vào clipboard', 'info');
    setTimeout(() => setCopiedIndex(null), 2500);
  };

  const handleSaveToLibrary = async (content: string) => {
    try {
      await api.saveToLibrary({
        content,
        topic: topic || 'Chủ đề tùy biến',
        tone,
      });
      toast('Đã lưu bài viết vào Thư viện nội dung!', 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const handleConfirmSchedule = async (publishNow = false) => {
    const selectedVariant = variants[selectedVariantIndex];
    if (!selectedVariant || !activePage) return;

    setSavingPost(true);
    try {
      const res = await api.createPost({
        page_id: activePage.id,
        content: selectedVariant.fullPost,
        image_url: postImageUrl || undefined,
        scheduled_at: scheduleDate,
        publish_now: publishNow,
      });

      if (res.success) {
        if (res.hasConflict) {
          toast(res.conflictWarning || 'Lưu ý: Đã có bài đăng gần khung giờ này', 'info');
        }
        toast(
          publishNow ? 'Đã xuất bản bài viết lên Facebook thành công!' : 'Đã lên lịch đăng bài thành công!',
          'success'
        );
        setShowScheduleModal(false);
        if (onScheduleCreated) onScheduleCreated();
      }
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSavingPost(false);
    }
  };

  const handleGenerateWeekly = async () => {
    if (!weeklyPillar.trim() || generatingWeekly) return;
    setGeneratingWeekly(true);
    try {
      const res = await api.generateWeekly({
        pillar: weeklyPillar.trim(),
        page_id: activePage?.id,
        tone: weeklyTone,
      });

      if (res.success && res.weeklyPosts) {
        setWeeklyResults(res.weeklyPosts);
        toast('Đã tạo thành công chiến dịch 7 bài cho cả tuần!', 'success');
      }
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setGeneratingWeekly(false);
    }
  };

  const loadLibrary = async () => {
    setLoadingLibrary(true);
    try {
      const res = await api.getContentLibrary();
      if (res.success) {
        setLibraryItems(res.items || []);
      }
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setLoadingLibrary(false);
    }
  };

  const currentVariant = variants[selectedVariantIndex];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Sub Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs font-medium">
          <button
            onClick={() => setActiveSubTab('single')}
            className={`px-3 py-1.5 rounded-md transition-colors ${activeSubTab === 'single' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Tạo bài đơn lẻ (3 Variants)
          </button>
          <button
            onClick={() => setActiveSubTab('weekly')}
            className={`px-3 py-1.5 rounded-md transition-colors ${activeSubTab === 'weekly' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Tạo cả tuần (7 bài tự động)
          </button>
          <button
            onClick={() => {
              setActiveSubTab('library');
              loadLibrary();
            }}
            className={`px-3 py-1.5 rounded-md transition-colors ${activeSubTab === 'library' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Thư viện nội dung
          </button>
        </div>

        {onNavigateToCalendar && (
          <button
            onClick={onNavigateToCalendar}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
          >
            <span>Mở Lịch đăng bài</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Mode 1: Single Generator */}
      {activeSubTab === 'single' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Form Left Column (5 spans) */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 tracking-tight">
                Cấu hình ý tưởng bài đăng
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                AI Agent sẽ tạo ra 3 phong cách khác nhau để bạn chọn lựa
              </p>
            </div>

            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  Chủ đề / Sản phẩm cần đăng *
                </label>
                <textarea
                  rows={3}
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  placeholder="Ví dụ: Giới thiệu combo 5 khung ảnh gỗ sồi treo tường phòng khách phong cách Bắc Âu ưu đãi 20%..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Sample Topics */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setTopic('Set 3 khung ảnh để bàn gia đình viền gỗ sồi tự nhiên tặng kèm in ảnh')}
                  className="text-[11px] px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded"
                >
                  Combo để bàn
                </button>
                <button
                  type="button"
                  onClick={() => setTopic('Mẹo treo tranh ảnh kỷ niệm gia đình không cần khoan đục hỏng tường')}
                  className="text-[11px] px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded"
                >
                  Tips mẹo hay
                </button>
                <button
                  type="button"
                  onClick={() => setTopic('Chương trình tri ân khách hàng: Mua 2 khung tranh canvas tặng 1 khung để bàn')}
                  className="text-[11px] px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded"
                >
                  Flash Sale
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">
                    Phong cách (Tone)
                  </label>
                  <select
                    value={tone}
                    onChange={e => setTone(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="Chuyên nghiệp, lôi cuốn">Chuyên nghiệp, lôi cuốn</option>
                    <option value="Thân thiện, ấm áp">Thân thiện, ấm áp</option>
                    <option value="Hài hước, dí dỏm">Hài hước, dí dỏm</option>
                    <option value="Kể chuyện cảm xúc (Storytelling)">Kể chuyện cảm xúc</option>
                    <option value="Kích thích chốt đơn (FOMO/Sale)">Kích thích mua hàng (Sale)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">
                    Độ dài bài viết
                  </label>
                  <select
                    value={length}
                    onChange={e => setLength(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="Ngắn gọn (Dưới 100 từ)">Ngắn gọn (&lt; 100 từ)</option>
                    <option value="Vừa phải (150-250 từ)">Vừa phải (150-250 từ)</option>
                    <option value="Chi tiết, chuyên sâu (300+ từ)">Chi tiết (300+ từ)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  Lời kêu gọi hành động (CTA)
                </label>
                <input
                  type="text"
                  value={cta}
                  onChange={e => setCta(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  Hashtags
                </label>
                <input
                  type="text"
                  value={hashtags}
                  onChange={e => setHashtags(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={generating || !topic.trim()}
                className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-xs"
              >
                <Wand2 className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
                <span>{generating ? 'AI đang sáng tạo nội dung...' : 'Sáng tạo 3 phiên bản bằng AI'}</span>
              </button>
            </form>
          </div>

          {/* Result & Live Facebook Mockup Right Column (7 spans) */}
          <div className="lg:col-span-7 space-y-4">
            {variants.length > 0 ? (
              <>
                {/* Variant Selector Tabs */}
                <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-2 shadow-xs">
                  <div className="flex items-center gap-1.5">
                    {variants.map((v, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedVariantIndex(idx)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                          selectedVariantIndex === idx
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        Variant {idx + 1}: {v.title || `Phong cách ${idx + 1}`}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleCopy(currentVariant.fullPost, selectedVariantIndex)}
                      className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md"
                      title="Sao chép bài viết"
                    >
                      {copiedIndex === selectedVariantIndex ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleSaveToLibrary(currentVariant.fullPost)}
                      className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md"
                      title="Lưu vào thư viện"
                    >
                      <Bookmark className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Facebook Live Interactive Preview Mockup */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">Xem trước giao diện Facebook (Live Mockup)</span>
                    <span>Hiển thị trên bảng tin</span>
                  </div>

                  <div className="p-4 space-y-3">
                    {/* Page Header */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0 border border-blue-200">
                        {activePage?.page_name.charAt(0) || 'M'}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-slate-900">
                            {activePage?.page_name || 'Khung Ảnh Rẻ Đẹp Mingo Store'}
                          </span>
                          <span className="w-1 h-1 rounded-full bg-slate-400" />
                          <span className="text-[11px] text-blue-600 font-medium">Theo dõi</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-slate-400">
                          <span>Vừa xong</span>
                          <span>·</span>
                          <span>🌐 Công khai</span>
                        </div>
                      </div>
                    </div>

                    {/* Post Text */}
                    <div className="text-xs text-slate-900 leading-relaxed whitespace-pre-wrap font-sans">
                      {currentVariant.fullPost}
                    </div>

                    {/* Post Image Container */}
                    <div className="rounded-lg overflow-hidden border border-slate-100 bg-slate-100 aspect-16/9 relative group">
                      <img
                        src={postImageUrl}
                        alt="Facebook Post Graphic"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    {/* Facebook Reactions & Interaction Bar */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-slate-400 text-xs">
                      <div className="flex items-center gap-1">
                        <span className="text-sm">❤️👍</span>
                        <span className="text-[11px] font-mono">128 lượt thích</span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px]">
                        <span>32 bình luận</span>
                        <span>14 lượt chia sẻ</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 grid grid-cols-3 text-center text-xs text-slate-600 font-medium">
                      <div className="flex items-center justify-center gap-1.5 py-1 hover:bg-slate-50 rounded cursor-pointer">
                        <ThumbsUp className="w-3.5 h-3.5" />
                        <span>Thích</span>
                      </div>
                      <div className="flex items-center justify-center gap-1.5 py-1 hover:bg-slate-50 rounded cursor-pointer">
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Bình luận</span>
                      </div>
                      <div className="flex items-center justify-center gap-1.5 py-1 hover:bg-slate-50 rounded cursor-pointer">
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Chia sẻ</span>
                      </div>
                    </div>
                  </div>

                  {/* CTA Actions Bar */}
                  <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <span className="text-xs text-slate-500">
                      Gợi ý ảnh AI: <strong className="text-slate-700">{imagePrompt.slice(0, 50)}...</strong>
                    </span>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => setShowScheduleModal(true)}
                        className="flex-1 sm:flex-none px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Lên lịch bài này</span>
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl p-16 text-center text-slate-400 text-xs shadow-xs space-y-3">
                <Wand2 className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="font-medium text-slate-700">Chưa có bài viết nào được tạo</p>
                <p className="max-w-xs mx-auto text-slate-400">
                  Hãy nhập chủ đề bạn muốn truyền tải ở cột bên trái và nhấn nút "Sáng tạo 3 phiên bản bằng AI".
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mode 2: Weekly Bulk Generator */}
      {activeSubTab === 'weekly' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 tracking-tight">
              Tạo hàng loạt 7 bài đăng cho cả tuần (Weekly Batch Automation)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              AI sẽ dựa trên trụ cột nội dung để phân bổ 7 góc nhìn cho 7 ngày (từ Thứ 2 đến Chủ Nhật)
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">
                Trụ cột nội dung (Content Pillar)
              </label>
              <input
                type="text"
                value={weeklyPillar}
                onChange={e => setWeeklyPillar(e.target.value)}
                placeholder="Ví dụ: Decor nhà cửa & Khung ảnh kỷ niệm gia đình"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">
                Giọng điệu chủ đạo
              </label>
              <input
                type="text"
                value={weeklyTone}
                onChange={e => setWeeklyTone(e.target.value)}
                placeholder="Ví dụ: Truyền cảm hứng, gần gũi và tạo tương tác cao"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <button
            onClick={handleGenerateWeekly}
            disabled={generatingWeekly || !weeklyPillar.trim()}
            className="px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            <span>{generatingWeekly ? 'AI đang tạo lịch trình 7 ngày...' : 'Tạo 7 bài viết với 1 click'}</span>
          </button>

          {weeklyResults.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h3 className="text-xs font-semibold text-slate-900">
                Lịch trình 7 ngày đề xuất:
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {weeklyResults.map((item, idx) => (
                  <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-blue-700">{item.day}</span>
                      <span className="text-[10px] text-slate-400 font-mono">09:30 AM</span>
                    </div>
                    <span className="font-semibold text-xs text-slate-800 block line-clamp-1">
                      {item.title}
                    </span>
                    <p className="text-xs text-slate-600 line-clamp-4 leading-relaxed whitespace-pre-wrap">
                      {item.content}
                    </p>
                    <div className="pt-2 flex items-center justify-between">
                      <button
                        onClick={() => handleCopy(item.content, idx + 10)}
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Sao chép</span>
                      </button>
                      <button
                        onClick={() => handleSaveToLibrary(item.content)}
                        className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
                      >
                        <Bookmark className="w-3 h-3" />
                        <span>Lưu thư viện</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mode 3: Content Library */}
      {activeSubTab === 'library' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 tracking-tight">
                Thư viện bài viết đã lưu ({libraryItems.length})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Kho lưu trữ bài đăng chất lượng cao để tái sử dụng và lên lịch lại bất cứ lúc nào
              </p>
            </div>
            <button
              onClick={loadLibrary}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Tải lại</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {libraryItems.length === 0 ? (
              <div className="col-span-2 py-12 text-center text-slate-400 text-xs">
                Chưa có bài viết nào trong thư viện. Bạn có thể nhấn "Lưu vào thư viện" từ các bài AI tạo ra.
              </div>
            ) : (
              libraryItems.map(item => (
                <div key={item.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-slate-800">{item.topic || 'Bài đăng'}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(item.created_at).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-4 leading-relaxed whitespace-pre-wrap">
                    {item.content}
                  </p>
                  <div className="pt-2 flex items-center justify-between border-t border-slate-200">
                    <button
                      onClick={() => handleCopy(item.content, item.id + 100)}
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Sao chép</span>
                    </button>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Đã dùng: {item.used_count || 1} lần
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Lên lịch xuất bản lên Fanpage
                </h3>
              </div>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  Trang đăng bài
                </label>
                <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800">
                  {activePage?.page_name || 'Fanpage'}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  Thời gian xuất bản (UTC+7)
                </label>
                <input
                  type="datetime-local"
                  value={scheduleDate}
                  onChange={e => setScheduleDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  URL Hình ảnh minh họa bài viết
                </label>
                <input
                  type="url"
                  value={postImageUrl}
                  onChange={e => setPostImageUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                💡 Hệ thống kiểm tra trùng lịch (Conflict Detection): sẽ cảnh báo nếu đã có bài viết trong vòng 30 phút trước/sau giờ này.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => handleConfirmSchedule(true)}
                disabled={savingPost}
                className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-50"
              >
                Đăng ngay bây giờ
              </button>
              <button
                type="button"
                onClick={() => handleConfirmSchedule(false)}
                disabled={savingPost}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 flex items-center gap-1.5"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>{savingPost ? 'Đang lưu...' : 'Xác nhận lên lịch'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
