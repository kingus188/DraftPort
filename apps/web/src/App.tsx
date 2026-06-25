import type { CSSProperties } from "react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Toaster } from "react-hot-toast";
import { Header } from "./components/Header/Header";
import { FileSidebar } from "./components/Sidebar/FileSidebar";
import { MarkdownEditor } from "./components/Editor/MarkdownEditor";
import {
  canUseWysiwygMarkdown,
  WysiwygMarkdownEditor,
} from "./components/Editor/WysiwygMarkdownEditor";
import { useFileSystem } from "./hooks/useFileSystem";
import { useMobileView } from "./hooks/useMobileView";
import { MobileToolbar } from "./components/common/MobileToolbar";
import { useEditorStore } from "./store/editorStore";
import "./styles/global.css";
import "./App.css";

import { Loader2 } from "lucide-react";
import { useFileStore } from "./store/fileStore";
import { platform } from "./lib/platformAdapter";

const Welcome = lazy(() =>
  import("./components/Welcome/Welcome").then((m) => ({ default: m.Welcome })),
);
const UpdateModal = lazy(() =>
  import("./components/UpdateModal/UpdateModal").then((m) => ({
    default: m.UpdateModal,
  })),
);
import { MobileThemeSelector } from "./components/Theme/MobileThemeSelector";

interface UpdateEventData {
  latestVersion: string;
  currentVersion: string;
  releaseNotes?: string;
  force?: boolean;
}

interface DesktopUpdateAPI {
  onUpdateAvailable?: (callback: (data: UpdateEventData) => void) => () => void;
  onUpToDate?: (
    callback: (data: { currentVersion: string }) => void,
  ) => () => void;
  onUpdateError?: (callback: () => void) => () => void;
  removeUpdateListener?: (handler: (() => void) | undefined) => void;
  openReleases?: () => void;
}

type EditorMode = "wysiwyg" | "source";

/**
 * Owns the top-level editor shell and keeps desktop, mobile, and Desktop
 * storage modes wired through one WYSIWYG-first editing surface.
 */
