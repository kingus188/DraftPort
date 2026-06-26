import type { ReactNode } from "react";
import { X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import "./WorkspaceViews.css";

interface WorkspacePageProps {
  title: string;
  /** Optional action rendered next to the title (e.g. an add button). */
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * Shared chrome for the full-pane workspace views (schedule, memos, version
 * timeline): a titled header with a back-to-editor button and a scrollable body.
 */
export function WorkspacePage({
  title,
  actions,
  children,
}: WorkspacePageProps) {
  const navigate = useNavigate();

  return (
    <section className="workspace-page">
      <header className="workspace-page__head">
        <h2 className="workspace-page__title">{title}</h2>
        <div className="workspace-page__head-actions">
          {actions}
          <button
            className="workspace-page__back"
            onClick={() => navigate("/")}
            aria-label="返回编辑器"
          >
            <X size={16} />
            返回
          </button>
        </div>
      </header>
      <div className="workspace-page__body">{children}</div>
    </section>
  );
}
