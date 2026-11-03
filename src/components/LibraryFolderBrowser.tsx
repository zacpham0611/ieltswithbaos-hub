import React, { useState, useMemo } from 'react';
import {
  Folder,
  FolderOpen,
  ChevronRight,
  Home,
  Search,
  FileText,
  FileAudio,
  PenTool,
  Mic,
  ArrowRight,
} from 'lucide-react';
import type { Resource, MaterialFolder } from '../types';

interface LibraryFolderBrowserProps {
  resources: Resource[];
  skillFilter?: string;
  onSelectResource: (res: Resource) => void;
  renderExtraActions?: (res: Resource) => React.ReactNode;
  emptyMessage?: string;
}

export const LibraryFolderBrowser: React.FC<LibraryFolderBrowserProps> = ({
  resources,
  skillFilter,
  onSelectResource,
  renderExtraActions,
  emptyMessage = 'Không có tài liệu nào trong thư mục này.',
}) => {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Load folders from localStorage or derive from resources
  const folders = useMemo<MaterialFolder[]>(() => {
    let saved: MaterialFolder[] = [];
    try {
      const raw = localStorage.getItem('ielts_material_folders');
      if (raw) saved = JSON.parse(raw);
    } catch {}

    // Add unique folders from resources if not in saved list
    const existingNames = new Set(saved.map((f) => f.name.toLowerCase()));
    resources.forEach((r) => {
      if (r.folder && !existingNames.has(r.folder.toLowerCase())) {
        existingNames.add(r.folder.toLowerCase());
        saved.push({
          id: `derived_${r.folder.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
          name: r.folder,
          parentId: null,
          createdAt: new Date().toISOString(),
        });
      }
    });

    return saved;
  }, [resources]);

  // 2. Filter resources by skill
  const skillFilteredResources = useMemo(() => {
    if (!skillFilter || skillFilter === 'all') return resources;
    return resources.filter((r) => r.skill === skillFilter);
  }, [resources, skillFilter]);

  // 3. Current active folder object
  const currentFolder = useMemo(
    () => (currentFolderId ? folders.find((f) => f.id === currentFolderId) || null : null),
    [currentFolderId, folders]
  );

  // 4. Breadcrumb trail
  const breadcrumbs = useMemo(() => {
    const crumbs: MaterialFolder[] = [];
    let cur = currentFolder;
    while (cur) {
      crumbs.unshift(cur);
      cur = cur.parentId ? folders.find((f) => f.id === cur!.parentId) || null : null;
    }
    return crumbs;
  }, [currentFolder, folders]);

  // 5. Child folders of the current folder
  const childFolders = useMemo(() => {
    if (searchQuery.trim()) return [];
    return folders.filter((f) => {
      if (currentFolderId === null) {
        return !f.parentId || f.parentId === 'null' || !folders.some((p) => p.id === f.parentId);
      }
      return f.parentId === currentFolderId;
    });
  }, [folders, currentFolderId, searchQuery]);

  // 6. Resources inside current folder (or search matches across entire library)
  const displayedResources = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      return skillFilteredResources.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          (r.folder && r.folder.toLowerCase().includes(q)) ||
          (r.skill && r.skill.toLowerCase().includes(q))
      );
    }

    return skillFilteredResources.filter((r) => {
      if (currentFolderId === null) {
        // Files at root (no folder or folderId matches root)
        return (
          !r.folderId ||
          r.folderId === 'null' ||
          !folders.some((f) => f.id === r.folderId)
        );
      }
      return (
        r.folderId === currentFolderId ||
        (currentFolder && r.folder && r.folder.toLowerCase() === currentFolder.name.toLowerCase())
      );
    });
  }, [skillFilteredResources, currentFolderId, currentFolder, folders, searchQuery]);

  const getFolderItemCount = (folder: MaterialFolder): number => {
    return skillFilteredResources.filter(
      (r) =>
        r.folderId === folder.id ||
        (r.folder && r.folder.toLowerCase() === folder.name.toLowerCase())
    ).length;
  };

  const getSkillIcon = (skill?: string) => {
    switch (skill) {
      case 'listening':
        return <FileAudio className="w-4 h-4 text-purple-600" />;
      case 'writing':
        return <PenTool className="w-4 h-4 text-emerald-600" />;
      case 'speaking':
        return <Mic className="w-4 h-4 text-amber-600" />;
      default:
        return <FileText className="w-4 h-4 text-blue-600" />;
    }
  };

  return (
    <div className="space-y-3 flex flex-col flex-1 min-h-[350px]">
      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
        <input
          type="text"
          placeholder="Tìm kiếm tài liệu theo tiêu đề, kỹ năng hoặc thư mục..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 outline-hidden bg-white"
        />
      </div>

      {/* Breadcrumb Bar */}
      {!searchQuery && (
        <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 overflow-x-auto">
          <button
            type="button"
            onClick={() => setCurrentFolderId(null)}
            className={`flex items-center gap-1 hover:text-blue-600 cursor-pointer ${
              currentFolderId === null ? 'font-bold text-blue-700' : ''
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            <span>Thư viện gốc</span>
          </button>

          {breadcrumbs.map((crumb) => (
            <React.Fragment key={crumb.id}>
              <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
              <button
                type="button"
                onClick={() => setCurrentFolderId(crumb.id)}
                className={`truncate max-w-[140px] hover:text-blue-600 cursor-pointer ${
                  currentFolderId === crumb.id ? 'font-bold text-blue-700' : ''
                }`}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[420px]">
        {/* Child Folders (Folder-First Display) */}
        {!searchQuery && childFolders.length > 0 && (
          <div className="space-y-1 mb-2">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-1">
              Thư mục con ({childFolders.length}):
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {childFolders.map((f) => {
                const count = getFolderItemCount(f);
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setCurrentFolderId(f.id)}
                    className="flex items-center justify-between p-2.5 bg-amber-50/50 hover:bg-amber-100/70 border border-amber-200 hover:border-amber-300 rounded-xl transition cursor-pointer text-left group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Folder className="w-4 h-4 text-amber-600 shrink-0 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-bold text-slate-800 truncate">{f.name}</span>
                    </div>
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full shrink-0">
                      {count} tài liệu
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Resources list */}
        <div className="space-y-1.5">
          {!searchQuery && (
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-1">
              Tài liệu trong thư mục ({displayedResources.length}):
            </div>
          )}

          {displayedResources.length === 0 && childFolders.length === 0 ? (
            <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs">
              {emptyMessage}
            </div>
          ) : (
            displayedResources.map((res) => (
              <div
                key={res.id}
                className="p-3 bg-white rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/20 transition-all flex items-center justify-between gap-3 shadow-2xs group"
              >
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <div className="mt-0.5 shrink-0">{getSkillIcon(res.skill)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {res.title}
                      </span>
                      {res.skill && (
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                          {res.skill}
                        </span>
                      )}
                    </div>
                    {res.folder && (
                      <span className="text-[10px] text-amber-700 flex items-center gap-1 mt-0.5">
                        <Folder className="w-3 h-3" />
                        {res.folder}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {renderExtraActions?.(res)}
                  <button
                    type="button"
                    onClick={() => onSelectResource(res)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                  >
                    <span>Chọn</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
