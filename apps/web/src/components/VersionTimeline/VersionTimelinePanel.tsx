import { Modal } from "../common";
import { useVersionStore } from "../../store/versionStore";
import { useFileSystem } from "../../hooks/useFileSystem";
import type { DocumentVersion } from "../../store/versionTypes";
import "./VersionTimelinePanel.css";

interface VersionTimelinePanelProps {
  open: boolean;
  onClose: () => void;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

/**
 * Lists the active document's version timeline and lets the user mark a
 * milestone or restore an earlier version (restore snapshots the current state
 * first, so it is non-destructive).
 */
export function VersionTimelinePanel({
  open,
  onClose,
}: VersionTimelinePanelProps) {
  const versions = useVersionStore((state) => state.versions);
  const { restoreVersion, markMilestone } = useFileSystem();

  const handleMarkMilestone = async () => {
    const label = window.prompt("里程碑名称", "");
    if (label === null) return;
    await markMilestone(label);
  };

  const handleRestore = async (version: DocumentVersion) => {
    await restoreVersion(version);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="版本时间线">
      <div className="version-timeline">
        <button className="btn-secondary" onClick={handleMarkMilestone}>
          标记当前为里程碑
        </button>

        {versions.length === 0 ? (
          <p className="version-timeline__empty">暂无版本</p>
        ) : (
          <ul className="version-timeline__list">
            {versions.map((version) => (
              <li key={version.id} className="version-timeline__item">
                <div className="version-timeline__meta">
                  <span
                    className={`version-timeline__kind version-timeline__kind--${version.kind}`}
                  >
                    {version.kind === "milestone"
                      ? version.label || "里程碑"
                      : "自动"}
                  </span>
                  <time className="version-timeline__time">
                    {formatTime(version.createdAt)}
                  </time>
                </div>
                <button
                  className="btn-secondary"
                  onClick={() => handleRestore(version)}
                >
                  恢复
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