function App() {
  const { workspacePath, saveFile } = useFileSystem({ enableEffects: true });
  const fileLoading = useFileStore((state) => state.isLoading);
  const { isMobile: isMobileScreen } = useMobileView();
  const isDesktop = platform.isDesktop;
  const isMobile = isMobileScreen && !platform.isDesktop;
  const copyToWechat = useEditorStore((state) => state.copyToWechat);
  const copyToZhihu = useEditorStore((state) => state.copyToZhihu);
  const copyToJuejin = useEditorStore((state) => state.copyToJuejin);
  const copyAsHtml = useEditorStore((state) => state.copyAsHtml);
  const markdown = useEditorStore((state) => state.markdown);
  const storedFilePath = useEditorStore((state) => state.currentFilePath);
  const currentFilePath = useFileStore((state) => state.currentFile?.path);
  const [showThemePanel, setShowThemePanel] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>("wysiwyg");
  const canUseWysiwygEditor = canUseWysiwygMarkdown(markdown);
  const activeEditorMode = canUseWysiwygEditor ? editorMode : "source";
  const isWorkspaceLoading = fileLoading;
  const hasNoSelectedMarkdown = !currentFilePath && !isWorkspaceLoading;
  const wysiwygDocumentKey =
    currentFilePath ?? storedFilePath ?? "draftport-unsaved-document";

  // 全局编辑快捷键：保存文档，并在 Typora-like 编辑与 Markdown 源码之间切换。
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        saveFile(true); // showToast = true
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        if (!canUseWysiwygEditor) return;
        setEditorMode((current) =>
          current === "wysiwyg" ? "source" : "wysiwyg",
        );
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [canUseWysiwygEditor, saveFile]);
  // 更新提示状态
  const [updateInfo, setUpdateInfo] = useState<{
    latestVersion: string;
    currentVersion: string;
    releaseNotes: string;
  } | null>(null);

  // 监听 Desktop 更新事件
  useEffect(() => {
    if (!isDesktop) return;
    const desktop = window.desktop as { update?: DesktopUpdateAPI };
    if (!desktop?.update?.onUpdateAvailable) return;

    const availableHandler = desktop.update.onUpdateAvailable(
      (data: UpdateEventData) => {
        // 检查是否跳过了此版本（除非是强制检查）
        const skippedVersion = localStorage.getItem(
          "draftport-skipped-version",
        );
        if (!data.force && skippedVersion === data.latestVersion) {
          return; // 用户之前选择跳过此版本
        }

        setUpdateInfo({
          latestVersion: data.latestVersion,
          currentVersion: data.currentVersion,
          releaseNotes: data.releaseNotes || "",
        });
      },
    );

    const upToDateHandler = desktop.update.onUpToDate?.(
      (data: { currentVersion: string }) => {
        // 使用 react-hot-toast 显示已是最新版本
        import("react-hot-toast").then(({ default: toast }) => {
          toast.success(`当前已是最新版本 (${data.currentVersion})`);
        });
      },
    );

    const errorHandler = desktop.update.onUpdateError?.(() => {
      import("react-hot-toast").then(({ default: toast }) => {
        toast.error("检查更新失败，请稍后重试");
      });
    });

    return () => {
      desktop.update?.removeUpdateListener?.(availableHandler);
      if (upToDateHandler)
        desktop.update?.removeUpdateListener?.(upToDateHandler);
      if (errorHandler) desktop.update?.removeUpdateListener?.(errorHandler);
    };
  }, [isDesktop]);

  const [showHistory, setShowHistory] = useState(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem("draftport-show-history");
    return saved !== "false";
  });
  const [historyWidth, setHistoryWidth] = useState<string>(
    showHistory ? "clamp(300px, 24vw, 392px)" : "0px",
  );

  useEffect(() => {
    try {
      localStorage.setItem("draftport-show-history", String(showHistory));
    } catch {
      /* 忽略持久化错误 */
    }
  }, [showHistory]);

  useEffect(() => {
    if (showHistory) {
      setHistoryWidth("clamp(300px, 24vw, 392px)");
      return;
    }
    const timer = window.setTimeout(() => setHistoryWidth("0px"), 350);
    return () => window.clearTimeout(timer);
  }, [showHistory]);

  const mainClass = "app-main";
  const mainStyle = useMemo(
    () =>
      ({
        "--history-width": historyWidth,
      }) as CSSProperties,
    [historyWidth],
  );
  // Desktop 模式：强制选择工作区
  if (isDesktop && !workspacePath) {
    return (
      <>
        <Toaster position="top-center" />
        <Suspense
          fallback={
            <div className="workspace-loading">
              <Loader2 className="animate-spin" size={24} />
            </div>
          }
        >
          <Welcome />
        </Suspense>
      </>
    );
  }

  return (
    <div
      className="app"
      data-layout-mode={isMobile ? "mobile" : "desktop"}
      style={mainStyle}
    >
      {/* 更新提示 Modal */}
      {updateInfo && (
        <Suspense fallback={null}>
          <UpdateModal
            latestVersion={updateInfo.latestVersion}
            currentVersion={updateInfo.currentVersion}
            releaseNotes={updateInfo.releaseNotes}
            onClose={() => setUpdateInfo(null)}
            onDownload={() => {
              (
                window.desktop as { update?: DesktopUpdateAPI }
              )?.update?.openReleases?.();
              setUpdateInfo(null);
            }}
            onSkipVersion={() => {
              localStorage.setItem(
                "draftport-skipped-version",
                updateInfo.latestVersion,
              );
              setUpdateInfo(null);
            }}
          />
        </Suspense>
      )}

      <>
        <Toaster
          position="top-center"
          toastOptions={{
            className: "premium-toast",
            style: {
              background: "rgba(255, 255, 255, 0.9)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              color: "#1a1a1a",
              boxShadow: "0 12px 30px -10px rgba(0, 0, 0, 0.12)",
              borderRadius: "50px",
              padding: "10px 20px",
              fontSize: "14px",
              fontWeight: 500,
              border: "1px solid rgba(0, 0, 0, 0.05)",
              maxWidth: "400px",
            },
            success: {
              iconTheme: {
                primary: "#07c160",
                secondary: "#fff",
              },
              duration: 2000,
            },
            error: {
              iconTheme: {
                primary: "#ef4444",
                secondary: "#fff",
              },
              duration: 3000,
            },
          }}
        />
        <Header />
        <button
          className={`history-toggle ${showHistory ? "" : "is-collapsed"}`}
          onClick={() => setShowHistory((prev) => !prev)}
          aria-label={showHistory ? "隐藏列表" : "显示列表"}
        >
          <span className="sr-only">
            {showHistory ? "隐藏列表" : "显示列表"}
          </span>
        </button>
        <main
          className={mainClass}
          style={mainStyle}
          data-show-history={showHistory}
        >
          <div
            className={`history-pane ${showHistory ? "is-visible" : "is-hidden"}`}
            aria-hidden={!showHistory}
          >
            <div className="history-pane__content">
              <FileSidebar />
            </div>
          </div>
          <div className="workspace">
            <div className="editor-pane" data-editor-mode={activeEditorMode}>
              {/* 存储未就绪或文件/历史加载中显示 loading */}
              {isWorkspaceLoading ? (
                <div className="workspace-loading">
                  <Loader2 className="animate-spin" size={24} />
                  <p>正在加载文章</p>
                </div>
              ) : hasNoSelectedMarkdown ? (
                <div className="workspace-empty-selection">
                  <p>无选择文件</p>
                </div>
              ) : activeEditorMode === "wysiwyg" ? (
                <WysiwygMarkdownEditor key={wysiwygDocumentKey} />
              ) : (
                <MarkdownEditor />
              )}
            </div>
          </div>

          {/* 移动端底部工具栏 */}
          {isMobile && (
            <MobileToolbar
              onCopyToWechat={copyToWechat}
              onCopyToZhihu={copyToZhihu}
              onCopyToJuejin={copyToJuejin}
              onCopyAsHtml={copyAsHtml}
              onOpenTheme={() => setShowThemePanel(true)}
            />
          )}
        </main>
      </>

      {/* 移动端主题选择器 */}
      {isMobile && (
        <MobileThemeSelector
          open={showThemePanel}
          onClose={() => setShowThemePanel(false)}
        />
      )}
    </div>
  );
}

export default App;
